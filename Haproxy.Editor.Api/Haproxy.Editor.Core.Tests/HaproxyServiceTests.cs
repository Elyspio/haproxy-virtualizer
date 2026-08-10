using System.Net.Http;
using System.Collections.Concurrent;
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
		var service = CreateService(client);

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
		var service = CreateService(client);
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
			Arg.Is<Generated.Global>(x => x != null && x.Daemon == true),
			"tx-1",
			null,
			null,
			false,
			Arg.Any<CancellationToken>());
		await client.Received(1).DeleteTransactionAsync("tx-1", Arg.Any<CancellationToken>());
		await client.DidNotReceive().CommitTransactionAsync(Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task SaveConfig_commits_transaction_after_resource_creation()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
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
			Arg.Is<Generated.Backend>(x => x != null && x.Name == "be_new" && x.Adv_check == Generated.Backend_baseAdv_check.TcpCheck),
			"tx-2",
			null,
			null,
			false,
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
		var service = CreateService(client);
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
			Arg.Is<Generated.Backend>(x => x != null && x.Adv_check == Generated.Backend_baseAdv_check.TcpCheck),
			"tx-3",
			null,
			null,
			false,
			Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task GetDashboardSnapshot_aggregates_runtime_health_stats_and_alerts()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);

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
		var service = CreateService(client);
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

	[Fact]
	public async Task GetConfig_carries_unmodelled_fields_ssl_options_and_default_server()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);

		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(3);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Backend
			{
				Name = "be_main",
				Mode = Generated.Backend_baseMode.Http,
				Retries = 5,
				Connect_timeout = 4000,
				Default_server = new Generated.Server_params
				{
					Ssl = Generated.Server_paramsSsl.Enabled,
					Verify = Generated.Server_paramsVerify.None,
					Maxconn = 40,
				},
			},
		]);
		client.GetAllServerBackendAsync("be_main", null, Arg.Any<CancellationToken>()).Returns([
			new Generated.Server
			{
				Name = "app_1",
				Address = "10.0.0.10",
				Port = 443,
				Ssl = Generated.Server_paramsSsl.Enabled,
				Verify = Generated.Server_paramsVerify.None,
				Maxconn = 20,
			},
		]);

		var backend = (await service.GetConfig()).Backends.Single();

		backend.Extra.ShouldBe("""{"connect_timeout":4000,"retries":5}""");
		backend.DefaultServer.ShouldNotBeNull();
		backend.DefaultServer.Ssl.ShouldBe("enabled");
		backend.DefaultServer.Verify.ShouldBe("none");
		backend.DefaultServer.Extra.ShouldBe("""{"maxconn":40}""");
		backend.Servers.Single().Ssl.ShouldBe("enabled");
		backend.Servers.Single().Verify.ShouldBe("none");
		backend.Servers.Single().Extra.ShouldBe("""{"maxconn":20}""");
	}

	[Fact]
	public async Task SaveConfig_keeps_unmodelled_backend_and_server_fields_when_a_modelled_one_changes()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		var desired = new HaproxyResourceSnapshot
		{
			Version = 20,
			Backends =
			[
				new HaproxyBackendResource
				{
					Name = "be_main",
					Mode = "http",
					Balance = "leastconn",
					Extra = """{"retries":5}""",
					Servers =
					[
						new HaproxyServerResource
						{
							Name = "app_1",
							Address = "10.0.0.10",
							Port = 443,
							Ssl = "enabled",
							Verify = "none",
							Extra = """{"maxconn":20}""",
						},
					],
				},
			],
		};

		StubTransaction(client, "tx-4", 20);
		client.GetBackendsAsync("tx-4", true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Backend
			{
				Name = "be_main",
				Mode = Generated.Backend_baseMode.Http,
				Balance = new Generated.Balance { Algorithm = Generated.BalanceAlgorithm.Roundrobin },
				Retries = 5,
			},
		]);
		client.GetAllServerBackendAsync("be_main", "tx-4", Arg.Any<CancellationToken>()).Returns([
			new Generated.Server { Name = "app_1", Address = "10.0.0.10", Port = 443, Maxconn = 20 },
		]);
		StubReload(client, 21);

		await service.SaveConfig(desired);

		await client.Received(1).ReplaceBackendAsync(
			"be_main",
			Arg.Is<Generated.Backend>(x => x != null && x.Retries == 5 && x.Balance!.Algorithm == Generated.BalanceAlgorithm.Leastconn),
			"tx-4",
			null,
			null,
			false,
			Arg.Any<CancellationToken>());
		await client.Received(1).ReplaceServerBackendAsync(
			"app_1",
			"be_main",
			Arg.Is<Generated.Server>(x => x != null && x.Maxconn == 20
			                              && x.Ssl == Generated.Server_paramsSsl.Enabled
			                              && x.Verify == Generated.Server_paramsVerify.None),
			"tx-4",
			null,
			null,
			Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task SaveConfig_ignores_a_reordered_extra_payload()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		var desired = new HaproxyResourceSnapshot
		{
			Version = 20,
			Backends = [new HaproxyBackendResource { Name = "be_main", Mode = "http", Extra = """{ "retries": 5, "connect_timeout": 4000 }""" }],
		};

		StubTransaction(client, "tx-5", 20);
		client.GetBackendsAsync("tx-5", true, Arg.Any<CancellationToken>()).Returns([
			new Generated.Backend { Name = "be_main", Mode = Generated.Backend_baseMode.Http, Retries = 5, Connect_timeout = 4000 },
		]);
		client.GetAllServerBackendAsync("be_main", "tx-5", Arg.Any<CancellationToken>()).Returns([]);
		StubReload(client, 20);

		await service.SaveConfig(desired);

		await client.DidNotReceive().ReplaceBackendAsync(
			Arg.Any<string>(),
			Arg.Any<Generated.Backend>(),
			Arg.Any<string>(),
			Arg.Any<int?>(),
			Arg.Any<bool?>(),
			Arg.Any<bool?>(),
			Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task SaveConfig_refuses_an_unknown_advanced_field()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		var desired = new HaproxyResourceSnapshot
		{
			Version = 20,
			Backends = [new HaproxyBackendResource { Name = "be_main", Extra = """{"not_a_haproxy_field":1}""" }],
		};

		StubTransaction(client, "tx-6", 20);
		client.GetBackendsAsync("tx-6", true, Arg.Any<CancellationToken>()).Returns([]);

		var exception = await Should.ThrowAsync<RequestValidationException>(() => service.SaveConfig(desired));

		exception.Message.ShouldContain("not_a_haproxy_field");
		await client.Received(1).DeleteTransactionAsync("tx-6", Arg.Any<CancellationToken>());
		await client.DidNotReceive().CommitTransactionAsync(Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task SaveConfig_refuses_to_change_a_denied_advanced_field_but_preserves_it()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		var baseline = new Generated.Backend
		{
			Name = "be_main",
			Mode = Generated.Backend_baseMode.Http,
			External_check_command = "/usr/bin/check",
		};

		StubTransaction(client, "tx-7", 20);
		client.GetBackendsAsync("tx-7", true, Arg.Any<CancellationToken>()).Returns([baseline]);
		client.GetAllServerBackendAsync("be_main", "tx-7", Arg.Any<CancellationToken>()).Returns([]);
		StubReload(client, 20);

		var attack = new HaproxyResourceSnapshot
		{
			Version = 20,
			Backends = [new HaproxyBackendResource { Name = "be_main", Mode = "http", Extra = """{"external_check_command":"/bin/sh"}""" }],
		};

		var exception = await Should.ThrowAsync<RequestValidationException>(() => service.SaveConfig(attack));
		exception.Message.ShouldContain("external_check_command");

		var untouched = new HaproxyResourceSnapshot
		{
			Version = 20,
			Backends = [new HaproxyBackendResource { Name = "be_main", Mode = "tcp", Extra = """{"external_check_command":"/usr/bin/check"}""" }],
		};

		await service.SaveConfig(untouched);

		await client.Received(1).ReplaceBackendAsync(
			"be_main",
			Arg.Is<Generated.Backend>(x => x != null && x.External_check_command == "/usr/bin/check" && x.Mode == Generated.Backend_baseMode.Tcp),
			"tx-7",
			null,
			null,
			false,
			Arg.Any<CancellationToken>());
	}

	[Fact]
	public async Task GetConfig_treats_a_null_collection_answer_as_an_empty_section()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);

		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(1);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([new Generated.Backend { Name = "be_empty" }]);

		// A backend without servers makes the Data Plane API answer the JSON literal `null` under HTTP 200, which the
		// generated client surfaces as an exception rather than an empty list.
		client.GetAllServerBackendAsync("be_empty", null, Arg.Any<CancellationToken>())
			.Returns(Task.FromException<ICollection<Generated.Server>>(new Generated.ApiException(
				"Response was null which was not expected.",
				200,
				"null",
				new Dictionary<string, IEnumerable<string>>(),
				null)));

		var result = await service.GetConfig();

		result.Backends.Single().Name.ShouldBe("be_empty");
		result.Backends.Single().Servers.ShouldBeEmpty();
	}

	[Fact]
	public async Task GetConfig_propagates_a_malformed_http_200_collection_answer()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);

		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(1);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([new Generated.Backend { Name = "be_invalid" }]);
		client.GetAllServerBackendAsync("be_invalid", null, Arg.Any<CancellationToken>())
			.Returns(Task.FromException<ICollection<Generated.Server>>(new Generated.ApiException(
				"Could not deserialize the response body.",
				200,
				"{ malformed",
				new Dictionary<string, IEnumerable<string>>(),
				null)));

		var exception = await Should.ThrowAsync<UpstreamDependencyException>(() => service.GetConfig());

		exception.Message.ShouldContain("{ malformed");
	}

	[Theory]
	[MemberData(nameof(InvalidEnumSnapshots))]
	public async Task SaveConfig_rejects_every_unsupported_nonblank_enum_without_committing(
		string invalidValue,
		HaproxyResourceSnapshot desired)
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		StubTransaction(client, "tx-enum", 30);

		var exception = await Should.ThrowAsync<RequestValidationException>(() => service.SaveConfig(desired));

		exception.Message.ShouldContain(invalidValue);
		await client.Received(1).DeleteTransactionAsync("tx-enum", Arg.Any<CancellationToken>());
		await client.DidNotReceive().CommitTransactionAsync(Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<CancellationToken>());
	}

	public static IEnumerable<object[]> InvalidEnumSnapshots()
	{
		yield return InvalidEnumSnapshot("invalid-defaults-mode", new HaproxyResourceSnapshot
		{
			Version = 30,
			Defaults = [new HaproxyDefaultsResource { Name = "defaults", Mode = "invalid-defaults-mode" }],
		});
		yield return InvalidEnumSnapshot("invalid-frontend-mode", new HaproxyResourceSnapshot
		{
			Version = 30,
			Frontends = [new HaproxyFrontendResource { Name = "frontend", Mode = "invalid-frontend-mode" }],
		});
		yield return InvalidEnumSnapshot("invalid-backend-mode", BackendSnapshot(new HaproxyBackendResource
		{
			Name = "backend",
			Mode = "invalid-backend-mode",
		}));
		yield return InvalidEnumSnapshot("invalid-advanced-check", BackendSnapshot(new HaproxyBackendResource
		{
			Name = "backend",
			AdvCheck = "invalid-advanced-check",
		}));
		yield return InvalidEnumSnapshot("invalid-balance", BackendSnapshot(new HaproxyBackendResource
		{
			Name = "backend",
			Balance = "invalid-balance",
		}));
		yield return InvalidEnumSnapshot("invalid-default-ssl", BackendSnapshot(new HaproxyBackendResource
		{
			Name = "backend",
			DefaultServer = new HaproxyDefaultServerResource { Ssl = "invalid-default-ssl" },
		}));
		yield return InvalidEnumSnapshot("invalid-default-verify", BackendSnapshot(new HaproxyBackendResource
		{
			Name = "backend",
			DefaultServer = new HaproxyDefaultServerResource { Verify = "invalid-default-verify" },
		}));
		yield return InvalidEnumSnapshot("invalid-rule-condition", new HaproxyResourceSnapshot
		{
			Version = 30,
			Frontends =
			[
				new HaproxyFrontendResource
				{
					Name = "frontend",
					BackendSwitchingRules =
					[
						new HaproxyBackendSwitchingRuleResource
						{
							BackendName = "backend",
							Cond = "invalid-rule-condition",
						},
					],
				},
			],
		});
		yield return InvalidEnumSnapshot("invalid-server-check", BackendWithServer(new HaproxyServerResource
		{
			Name = "server",
			Check = "invalid-server-check",
		}));
		yield return InvalidEnumSnapshot("invalid-server-ssl", BackendWithServer(new HaproxyServerResource
		{
			Name = "server",
			Ssl = "invalid-server-ssl",
		}));
		yield return InvalidEnumSnapshot("invalid-server-verify", BackendWithServer(new HaproxyServerResource
		{
			Name = "server",
			Verify = "invalid-server-verify",
		}));
	}

	private static object[] InvalidEnumSnapshot(string invalidValue, HaproxyResourceSnapshot snapshot)
	{
		return [invalidValue, snapshot];
	}

	private static HaproxyResourceSnapshot BackendSnapshot(HaproxyBackendResource backend)
	{
		return new HaproxyResourceSnapshot { Version = 30, Backends = [backend] };
	}

	private static HaproxyResourceSnapshot BackendWithServer(HaproxyServerResource server)
	{
		return BackendSnapshot(new HaproxyBackendResource { Name = "backend", Servers = [server] });
	}

	[Fact]
	public async Task GetConfig_bounds_parallel_child_reads_and_returns_every_resource()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		var activeReads = 0;
		var maximumReads = 0;
		var completedReads = 0;
		var frontends = Enumerable.Range(0, 12)
			.Select(index => new Generated.Frontend { Name = $"frontend-{index:D2}" })
			.ToArray();
		var backends = Enumerable.Range(0, 12)
			.Select(index => new Generated.Backend { Name = $"backend-{index:D2}" })
			.ToArray();

		async Task<ICollection<T>> TrackRead<T>(ICollection<T> result)
		{
			var current = Interlocked.Increment(ref activeReads);
			var observed = Volatile.Read(ref maximumReads);
			while (current > observed)
			{
				observed = Interlocked.CompareExchange(ref maximumReads, current, observed);
			}

			try
			{
				await Task.Delay(25);
				return result;
			}
			finally
			{
				Interlocked.Decrement(ref activeReads);
				Interlocked.Increment(ref completedReads);
			}
		}

		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(1);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns(frontends);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns(backends);
		client.GetAllBindFrontendAsync(Arg.Any<string>(), null, Arg.Any<CancellationToken>())
			.Returns(_ => TrackRead<Generated.Bind>([new Generated.Bind { Name = "bind" }]));
		client.GetAllAclFrontendAsync(Arg.Any<string>(), null, null, Arg.Any<CancellationToken>())
			.Returns(_ => TrackRead<Generated.Acl>([new Generated.Acl { Acl_name = "acl" }]));
		client.GetBackendSwitchingRulesAsync(Arg.Any<string>(), null, Arg.Any<CancellationToken>())
			.Returns(_ => TrackRead<Generated.Backend_switching_rule>(
				[new Generated.Backend_switching_rule { Name = "backend-00" }]));
		client.GetAllServerBackendAsync(Arg.Any<string>(), null, Arg.Any<CancellationToken>())
			.Returns(_ => TrackRead<Generated.Server>([new Generated.Server { Name = "server" }]));

		var result = await service.GetConfig();

		maximumReads.ShouldBeLessThanOrEqualTo(8);
		maximumReads.ShouldBeGreaterThan(1);
		completedReads.ShouldBe(48);
		result.Frontends.Count.ShouldBe(12);
		result.Frontends.ShouldAllBe(frontend => frontend.Binds.Count == 1
		                                                && frontend.Acls.Count == 1
		                                                && frontend.BackendSwitchingRules.Count == 1);
		result.Backends.Count.ShouldBe(12);
		result.Backends.ShouldAllBe(backend => backend.Servers.Count == 1);
	}

	[Fact]
	public async Task GetConfig_propagates_cancellation_to_child_reads()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		var readStarted = new TaskCompletionSource<CancellationToken>(TaskCreationOptions.RunContinuationsAsynchronously);
		using var cancellation = new CancellationTokenSource();

		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(1);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([new Generated.Backend { Name = "backend" }]);
		client.GetAllServerBackendAsync("backend", null, Arg.Any<CancellationToken>()).Returns(call =>
		{
			var token = call.ArgAt<CancellationToken>(2);
			readStarted.TrySetResult(token);
			return WaitForCancellation<Generated.Server>(token);
		});

		var operation = service.GetConfig(cancellation.Token);
		var propagatedToken = await readStarted.Task.WaitAsync(TimeSpan.FromSeconds(2));
		cancellation.Cancel();

		await Should.ThrowAsync<OperationCanceledException>(async () =>
			await operation.WaitAsync(TimeSpan.FromSeconds(2)));
		propagatedToken.ShouldBe(cancellation.Token);
	}

	[Fact]
	public async Task SaveConfig_uses_an_independent_token_to_clean_up_after_request_cancellation()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		var writeStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
		var writeCompletion = new TaskCompletionSource<Generated.Global>(TaskCreationOptions.RunContinuationsAsynchronously);
		using var cancellation = new CancellationTokenSource();
		StubTransaction(client, "tx-cancel", 40);
		client.ReplaceGlobalAsync(
			Arg.Any<Generated.Global>(),
			"tx-cancel",
			null,
			null,
			false,
			Arg.Any<CancellationToken>()).Returns(writeCompletion.Task).AndDoes(call =>
		{
			var token = call.ArgAt<CancellationToken>(5);
			token.Register(() => writeCompletion.TrySetCanceled(token));
			writeStarted.TrySetResult();
		});

		var operation = service.SaveConfig(
			new HaproxyResourceSnapshot
			{
				Version = 40,
				Global = new HaproxyGlobalResource { Daemon = true },
			},
			cancellation.Token);
		await writeStarted.Task.WaitAsync(TimeSpan.FromSeconds(2));
		cancellation.Cancel();

		await Should.ThrowAsync<OperationCanceledException>(async () =>
			await operation.WaitAsync(TimeSpan.FromSeconds(2)));
		await client.Received(1).ReplaceGlobalAsync(
			Arg.Any<Generated.Global>(),
			"tx-cancel",
			null,
			null,
			false,
			cancellation.Token);
		await client.Received(1).DeleteTransactionAsync(
			"tx-cancel",
			Arg.Is<CancellationToken>(token => !token.CanBeCanceled));
	}

	[Fact]
	public async Task SaveConfig_finishes_the_canonical_reload_after_commit_when_the_request_is_canceled()
	{
		var client = Substitute.For<Generated.HaproxyClient>(new HttpClient());
		var service = CreateService(client);
		using var cancellation = new CancellationTokenSource();
		var reloadTokens = new ConcurrentBag<CancellationToken>();
		StubTransaction(client, "tx-committed", 50);
		client.GetBackendsAsync("tx-committed", true, Arg.Any<CancellationToken>()).Returns([]);
		client.CommitTransactionAsync("tx-committed", Arg.Any<bool?>(), Arg.Any<CancellationToken>()).Returns(_ =>
		{
			cancellation.Cancel();
			return new Generated.Transaction
			{
				Id = "tx-committed",
				_version = 51,
				Status = Generated.TransactionStatus.Success,
			};
		});
		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(call =>
		{
			reloadTokens.Add(call.ArgAt<CancellationToken>(1));
			return 51;
		});
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(call =>
		{
			reloadTokens.Add(call.ArgAt<CancellationToken>(2));
			return new Generated.Global();
		});
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns(call =>
		{
			reloadTokens.Add(call.ArgAt<CancellationToken>(2));
			return [];
		});
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns(call =>
		{
			reloadTokens.Add(call.ArgAt<CancellationToken>(2));
			return [];
		});
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns(call =>
		{
			reloadTokens.Add(call.ArgAt<CancellationToken>(2));
			return [];
		});

		var saved = await service.SaveConfig(new HaproxyResourceSnapshot { Version = 50 }, cancellation.Token);

		saved.Version.ShouldBe(51);
		reloadTokens.Count.ShouldBe(5);
		reloadTokens.ShouldAllBe(token => !token.CanBeCanceled);
	}

	private static async Task<ICollection<T>> WaitForCancellation<T>(CancellationToken cancellationToken)
	{
		await Task.Delay(Timeout.InfiniteTimeSpan, cancellationToken);
		return [];
	}

	private static HaproxyService CreateService(Generated.HaproxyClient client)
	{
		return new HaproxyService(client, new SchemaService(NullLogger<SchemaService>.Instance), NullLogger<HaproxyService>.Instance);
	}

	private static void StubTransaction(Generated.HaproxyClient client, string transactionId, int version)
	{
		client.StartTransactionAsync(version, Arg.Any<CancellationToken>()).Returns(new Generated.Transaction
		{
			Id = transactionId,
			_version = version,
			Status = Generated.TransactionStatus.In_progress,
		});
		client.GetConfigurationVersionAsync(transactionId, Arg.Any<CancellationToken>()).Returns(version);
		client.GetGlobalAsync(transactionId, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync(transactionId, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(transactionId, true, Arg.Any<CancellationToken>()).Returns([]);
		client.CommitTransactionAsync(transactionId, Arg.Any<bool?>(), Arg.Any<CancellationToken>()).Returns(new Generated.Transaction
		{
			Id = transactionId,
			_version = version + 1,
			Status = Generated.TransactionStatus.Success,
		});
	}

	private static void StubReload(Generated.HaproxyClient client, int version)
	{
		client.GetConfigurationVersionAsync(null, Arg.Any<CancellationToken>()).Returns(version);
		client.GetGlobalAsync(null, true, Arg.Any<CancellationToken>()).Returns(new Generated.Global());
		client.GetDefaultsSectionsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetFrontendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
		client.GetBackendsAsync(null, true, Arg.Any<CancellationToken>()).Returns([]);
	}
}
