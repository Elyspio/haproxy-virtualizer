using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Adapters.MongoDB;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Shouldly;
using Xunit;

namespace Haproxy.Editor.WebApi.Tests;

public sealed class MongoExposureMutationLockTests
{
	[Fact]
	public async Task Acquire_reports_conflict_while_another_owner_holds_the_lock()
	{
		await using var container = new TestcontainersBuilder<TestcontainersContainer>()
			.WithImage("mongo:8.0.4")
			.WithPortBinding(27017, true)
			.WithWaitStrategy(Wait.ForUnixContainer().UntilPortIsAvailable(27017))
			.Build();

		try
		{
			await container.StartAsync();
		}
		catch (Exception exception) when (IsDockerUnavailable(exception))
		{
			return;
		}

		var client = new MongoClient($"mongodb://localhost:{container.GetMappedPublicPort(27017)}");
		var database = client.GetDatabase($"haproxy-editor-lock-{Guid.NewGuid():N}");
		var mutationLock = new MongoExposureMutationLock(database, NullLogger<MongoExposureMutationLock>.Instance);

		using (await mutationLock.Acquire())
		{
			await Should.ThrowAsync<ResourceConflictException>(() => mutationLock.Acquire());
		}

		using var reacquired = await mutationLock.Acquire();
	}

	private static bool IsDockerUnavailable(Exception exception)
	{
		var message = exception.ToString();
		return message.Contains("Docker", StringComparison.OrdinalIgnoreCase)
		       || message.Contains("named pipe", StringComparison.OrdinalIgnoreCase)
		       || message.Contains("timed out", StringComparison.OrdinalIgnoreCase)
		       || message.Contains("No such file", StringComparison.OrdinalIgnoreCase);
	}
}
