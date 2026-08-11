using System.Diagnostics;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Haproxy.Editor.Adapters.MongoDB;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Shouldly;
using Xunit;

namespace Haproxy.Editor.WebApi.Tests;

public sealed class MongoExposureMutationLockTests
{
	[DockerFact]
	public async Task Concurrent_first_acquisitions_have_exactly_one_winner()
	{
		await using var mongo = await MongoFixture.Start();
		var mutationLock = CreateLock(mongo.Database);
		var start = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
		var acquisitions = Enumerable.Range(0, 16).Select(async _ =>
		{
			await start.Task;
			try
			{
				return (Lease: await mutationLock.Acquire(), Conflict: false);
			}
			catch (ResourceConflictException)
			{
				return (Lease: (IExposureMutationLease?)null, Conflict: true);
			}
		}).ToArray();

		start.SetResult();
		var results = await Task.WhenAll(acquisitions);

		results.Count(result => result.Lease is not null).ShouldBe(1);
		results.Count(result => result.Conflict).ShouldBe(15);
		await results.Single(result => result.Lease is not null).Lease!.DisposeAsync();
	}

	[DockerFact]
	public async Task Lease_renews_until_disposal_and_can_then_be_reacquired()
	{
		await using var mongo = await MongoFixture.Start();
		var mutationLock = CreateLock(mongo.Database);
		var lease = await mutationLock.Acquire();

		await Task.Delay(TimeSpan.FromMilliseconds(700));

		await Should.ThrowAsync<ResourceConflictException>(() => mutationLock.Acquire());
		await lease.DisposeAsync();
		await using var reacquired = await mutationLock.Acquire();
	}

	[DockerFact]
	public async Task Lease_reports_ownership_loss_and_disposal_does_not_delete_the_new_owner()
	{
		await using var mongo = await MongoFixture.Start();
		var mutationLock = CreateLock(mongo.Database);
		var lease = await mutationLock.Acquire();
		var locks = mongo.Database.GetCollection<BsonDocument>("exposureLocks");
		await locks.UpdateOneAsync(
			Builders<BsonDocument>.Filter.Eq("_id", "haproxy-config"),
			Builders<BsonDocument>.Update.Set("owner", "replacement-owner").Set("expiresAt", DateTime.UtcNow.AddMinutes(1)));

		await WaitForCancellation(lease.LeaseLost);
		await lease.DisposeAsync();

		var stored = await locks.Find(Builders<BsonDocument>.Filter.Eq("_id", "haproxy-config")).SingleAsync();
		stored["owner"].AsString.ShouldBe("replacement-owner");
		await Should.ThrowAsync<ResourceConflictException>(() => mutationLock.Acquire());
	}

	private static MongoExposureMutationLock CreateLock(IMongoDatabase database)
	{
		return new MongoExposureMutationLock(
			database,
			NullLogger<MongoExposureMutationLock>.Instance,
			TimeProvider.System,
			TimeSpan.FromMilliseconds(400),
			TimeSpan.FromMilliseconds(50));
	}

	private static async Task WaitForCancellation(CancellationToken cancellationToken)
	{
		var canceled = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
		using var registration = cancellationToken.Register(canceled.SetResult);
		await canceled.Task.WaitAsync(TimeSpan.FromSeconds(5));
	}

	private sealed class MongoFixture(IContainer container, IMongoDatabase database) : IAsyncDisposable
	{
		public IMongoDatabase Database { get; } = database;

		public static async Task<MongoFixture> Start()
		{
			var container = new ContainerBuilder("mongo:8.0.4")
				.WithPortBinding(27017, true)
				.WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(27017))
				.Build();

			await container.StartAsync();

			var client = new MongoClient($"mongodb://localhost:{container.GetMappedPublicPort(27017)}");
			var database = client.GetDatabase($"haproxy-editor-lock-{Guid.NewGuid():N}");
			return new MongoFixture(container, database);
		}

		public ValueTask DisposeAsync() => container.DisposeAsync();
	}
}

public sealed class DockerFactAttribute : FactAttribute
{
	private static readonly Lazy<bool> DockerAvailable = new(CheckDockerAvailability);

	public DockerFactAttribute()
	{
		if (!DockerAvailable.Value)
		{
			Skip = "Docker is required for the MongoDB integration test.";
		}
	}

	private static bool CheckDockerAvailability()
	{
		try
		{
			using var process = Process.Start(new ProcessStartInfo
			{
				FileName = "docker",
				Arguments = "info --format {{.ServerVersion}}",
				UseShellExecute = false,
				CreateNoWindow = true,
				RedirectStandardOutput = true,
				RedirectStandardError = true,
			});

			if (process is null || !process.WaitForExit(3000))
			{
				process?.Kill(entireProcessTree: true);
				return false;
			}

			return process.ExitCode == 0;
		}
		catch
		{
			return false;
		}
	}
}
