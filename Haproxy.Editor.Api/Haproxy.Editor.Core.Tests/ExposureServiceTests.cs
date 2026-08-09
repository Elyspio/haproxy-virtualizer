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
		repository.ListAll().Returns([
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
		haproxy.GetConfig().Returns(new HaproxyResourceSnapshot
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
		haproxy.GetConfig().Returns(new HaproxyResourceSnapshot
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
		await haproxy.DidNotReceive().SaveConfig(Arg.Any<HaproxyResourceSnapshot>());
	}

	[Fact]
	public async Task Create_uses_haproxy_implicit_and_between_acl_conditions()
	{
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig().Returns(Snapshot());
		haproxy.SaveConfig(Arg.Any<HaproxyResourceSnapshot>()).Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
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
			exposure.RuleCondition == $"({exposure.ManagedAclName} host_acl)"));
	}

	[Fact]
	public async Task Create_restores_haproxy_when_repository_write_fails()
	{
		var savedRuleCounts = new List<int>();
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig().Returns(Snapshot());
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(snapshot =>
			savedRuleCounts.Add(snapshot.Frontends.Single().BackendSwitchingRules.Count)))
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureRepository>();
		repository.Create(Arg.Any<ManagedExposure>()).Returns<Task>(_ => throw new InvalidOperationException("MongoDB unavailable"));
		var service = CreateService(haproxy, repository);

		await Should.ThrowAsync<InvalidOperationException>(() => service.Create("owner", null, new ExposureUpsertRequest
		{
			FrontendName = "fe_main",
			BackendName = "be_main",
			AclReferences = ["host_acl"],
		}));

		savedRuleCounts.ShouldBe([1, 0]);
	}

	[Fact]
	public async Task Replace_restores_previous_haproxy_rule_when_repository_write_fails()
	{
		var savedConditions = new List<string?>();
		var current = Managed("owner", "fe_main", "be_main");
		var snapshot = Snapshot(current);
		snapshot.Frontends.Single().Acls.Add(new HaproxyAclResource { Name = "other_acl" });
		var haproxy = Substitute.For<IHaproxyService>();
		haproxy.GetConfig().Returns(snapshot);
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(value =>
			savedConditions.Add(value.Frontends.Single().BackendSwitchingRules.Single().CondTest)))
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureRepository>();
		repository.Get("owner", current.Id).Returns(current);
		repository.Replace(Arg.Any<ManagedExposure>()).Returns<Task>(_ => throw new InvalidOperationException("MongoDB unavailable"));
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
		haproxy.GetConfig().Returns(Snapshot(current));
		haproxy.SaveConfig(Arg.Do<HaproxyResourceSnapshot>(value =>
			savedConditions.Add(value.Frontends.Single().BackendSwitchingRules.SingleOrDefault()?.CondTest)))
			.Returns(call => Task.FromResult(call.Arg<HaproxyResourceSnapshot>()!));
		var repository = Substitute.For<IExposureRepository>();
		repository.Get("owner", current.Id).Returns(current);
		repository.Delete(current.Id).Returns<Task>(_ => throw new InvalidOperationException("MongoDB unavailable"));
		var service = CreateService(haproxy, repository);

		await Should.ThrowAsync<InvalidOperationException>(() => service.Delete("owner", current.Id));

		savedConditions.ShouldBe([null, "host_acl"]);
	}

	private static ExposureService CreateService(IHaproxyService? haproxy = null, IExposureRepository? repository = null)
	{
		var mutationLock = Substitute.For<IExposureMutationLock>();
		mutationLock.Acquire().Returns(Substitute.For<IDisposable>());
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
