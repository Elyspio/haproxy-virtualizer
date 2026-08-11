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
	[Fact]
	public async Task List_returns_public_records_for_all_owners()
	{
		var repository = Substitute.For<IExposureRepository>();
		repository.ListAll(Arg.Any<CancellationToken>()).Returns([
			Managed("owner-a", "fe_a", "be_a"),
			Managed("owner-b", "fe_b", "be_b"),
		]);
		var service = CreateService(repository: repository);

		var result = await service.List();

		result.Count.ShouldBe(2);
		result.Select(mapping => mapping.FrontendName).ShouldBe(["fe_a", "fe_b"]);
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

		var error = await Should.ThrowAsync<ResourceConflictException>(() => service.Create("owner", null, new ExposureUpsertRequest
		{
			FrontendName = "fe_main",
			BackendName = "be_main",
			AclReferences = ["host_acl"],
		}));

		error.Message.ShouldContain("identical backend-switching condition");
		await haproxy.DidNotReceive().SaveConfig(Arg.Any<HaproxyResourceSnapshot>(), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task Create_uses_haproxy_implicit_and_between_acl_conditions()
	{
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(Snapshot());
		haproxy.SaveConfig(Arg.Any<HaproxyResourceSnapshot>(), Arg.Any<CancellationToken>()).Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureRepository>();
		var service = CreateService(haproxy, repository);

		await service.Create("owner", null, new ExposureUpsertRequest
		{
			FrontendName = "fe_main",
			BackendName = "be_main",
			Matcher = new ExposureMatcher { Type = ExposureMatcherType.Host, Value = "example.test" },
			AclReferences = ["host_acl"],
			Operator = ExposureOperator.And,
		});

		await repository.Received(1).Create(Arg.Is<ManagedExposure>(exposure => exposure != null &&
			exposure.RuleCondition == $"({exposure.ManagedAclName} host_acl)"), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task Create_normalizes_and_deduplicates_acl_references_before_building_the_rule()
	{
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(Snapshot());
		haproxy.SaveConfig(Arg.Any<HaproxyResourceSnapshot>(), Arg.Any<CancellationToken>()).Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureRepository>();
		var service = CreateService(haproxy, repository);

		await service.Create("owner", null, new ExposureUpsertRequest
		{
			FrontendName = "fe_main",
			BackendName = "be_main",
			AclReferences = [" host_acl ", "host_acl"],
		});

		await repository.Received(1).Create(Arg.Is<ManagedExposure>(exposure => exposure != null &&
			exposure.AclReferences.SequenceEqual(new[] { "host_acl" }) &&
			exposure.RuleCondition == "host_acl"), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task Create_restores_haproxy_when_repository_write_fails()
	{
		var savedRuleCounts = new List<int>();
		var savedWithCanceledToken = new List<bool>();
		using var requestCancellation = new CancellationTokenSource();
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(Snapshot());
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(snapshot =>
			savedRuleCounts.Add(snapshot.Frontends.Single().BackendSwitchingRules.Count)), Arg.Do<CancellationToken>(token => savedWithCanceledToken.Add(token.IsCancellationRequested)))
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureRepository>();
		repository.Create(Arg.Any<ManagedExposure>(), Arg.Any<CancellationToken>()).Returns<Task>(_ =>
		{
			requestCancellation.Cancel();
			throw new InvalidOperationException("MongoDB unavailable");
		});
		var service = CreateService(haproxy, repository);

		await Should.ThrowAsync<InvalidOperationException>(() => service.Create("owner", null, new ExposureUpsertRequest
		{
			FrontendName = "fe_main",
			BackendName = "be_main",
			AclReferences = ["host_acl"],
		}, requestCancellation.Token));

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

		var pending = service.Create("owner", null, new ExposureUpsertRequest
		{
			FrontendName = "fe_main",
			BackendName = "be_main",
			AclReferences = ["host_acl"],
		});
		await getConfigStarted.Task;
		leaseLost.Cancel();

		await Should.ThrowAsync<OperationCanceledException>(() => pending);
	}

	[Fact]
	public async Task Replace_restores_previous_haproxy_rule_when_repository_write_fails()
	{
		var savedConditions = new List<string?>();
		var current = Managed("owner", "fe_main", "be_main");
		var snapshot = Snapshot(current);
		snapshot.Frontends.Single().Acls.Add(new HaproxyAclResource { Name = "other_acl" });
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(snapshot);
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(value =>
			savedConditions.Add(value.Frontends.Single().BackendSwitchingRules.Single().CondTest)), Arg.Any<CancellationToken>())
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureRepository>();
		repository.Get("owner", current.Id, Arg.Any<CancellationToken>()).Returns(current);
		repository.Replace(Arg.Any<ManagedExposure>(), Arg.Any<CancellationToken>()).Returns<Task>(_ => throw new InvalidOperationException("MongoDB unavailable"));
		var service = CreateService(haproxy, repository);

		await Should.ThrowAsync<InvalidOperationException>(() => service.Replace("owner", null, current.Id, new ExposureUpsertRequest
		{
			FrontendName = "fe_main",
			BackendName = "be_main",
			AclReferences = ["other_acl"],
		}));

		savedConditions.ShouldBe(["other_acl", "host_acl"]);
	}

	[Fact]
	public async Task Delete_restores_haproxy_rule_when_repository_write_fails()
	{
		var savedConditions = new List<string?>();
		var current = Managed("owner", "fe_main", "be_main");
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig(Arg.Any<CancellationToken>()).Returns(Snapshot(current));
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(value =>
			savedConditions.Add(value.Frontends.Single().BackendSwitchingRules.SingleOrDefault()?.CondTest)), Arg.Any<CancellationToken>())
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureRepository>();
		repository.Get("owner", current.Id, Arg.Any<CancellationToken>()).Returns(current);
		repository.Delete(current.Id, Arg.Any<CancellationToken>()).Returns<Task>(_ => throw new InvalidOperationException("MongoDB unavailable"));
		var service = CreateService(haproxy, repository);

		await Should.ThrowAsync<InvalidOperationException>(() => service.Delete("owner", current.Id));

		savedConditions.ShouldBe([null, "host_acl"]);
	}

	private static ExposureService CreateService(
		IHaproxyService? haproxy = null,
		IExposureRepository? repository = null,
		IExposureMutationLock? mutationLock = null)
	{
		if (mutationLock is null)
		{
			mutationLock = Substitute.For<IExposureMutationLock>();
			var lease = Substitute.For<IExposureMutationLease>();
			lease.LeaseLost.Returns(CancellationToken.None);
			mutationLock.Acquire(Arg.Any<CancellationToken>()).Returns(lease);
		}
		return new ExposureService(haproxy ?? Substitute.For<IHaproxyService>(), repository ?? Substitute.For<IExposureRepository>(), mutationLock, NullLogger<ExposureService>.Instance);
	}

	private static ManagedExposure Managed(string owner, string frontend, string backend) => new()
	{
		Id = Guid.NewGuid(), OwnerClientId = owner, FrontendName = frontend, BackendName = backend,
		Matcher = new ExposureMatcher { Type = ExposureMatcherType.Host, Value = "example.test" },
		CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow,
		RuleCondition = "host_acl",
	};

	private static HaproxyResourceSnapshot Snapshot(ManagedExposure? exposure = null) => new()
	{
		Frontends =
		[
			new HaproxyFrontendResource
			{
				Name = "fe_main",
				Acls = [new HaproxyAclResource { Name = "host_acl" }],
				BackendSwitchingRules = exposure is null
					? []
					: [new HaproxyBackendSwitchingRuleResource { BackendName = exposure.BackendName, Cond = "if", CondTest = exposure.RuleCondition }],
			},
		],
		Backends = [new HaproxyBackendResource { Name = "be_main" }],
	};
}
