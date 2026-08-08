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
}
