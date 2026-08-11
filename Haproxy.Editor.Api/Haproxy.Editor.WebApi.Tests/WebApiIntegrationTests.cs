using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Haproxy.Editor.Abstractions.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Shouldly;
using Xunit;

namespace Haproxy.Editor.WebApi.Tests;

public class WebApiIntegrationTests : IAsyncLifetime
{
	private readonly IContainer _container = new ContainerBuilder("wiremock/wiremock:3.9.1")
		.WithPortBinding(8080, true)
		.WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(8080))
		.Build();

	private HttpClient _adminClient = null!;
	private Exception? _containerStartupException;

	public async Task InitializeAsync()
	{
		try
		{
			await _container.StartAsync();
			_adminClient = new HttpClient { BaseAddress = new Uri($"http://localhost:{_container.GetMappedPublicPort(8080)}/") };
			await ConfigureMappings();
		}
		catch (Exception ex)
		{
			_containerStartupException = ex;
		}
	}

	public async Task DisposeAsync()
	{
		_adminClient?.Dispose();
		await _container.DisposeAsync();
	}

	[Fact]
	public async Task Config_endpoints_work_against_a_testcontainer_backed_data_plane_stub()
	{
		if (_containerStartupException is not null)
		{
			if (IsDockerUnavailable(_containerStartupException))
			{
				return;
			}

			throw new InvalidOperationException("Testcontainer startup failed for a reason other than Docker availability.", _containerStartupException);
		}

		await using var factory = new TestWebApplicationFactory(_container.GetMappedPublicPort(8080));
		using var client = factory.CreateClient();

		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("TestScheme");

		var configResponse = await client.GetAsync("/config");
		configResponse.StatusCode.ShouldBe(HttpStatusCode.OK, await BuildFailureDetails(configResponse));

		var snapshot = await configResponse.Content.ReadFromJsonAsync<HaproxyResourceSnapshot>();
		snapshot.ShouldNotBeNull();
		snapshot.Version.ShouldBe(1);
		snapshot.Frontends.Count.ShouldBe(1);
		snapshot.Backends.Count.ShouldBe(1);

		var validateResponse = await client.PostAsJsonAsync("/config/validate", snapshot);
		validateResponse.StatusCode.ShouldBe(
			HttpStatusCode.NoContent,
			await BuildFailureDetails(validateResponse));

		var dashboardResponse = await client.GetAsync("/dashboard");
		dashboardResponse.StatusCode.ShouldBe(
			HttpStatusCode.OK,
			await BuildFailureDetails(dashboardResponse));

		var dashboard = await dashboardResponse.Content.ReadFromJsonAsync<DashboardSnapshot>();
		dashboard.ShouldNotBeNull();
		dashboard.Summary.RuntimeStatus.ShouldBe(RuntimeStatus.Up);
		dashboard.Backends.Count.ShouldBe(1);
		dashboard.Backends[0].HealthyServers.ShouldBe(1);
	}

	private async Task<string?> BuildFailureDetails(HttpResponseMessage response)
	{
		if (response.IsSuccessStatusCode)
		{
			return null;
		}

		return $"Response: {await response.Content.ReadAsStringAsync()}\nWireMock requests: {await _adminClient.GetStringAsync("__admin/requests")}";
	}

	[Fact]
	public async Task Schema_endpoint_advertises_advanced_fields_and_marks_the_dangerous_ones_read_only()
	{
		await using var factory = new TestWebApplicationFactory(1);
		using var client = factory.CreateClient();

		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("TestScheme");

		var response = await client.GetAsync("/schema");
		response.StatusCode.ShouldBe(HttpStatusCode.OK);

		var schema = await response.Content.ReadFromJsonAsync<HaproxySchema>();
		schema.ShouldNotBeNull();

		var backend = schema.Sections.Single(section => section.Name == HaproxySchemaSections.Backend);
		backend.Fields.ShouldContain(field => field.Name == "retries" && field.Type == HaproxySchemaFieldTypes.Number && field.Writable);
		backend.Fields.ShouldContain(field => field.Name == "external_check_command" && !field.Writable);
		// Modelled fields are edited through their own controls, and child collections are reconciled separately.
		string[] backendOwned = ["name", "mode", "balance", "adv_check", "default_server", "servers"];
		backend.Fields.Select(field => field.Name).Intersect(backendOwned).ShouldBeEmpty();

		var server = schema.Sections.Single(section => section.Name == HaproxySchemaSections.Server);
		server.Fields.ShouldContain(field => field.Name == "sni");
		server.Fields.Select(field => field.Name).Intersect(["ssl", "verify"]).ShouldBeEmpty();

		schema.Sections.Select(section => section.Name).ShouldBe(
			[
				HaproxySchemaSections.Backend,
				HaproxySchemaSections.Server,
				HaproxySchemaSections.DefaultServer,
				HaproxySchemaSections.Frontend,
				HaproxySchemaSections.Bind,
			],
			ignoreOrder: true);
	}

	[Fact]
	public async Task Mcp_publishes_protected_resource_metadata_and_challenges_unauthenticated_clients()
	{
		await using var factory = new TestWebApplicationFactory(1);
		using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
		{
			AllowAutoRedirect = false,
		});

		var metadataResponse = await client.GetAsync("/.well-known/oauth-protected-resource/mcp");
		metadataResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

		using var metadata = JsonDocument.Parse(await metadataResponse.Content.ReadAsStringAsync());
		metadata.RootElement.GetProperty("resource").GetString()
			.ShouldBe("https://api.haproxy.system.elylan/mcp");
		metadata.RootElement.GetProperty("authorization_servers")[0].GetString()
			.ShouldBe("https://auth.elyspio.fr/realms/internal");
		metadata.RootElement.GetProperty("scopes_supported")[0].GetString()
			.ShouldBe("haproxy:quickmap:manage");
		metadata.RootElement.GetProperty("bearer_methods_supported")[0].GetString().ShouldBe("header");

		var mcpResponse = await client.PostAsync("/mcp", new StringContent(
			"""{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}""",
			Encoding.UTF8,
			"application/json"));
		mcpResponse.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
		mcpResponse.Headers.WwwAuthenticate.Single().ToString().ShouldBe(
			"Bearer resource_metadata=\"https://api.haproxy.system.elylan/.well-known/oauth-protected-resource/mcp\", scope=\"haproxy:quickmap:manage\"");
	}

	private static bool IsDockerUnavailable(Exception exception)
	{
		var message = exception.ToString();
		return message.Contains("Docker", StringComparison.OrdinalIgnoreCase)
			|| message.Contains("named pipe", StringComparison.OrdinalIgnoreCase)
			|| message.Contains("timed out", StringComparison.OrdinalIgnoreCase)
			|| message.Contains("No such file", StringComparison.OrdinalIgnoreCase);
	}

	private async Task ConfigureMappings()
	{
		await AddJsonMapping("GET", "/v3/services/haproxy/configuration/version", 1L);
		await AddJsonMapping("GET", "/v3/services/haproxy/configuration/version", 1L, new Dictionary<string, string> { ["transaction_id"] = "tx-1" });
		await AddJsonMapping(
			"POST",
			"/v3/services/haproxy/transactions",
			new { id = "tx-1", _version = 1L, status = "in_progress" },
			new Dictionary<string, string> { ["version"] = "1" },
			statusCode: 201);
		await AddJsonMapping("DELETE", "/v3/services/haproxy/transactions/tx-1", null, statusCode: 204);
		await AddJsonMapping("GET", "/v3/health", new { haproxy = "up" });
		await AddJsonMapping("GET", "/v3/services/haproxy/stats/native", new
		{
			stats = new object[]
			{
				new
				{
					backend_name = "be_main",
					name = "be_main",
					type = "backend",
					stats = new
					{
						status = "UP",
						scur = 2,
						rate = 4,
						bin = 128,
						bout = 512,
					},
				},
				new
				{
					backend_name = "be_main",
					name = "app_1",
					type = "server",
					stats = new
					{
						status = "UP",
						check_status = "L7OK",
						scur = 2,
						rate = 4,
					},
				},
			},
		});

		var global = new { daemon = true };
		var defaults = new[] { new { name = "defaults_main", mode = "http" } };
		var frontends = new[] { new { name = "fe_main", mode = "http" } };
		var backends = new[] { new { name = "be_main", mode = "http" } };
		var binds = new[] { new { name = "public", address = "127.0.0.1", port = 80 } };
		var acls = new[] { new { acl_name = "host_acl", criterion = "hdr(host)", value = "example.com" } };
		var rules = new[] { new { name = "be_main", cond = "if", cond_test = "host_acl" } };
		var servers = new[] { new { name = "app_1", address = "10.0.0.10", port = 8080 } };

		foreach (var query in new[] { (Dictionary<string, string>?)null, new Dictionary<string, string> { ["transaction_id"] = "tx-1" } })
		{
			await AddJsonMapping("GET", "/v3/services/haproxy/configuration/global", global, query, new Dictionary<string, string> { ["full_section"] = "true" });
			await AddJsonMapping("GET", "/v3/services/haproxy/configuration/defaults", defaults, query, new Dictionary<string, string> { ["full_section"] = "true" });
			await AddJsonMapping("GET", "/v3/services/haproxy/configuration/frontends", frontends, query, new Dictionary<string, string> { ["full_section"] = "true" });
			await AddJsonMapping("GET", "/v3/services/haproxy/configuration/backends", backends, query, new Dictionary<string, string> { ["full_section"] = "true" });
			await AddJsonMapping("GET", "/v3/services/haproxy/configuration/frontends/fe_main/binds", binds, query);
			await AddJsonMapping("GET", "/v3/services/haproxy/configuration/frontends/fe_main/acls", acls, query);
			await AddJsonMapping("GET", "/v3/services/haproxy/configuration/frontends/fe_main/backend_switching_rules", rules, query);
			await AddJsonMapping("GET", "/v3/services/haproxy/configuration/backends/be_main/servers", servers, query);
		}

		await AddJsonMapping("GET", "/v3/services/haproxy/runtime/backends/be_main/servers", new[]
		{
			new
			{
				name = "app_1",
				address = "10.0.0.10",
				port = 8080,
				admin_state = "ready",
				operational_state = "up",
			},
		});
	}

	private async Task AddJsonMapping(
		string method,
		string path,
		object? body,
		Dictionary<string, string>? query = null,
		Dictionary<string, string>? additionalQuery = null,
		int statusCode = 200)
	{
		var allQuery = new Dictionary<string, string>();
		if (query is not null)
		{
			foreach (var pair in query)
			{
				allQuery[pair.Key] = pair.Value;
			}
		}

		if (additionalQuery is not null)
		{
			foreach (var pair in additionalQuery)
			{
				allQuery[pair.Key] = pair.Value;
			}
		}

		var request = new Dictionary<string, object?>
		{
			["method"] = method,
			["urlPath"] = path,
		};

		if (allQuery.Count > 0)
		{
			request["queryParameters"] = allQuery.ToDictionary(x => x.Key, x => (object)new { equalTo = x.Value });
		}

		var response = new Dictionary<string, object?>
		{
			["status"] = statusCode,
		};

		if (body is not null)
		{
			response["jsonBody"] = body;
		}

		var payload = new Dictionary<string, object?>
		{
			["request"] = request,
			["response"] = response,
		};

		var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
		var result = await _adminClient.PostAsync("__admin/mappings", content);
		result.EnsureSuccessStatusCode();
	}

	private sealed class TestWebApplicationFactory : WebApplicationFactory<Program>
	{
		private readonly int _wireMockPort;

		public TestWebApplicationFactory(int wireMockPort)
		{
			_wireMockPort = wireMockPort;
		}

		protected override void ConfigureWebHost(IWebHostBuilder builder)
		{
			builder.ConfigureAppConfiguration((_, configBuilder) =>
			{
				configBuilder.AddInMemoryCollection(new Dictionary<string, string?>
				{
					["App:DataPlaneApi:BaseUrl"] = $"http://localhost:{_wireMockPort}/v3",
					["App:DataPlaneApi:IgnoreTlsErrors"] = "true",
					["App:DataPlaneApi:TimeoutSeconds"] = "30",
					["Oidc:Audience"] = "haproxy-editor",
					["Oidc:Issuer"] = "https://issuer.example.test",
					["ConnectionStrings:MongoDB"] = "mongodb://localhost:27017/haproxy-editor-tests",
				});
			});

			builder.ConfigureTestServices(services =>
			{
				services.AddAuthentication(options =>
					{
						options.DefaultAuthenticateScheme = "TestScheme";
						options.DefaultChallengeScheme = "TestScheme";
					})
					.AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", _ => { });
			});
		}
	}

	private sealed class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
	{
		public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
			: base(options, logger, encoder)
		{
		}

		protected override Task<AuthenticateResult> HandleAuthenticateAsync()
		{
			var identity = new ClaimsIdentity([new Claim(ClaimTypes.Name, "test-user")], Scheme.Name);
			var principal = new ClaimsPrincipal(identity);
			var ticket = new AuthenticationTicket(principal, Scheme.Name);
			return Task.FromResult(AuthenticateResult.Success(ticket));
		}
	}
}
