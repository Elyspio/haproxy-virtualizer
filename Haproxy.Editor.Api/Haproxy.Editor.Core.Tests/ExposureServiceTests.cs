using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Haproxy.Editor.Core.Services;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Shouldly;
using Xunit;

namespace Haproxy.Editor.Core.Tests;

public class ExposureServiceTests
{
	private static readonly ExposureActorResource Creator = Actor("creator", "codex");
	private static readonly ExposureActorResource Editor = Actor("editor", "claude-code");

	[Fact]
	public async Task Create_appends_version_one_and_returns_creation_audit()
	{
		var haproxy = WritableHaproxy(Snapshot());
		var repository = Substitute.For<IExposureEventRepository>();
		var service = CreateService(haproxy, repository);

		var result = await service.Create(Creator, Request());

		result.Version.ShouldBe(1);
		result.Created.By.ShouldBe(Creator);
		result.Updated.ShouldBeNull();
		await repository.Received(1).Append(Arg.Is<ExposureEventResource>(@event =>
			@event != null &&
			@event.ExposureId == result.Id &&
			@event.Version == 1 &&
			@event.Kind == ExposureEventKind.Created &&
			@event.Actor == Creator &&
			@event.State.AclReferences.SequenceEqual(new[] { "host_acl" })), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task Replace_allows_another_authorized_actor_and_records_latest_update()
	{
		var current = Resource(Creator, version: 1);
		var snapshot = Snapshot(current);
		snapshot.Frontends.Single().Acls.Add(new HaproxyAclResource { Name = "other_acl" });
		var haproxy = WritableHaproxy(snapshot);
		var repository = Substitute.For<IExposureEventRepository>();
		repository.Get(current.Id, Arg.Any<CancellationToken>()).Returns(current);
		var service = CreateService(haproxy, repository);

		var result = await service.Replace(Editor, current.Id, Request("other_acl"));

		result.ShouldNotBeNull();
		result.Version.ShouldBe(2);
		result.Created.ShouldBe(current.Created);
		result.Updated.ShouldNotBeNull();
		result.Updated.By.ShouldBe(Editor);
		await repository.Received(1).Append(Arg.Is<ExposureEventResource>(@event =>
			@event != null && @event.Version == 2 && @event.Kind == ExposureEventKind.Replaced && @event.Actor == Editor), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task Delete_appends_the_last_active_state()
	{
		var current = Resource(Creator, version: 3);
		var haproxy = WritableHaproxy(Snapshot(current));
		var repository = Substitute.For<IExposureEventRepository>();
		repository.Get(current.Id, Arg.Any<CancellationToken>()).Returns(current);
		var service = CreateService(haproxy, repository);

		var deleted = await service.Delete(Editor, current.Id);

		deleted.ShouldBeTrue();
		await repository.Received(1).Append(Arg.Is<ExposureEventResource>(@event =>
			@event != null &&
			@event.Version == 4 &&
			@event.Kind == ExposureEventKind.Deleted &&
			@event.Actor == Editor &&
			@event.State.FrontendName == current.FrontendName), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task List_returns_active_resources_from_the_event_repository()
	{
		var expected = new[] { Resource(Creator, 1), Resource(Editor, 2) };
		var repository = Substitute.For<IExposureEventRepository>();
		repository.List(Arg.Any<CancellationToken>()).Returns(expected);
		var service = CreateService(repository: repository);

		var result = await service.List();

		result.ShouldBe(expected);
	}

	[Fact]
	public async Task History_delegates_the_global_or_exposure_filtered_cursor_query()
	{
		var exposureId = Guid.NewGuid();
		var expected = new ExposureHistoryPage { Items = [], NextCursor = "next" };
		var repository = Substitute.For<IExposureEventRepository>();
		repository.History(exposureId, "cursor", 25, Arg.Any<CancellationToken>()).Returns(expected);
		var service = CreateService(repository: repository);

		var result = await service.History(exposureId, "cursor", 25);

		result.ShouldBe(expected);
	}

	[Fact]
	public async Task Discover_returns_sorted_frontends_backends_and_acl_names()
	{
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(new HaproxyResourceSnapshot
		{
			Frontends =
			[
				new HaproxyFrontendResource { Name = "fe_z", Acls = [new HaproxyAclResource { Name = "z" }, new HaproxyAclResource { Name = "a" }] },
				new HaproxyFrontendResource { Name = "fe_a" },
			],
			Backends = [new HaproxyBackendResource { Name = "be_z" }, new HaproxyBackendResource { Name = "be_a" }],
		});
		var service = CreateService(haproxy: haproxy);

		var result = await service.Discover();

		result.Frontends.Select(frontend => frontend.Name).ShouldBe(["fe_a", "fe_z"]);
		result.Frontends[1].AclNames.ShouldBe(["a", "z"]);
		result.Backends.ShouldBe(["be_a", "be_z"]);
	}

	[Fact]
	public async Task Create_rejects_an_identical_existing_rule_condition()
	{
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(new HaproxyResourceSnapshot
		{
			Frontends = [new HaproxyFrontendResource { Name = "fe_main", Acls = [new HaproxyAclResource { Name = "host_acl" }], BackendSwitchingRules = [new HaproxyBackendSwitchingRuleResource { BackendName = "be_existing", Cond = "if", CondTest = "host_acl" }] }],
			Backends = [new HaproxyBackendResource { Name = "be_main" }],
		});
		var service = CreateService(haproxy: haproxy);

		var error = await Should.ThrowAsync<ResourceConflictException>(() => service.Create(Creator, Request()));

		error.Message.ShouldContain("identical backend-switching condition");
		await haproxy.DidNotReceive().SaveConfig(Arg.Any<HaproxyResourceSnapshot>(), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task Create_normalizes_and_deduplicates_acl_references()
	{
		var haproxy = WritableHaproxy(Snapshot());
		var repository = Substitute.For<IExposureEventRepository>();
		var service = CreateService(haproxy, repository);

		await service.Create(Creator, Request(" host_acl ", "host_acl"));

		await repository.Received(1).Append(Arg.Is<ExposureEventResource>(@event =>
			@event != null && @event.State.AclReferences.SequenceEqual(new[] { "host_acl" })), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task Create_restores_haproxy_when_event_append_fails()
	{
		var savedRuleCounts = new List<int>();
		var savedWithCanceledToken = new List<bool>();
		using var requestCancellation = new CancellationTokenSource();
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(Snapshot());
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(snapshot =>
			savedRuleCounts.Add(snapshot.Frontends.Single().BackendSwitchingRules.Count)), Arg.Do<CancellationToken>(token => savedWithCanceledToken.Add(token.IsCancellationRequested)))
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureEventRepository>();
		repository.Append(Arg.Any<ExposureEventResource>(), Arg.Any<CancellationToken>()).Returns<Task>(_ =>
		{
			requestCancellation.Cancel();
			throw new InvalidOperationException("MongoDB unavailable");
		});
		var service = CreateService(haproxy, repository);

		await Should.ThrowAsync<InvalidOperationException>(() => service.Create(Creator, Request(), requestCancellation.Token));

		savedRuleCounts.ShouldBe([1, 0]);
		savedWithCanceledToken.ShouldBe([false, false]);
	}

	[Fact]
	public async Task Create_cancels_the_active_operation_when_the_mutation_lease_is_lost()
	{
		using var leaseLost = new CancellationTokenSource();
		var lease = Substitute.For<IExposureMutationLease>();
		lease.LeaseLost.Returns(leaseLost.Token);
		var mutationLock = Substitute.For<IExposureMutationLock>();
		mutationLock.Acquire(Arg.Any<CancellationToken>()).Returns(lease);
		var getConfigStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(async call =>
		{
			getConfigStarted.SetResult();
			await Task.Delay(Timeout.InfiniteTimeSpan, call.Arg<CancellationToken>());
			return Snapshot();
		});
		var service = CreateService(haproxy: haproxy, mutationLock: mutationLock);

		var pending = service.Create(Creator, Request());
		await getConfigStarted.Task;
		leaseLost.Cancel();

		await Should.ThrowAsync<OperationCanceledException>(() => pending);
	}

	[Fact]
	public async Task Replace_restores_previous_haproxy_rule_when_event_append_fails()
	{
		var savedConditions = new List<string?>();
		var current = Resource(Creator, 1);
		var snapshot = Snapshot(current);
		snapshot.Frontends.Single().Acls.Add(new HaproxyAclResource { Name = "other_acl" });
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(snapshot);
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(value =>
			savedConditions.Add(value.Frontends.Single().BackendSwitchingRules.Single().CondTest)), Arg.Any<CancellationToken>())
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureEventRepository>();
		repository.Get(current.Id, Arg.Any<CancellationToken>()).Returns(current);
		repository.Append(Arg.Any<ExposureEventResource>(), Arg.Any<CancellationToken>()).Returns<Task>(_ => throw new InvalidOperationException("MongoDB unavailable"));
		var service = CreateService(haproxy, repository);

		await Should.ThrowAsync<InvalidOperationException>(() => service.Replace(Editor, current.Id, Request("other_acl")));

		savedConditions.ShouldBe(["other_acl", "host_acl"]);
	}

	[Fact]
	public async Task Delete_restores_haproxy_rule_when_event_append_fails()
	{
		var savedConditions = new List<string?>();
		var current = Resource(Creator, 1);
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(Snapshot(current));
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(value =>
			savedConditions.Add(value.Frontends.Single().BackendSwitchingRules.SingleOrDefault()?.CondTest)), Arg.Any<CancellationToken>())
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureEventRepository>();
		repository.Get(current.Id, Arg.Any<CancellationToken>()).Returns(current);
		repository.Append(Arg.Any<ExposureEventResource>(), Arg.Any<CancellationToken>()).Returns<Task>(_ => throw new InvalidOperationException("MongoDB unavailable"));
		var service = CreateService(haproxy, repository);

		await Should.ThrowAsync<InvalidOperationException>(() => service.Delete(Editor, current.Id));

		savedConditions.ShouldBe([null, "host_acl"]);
	}

	private static ExposureService CreateService(
		IHaproxyService? haproxy = null,
		IExposureEventRepository? repository = null,
		IExposureMutationLock? mutationLock = null)
	{
		if (mutationLock is null)
		{
			mutationLock = Substitute.For<IExposureMutationLock>();
			var lease = Substitute.For<IExposureMutationLease>();
			lease.LeaseLost.Returns(CancellationToken.None);
			mutationLock.Acquire(Arg.Any<CancellationToken>()).Returns(lease);
		}

		return new ExposureService(haproxy ?? Substitute.For<IHaproxyService>(), repository ?? Substitute.For<IExposureEventRepository>(), mutationLock, NullLogger<ExposureService>.Instance);
	}

	private static IHaproxyService WritableHaproxy(HaproxyResourceSnapshot snapshot)
	{
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(snapshot);
		haproxy.SaveConfig(Arg.Any<HaproxyResourceSnapshot>(), Arg.Any<CancellationToken>()).Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		return haproxy;
	}

	private static ExposureActorResource Actor(string subject, string client) => new()
	{
		SubjectId = subject,
		Username = subject,
		OAuthClientId = "i-shared-mcp",
		McpClientName = client,
		McpClientVersion = "1.0",
	};

	private static ExposureUpsertRequest Request(params string[] aclReferences) => new()
	{
		FrontendName = "fe_main",
		BackendName = "be_main",
		AclReferences = aclReferences.Length == 0 ? ["host_acl"] : [.. aclReferences],
	};

	private static ExposureResource Resource(ExposureActorResource actor, long version) => new()
	{
		Id = Guid.NewGuid(),
		Version = version,
		FrontendName = "fe_main",
		BackendName = "be_main",
		AclReferences = ["host_acl"],
		Created = new ExposureAuditStampResource { At = DateTimeOffset.UtcNow.AddMinutes(-5), By = Creator },
		Updated = version == 1 ? null : new ExposureAuditStampResource { At = DateTimeOffset.UtcNow, By = actor },
	};

	private static HaproxyResourceSnapshot Snapshot(ExposureResource? exposure = null) => new()
	{
		Frontends =
		[
			new HaproxyFrontendResource
			{
				Name = "fe_main",
				Acls = [new HaproxyAclResource { Name = "host_acl" }],
				BackendSwitchingRules = exposure is null
					? []
					: [new HaproxyBackendSwitchingRuleResource { BackendName = exposure.BackendName, Cond = "if", CondTest = "host_acl" }],
			},
		],
		Backends = [new HaproxyBackendResource { Name = "be_main" }],
	};
}
