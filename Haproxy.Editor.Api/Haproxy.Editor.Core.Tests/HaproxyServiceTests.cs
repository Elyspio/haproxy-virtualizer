using System.Net.Http;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Core.Services;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Shouldly;
using Xunit;
using Generated = Haproxy.Editor.Adapters.Haproxy;

namespace Haproxy.Editor.Core.Tests;

public class HaproxyServiceTests
{
	[Fact]
	public async Task GetConfig_builds_resource_snapshot_from_generated_data_plane_resources()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = new HaproxyService(client, NullLogger<HaproxyService>.Instance);

		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(7);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global { Daemon = true });
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Defaults { Name = "defaults_main", Mode = Generated.Defaults_baseMode.Http },
		]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Frontend { Name = "fe_main", Mode = Generated.Frontend_baseMode.Http },
		]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Backend { Name = "be_main", Mode = Generated.Backend_baseMode.Http, Adv_check = Generated.Backend_baseAdv_check.TcpCheck },
		]);
		client.GetAllBindFrontendAsync("fe_main", null, Arg.Any<CancellationToken>()).Returns([
			new Generated.Bind { Name = "public", Address = "127.0.0.1", Port = 80 },
		]);
		client.GetAllAclFrontendAsync("fe_main", null, null, Arg.Any<CancellationToken>()).Returns([
			new Generated.Acl { Acl_name = "host_acl", Criterion = "hdr(host)", Value = "example.com" },
		]);
		client.GetBackendSwitchingRulesAsync("fe_main", null, Arg.Any<CancellationToken>()).Returns([
			new Generated.Backend_switching_rule { Name = "be_main", Cond = Generated.Backend_switching_ruleCond.If, Cond_test = "host_acl" },
		]);
		client.GetAllServerBackendAsync("be_main", null, Arg.Any<CancellationToken>()).Returns([
			new Generated.Server { Name = "app_1", Address = "10.0.0.10", Port = 8080 },
		]);

		var result = await service.GetConfig();

		result.Version.ShouldBe(7);
		result.Frontends.Count.ShouldBe(1);
		result.Backends.Count.ShouldBe(1);
		result.Summary.ServerCount.ShouldBe(1);
		result.Frontends[0].Binds[0].Address.ShouldBe("127.0.0.1");
		result.Frontends[0].Acls[0].Name.ShouldBe("host_acl");
		result.Backends[0].AdvCheck.ShouldBe("tcp-check");
		result.Backends[0].Servers[0].Name.ShouldBe("app_1");
	}

	[Fact]
	public async Task ValidateConfig_starts_transaction_applies_changes_and_deletes_transaction()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = new HaproxyService(client, NullLogger<HaproxyService>.Instance);
		var desired = new HaproxyResourceSnapshot
		{
			Version = 10,
			Global = new HaproxyGlobalResource { Daemon = true },
		};

		client.StartTransactionAsync(10, Arg.Any<CancellationToken>()).Returns(new Generated.Transaction
		{
			Id = "tx-1",
			_version = 10,
			Status = Generated.TransactionStatus.In_progress,
		});
		client.GetConfigurationVersionAsync("tx-1", Arg.Any<CancellationToken>()).Returns(10);
		client.GetGlobalAsync("tx-1", true, Arg.Any<CancellationToken>()).Returns(new Generated.Global { Daemon = false });
		client.GetDefaultsSectionsAsync("tx-1", true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync("tx-1", true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync("tx-1", true, Arg.Any<CancellationToken>()).Returns([]);

		var result = await service.ValidateConfig(desired);

		result.IsValid.ShouldBeTrue();
		await client.Received(1).StartTransactionAsync(10, Arg.Any<CancellationToken>());
		await client.Received(1).ReplaceGlobalAsync(
			Arg.Is<Generated.Global>(x => x.Daemon == true),
			"tx-1",
			null,
			null,
			true,
			Arg.Any<CancellationToken>());
		await client.Received(1).DeleteTransactionAsync("tx-1", Arg.Any<CancellationToken>());
		await client.DidNotReceive().CommitTransactionAsync(Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task SaveConfig_commits_transaction_after_resource_creation()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = new HaproxyService(client, NullLogger<HaproxyService>.Instance);
		var desired = new HaproxyResourceSnapshot
		{
			Version = 15,
			Global = new HaproxyGlobalResource(),
			Backends =
			[
				new HaproxyBackendResource
				{
					Name = "be_new",
					Mode = "http",
					AdvCheck = "tcp-check",
				},
			],
		};

		client.StartTransactionAsync(15, Arg.Any<CancellationToken>()).Returns(new Generated.Transaction
		{
			Id = "tx-2",
			_version = 15,
			Status = Generated.TransactionStatus.In_progress,
		});
		client.GetConfigurationVersionAsync("tx-2", Arg.Any<CancellationToken>()).Returns(15);
		client.GetGlobalAsync("tx-2", true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync("tx-2", true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync("tx-2", true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync("tx-2", true, Arg.Any<CancellationToken>()).Returns([]);
		client.CommitTransactionAsync("tx-2", Arg.Any<bool?>(), Arg.Any<CancellationToken>()).Returns(new Generated.Transaction
		{
			Id = "tx-2",
			_version = 16,
			Status = Generated.TransactionStatus.Success,
		});
		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(16);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([new Generated.Backend { Name = "be_new", Mode = Generated.Backend_baseMode.Http }]);
		client.GetAllServerBackendAsync("be_new", null, Arg.Any<CancellationToken>()).Returns([]);

		var saved = await service.SaveConfig(desired);

		await client.Received(1).CreateBackendAsync(
			Arg.Is<Generated.Backend>(x => x.Name == "be_new" && x.Adv_check == Generated.Backend_baseAdv_check.TcpCheck),
			"tx-2",
			null,
			null,
			true,
			Arg.Any<CancellationToken>());
		await client.Received(1).CommitTransactionAsync("tx-2", Arg.Any<bool?>(), Arg.Any<CancellationToken>());
		await client.DidNotReceive().DeleteTransactionAsync("tx-2", Arg.Any<CancellationToken>());
		saved.Version.ShouldBe(16);
		saved.Backends.Single().Name.ShouldBe("be_new");
	}

	[Fact]
	public async Task ValidateConfig_replaces_backend_when_advanced_check_changes()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = new HaproxyService(client, NullLogger<HaproxyService>.Instance);
		var desired = new HaproxyResourceSnapshot
		{
			Version = 10,
			Global = new HaproxyGlobalResource { Daemon = true },
			Backends =
			[
				new HaproxyBackendResource
				{
					Name = "be_main",
					Mode = "tcp",
					Balance = "roundrobin",
					AdvCheck = "tcp-check",
				},
			],
		};

		client.StartTransactionAsync(10, Arg.Any<CancellationToken>()).Returns(new Generated.Transaction
		{
			Id = "tx-3",
			_version = 10,
			Status = Generated.TransactionStatus.In_progress,
		});
		client.GetConfigurationVersionAsync("tx-3", Arg.Any<CancellationToken>()).Returns(10);
		client.GetGlobalAsync("tx-3", true, Arg.Any<CancellationToken>()).Returns(new Generated.Global { Daemon = true });
		client.GetDefaultsSectionsAsync("tx-3", true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync("tx-3", true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync("tx-3", true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Backend
			{
				Name = "be_main",
				Mode = Generated.Backend_baseMode.Tcp,
				Balance = new Generated.Balance { Algorithm = Generated.BalanceAlgorithm.Roundrobin },
			},
		]);
		client.GetAllServerBackendAsync("be_main", "tx-3", Arg.Any<CancellationToken>()).Returns([]);

		var result = await service.ValidateConfig(desired);

		result.IsValid.ShouldBeTrue();
		await client.Received(1).ReplaceBackendAsync(
			"be_main",
			Arg.Is<Generated.Backend>(x => x.Adv_check == Generated.Backend_baseAdv_check.TcpCheck),
			"tx-3",
			null,
			null,
			true,
			Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task GetDashboardSnapshot_aggregates_runtime_health_stats_and_alerts()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = new HaproxyService(client, NullLogger<HaproxyService>.Instance);

		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(21);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global { Daemon = true });
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Frontend { Name = "fe_main", Mode = Generated.Frontend_baseMode.Http, Default_backend = "be_missing" },
		]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Backend { Name = "be_main", Mode = Generated.Backend_baseMode.Http },
		]);
		client.GetAllBindFrontendAsync("fe_main", null, Arg.Any<CancellationToken>()).Returns([]);
		client.GetAllAclFrontendAsync("fe_main", null, null, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendSwitchingRulesAsync("fe_main", null, Arg.Any<CancellationToken>()).Returns([]);
		client.GetAllServerBackendAsync("be_main", null, Arg.Any<CancellationToken>()).Returns([
			new Generated.Server { Name = "app_1", Address = "10.0.0.10", Port = 8080 },
			new Generated.Server { Name = "app_2", Address = "10.0.0.11", Port = 8080 },
		]);

		client.GetHealthAsync(Arg.Any<CancellationToken>()).Returns(new Generated.Health
		{
			Haproxy = Generated.HealthHaproxy.Down,
		});
		client.GetStatsAsync(null, null, null, Arg.Any<CancellationToken>()).Returns(new Generated.Native_stats
		{
			Stats =
			[
				new Generated.Native_stat
				{
					Backend_name = "be_main",
					Name = "be_main",
					Type = Generated.Native_statType.Backend,
					Stats = new Generated.Native_stat_stats
					{
						Status = Generated.Native_stat_statsStatus.UP,
						Scur = 5,
						Rate = 11,
						Bin = 100,
						Bout = 250,
					},
				},
				new Generated.Native_stat
				{
					Backend_name = "be_main",
					Name = "app_1",
					Type = Generated.Native_statType.Server,
					Stats = new Generated.Native_stat_stats
					{
						Status = Generated.Native_stat_statsStatus.UP,
						Check_status = Generated.Native_stat_statsCheck_status.L7OK,
						Scur = 3,
						Rate = 7,
					},
				},
				new Generated.Native_stat
				{
					Backend_name = "be_main",
					Name = "app_2",
					Type = Generated.Native_statType.Server,
					Stats = new Generated.Native_stat_stats
					{
						Status = Generated.Native_stat_statsStatus.DOWN,
						Check_status = Generated.Native_stat_statsCheck_status.L4TOUT,
						Scur = 0,
						Rate = 0,
					},
				},
			],
		});
		client.GetAllRuntimeServerAsync("be_main", Arg.Any<CancellationToken>()).Returns([
			new Generated.Runtime_server
			{
				Name = "app_1",
				Address = "10.0.0.10",
				Port = 8080,
				Admin_state = Generated.Runtime_serverAdmin_state.Ready,
				Operational_state = Generated.Runtime_serverOperational_state.Up,
			},
			new Generated.Runtime_server
			{
				Name = "app_2",
				Address = "10.0.0.11",
				Port = 8080,
				Admin_state = Generated.Runtime_serverAdmin_state.Ready,
				Operational_state = Generated.Runtime_serverOperational_state.Down,
			},
		]);

		var result = await service.GetDashboardSnapshot();

		result.Summary.RuntimeStatus.ShouldBe(RuntimeStatus.Down);
		result.Summary.Routes.Value.ShouldBe(0);
		result.Summary.Services.Value.ShouldBe(1);
		result.Backends.Count.ShouldBe(1);
		result.Backends[0].Status.ShouldBe(RuntimeStatus.Degraded);
		result.Backends[0].DownServers.ShouldBe(1);
		result.Backends[0].HealthyServers.ShouldBe(1);
		result.Backends[0].Servers[1].CheckStatus.ShouldBe("l4tout");
		result.Alerts.ShouldContain(x => x.Id == "haproxy-health" && x.Severity == DashboardAlertSeverity.Critical);
		result.Alerts.ShouldContain(x => x.Id == "frontend-default-fe_main");
		result.Alerts.ShouldContain(x => x.Id == "backend-runtime-be_main");
	}

	[Fact]
	public async Task GetConfig_wraps_data_plane_errors_with_actionable_details()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = new HaproxyService(client, NullLogger<HaproxyService>.Instance);
		var headers = new Dictionary<string, IEnumerable<string>>();

		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>())
			.Returns(Task.FromException<int>(new Generated.ApiException(
				"General Error",
				400,
				"Client sent an HTTP request to an HTTPS server.",
				headers,
				null)));
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global { Daemon = true });
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);

		var exception = await Should.ThrowAsync<UpstreamDependencyException>(() => service.GetConfig());

		exception.Message.ShouldContain("HAProxy Data Plane API error while loading HAProxy configuration");
		exception.Message.ShouldContain("expects HTTPS");
	}
}
