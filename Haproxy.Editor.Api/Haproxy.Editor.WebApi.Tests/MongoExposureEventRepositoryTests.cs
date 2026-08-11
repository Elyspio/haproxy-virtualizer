using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Adapters.MongoDB;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Driver;
using Shouldly;
using Xunit;

namespace Haproxy.Editor.WebApi.Tests;

public sealed class MongoExposureEventRepositoryTests
{
	[DockerFact]
	public async Task Repository_reconstructs_active_state_and_pages_filtered_history()
	{
		await using var fixture = await MongoFixture.Start();
		var repository = new MongoExposureEventRepository(fixture.Database, NullLogger<MongoExposureEventRepository>.Instance);
		var firstId = Guid.NewGuid();
		var secondId = Guid.NewGuid();
		var actor = new ExposureActorResource { SubjectId = "subject", Username = "user", OAuthClientId = "i-shared-mcp" };
		var start = DateTimeOffset.UtcNow.AddMinutes(-1);
		await repository.Append(Event(firstId, 1, ExposureEventKind.Created, start, actor, "backend-v1"));
		await repository.Append(Event(firstId, 2, ExposureEventKind.Replaced, start.AddSeconds(1), actor, "backend-v2"));
		await repository.Append(Event(secondId, 1, ExposureEventKind.Created, start.AddSeconds(2), actor, "backend-deleted"));
		await repository.Append(Event(secondId, 2, ExposureEventKind.Deleted, start.AddSeconds(3), actor, "backend-deleted"));

		var active = await repository.List();
		var current = await repository.Get(firstId);
		var deleted = await repository.Get(secondId);
		var firstPage = await repository.History(firstId, cursor: null, limit: 1);
		var secondPage = await repository.History(firstId, firstPage.NextCursor, limit: 1);

		active.Select(item => item.Id).ShouldBe([firstId]);
		current.ShouldNotBeNull();
		current.BackendName.ShouldBe("backend-v2");
		current.Version.ShouldBe(2);
		current.Created.At.ShouldBe(start);
		current.Updated.ShouldNotBeNull();
		current.Updated.At.ShouldBe(start.AddSeconds(1));
		deleted.ShouldBeNull();
		firstPage.Items.Single().Version.ShouldBe(2);
		firstPage.NextCursor.ShouldNotBeNull();
		secondPage.Items.Single().Version.ShouldBe(1);
		secondPage.NextCursor.ShouldBeNull();
	}

	private static ExposureEventResource Event(
		Guid exposureId,
		long version,
		ExposureEventKind kind,
		DateTimeOffset occurredAt,
		ExposureActorResource actor,
		string backendName) => new()
		{
			EventId = Guid.NewGuid(),
			ExposureId = exposureId,
			Version = version,
			Kind = kind,
			OccurredAt = occurredAt,
			Actor = actor,
			State = new ExposureUpsertRequest
			{
				FrontendName = "frontend",
				BackendName = backendName,
				AclReferences = ["acl"],
			},
		};

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
			return new MongoFixture(container, client.GetDatabase($"haproxy-editor-events-{Guid.NewGuid():N}"));
		}

		public ValueTask DisposeAsync() => container.DisposeAsync();
	}
}
