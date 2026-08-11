using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Shouldly;
using Xunit;

namespace Haproxy.Editor.WebApi.Tests;

public sealed class McpProtocolIntegrationTests
{
	[Fact]
	public async Task Modern_discovery_and_tool_listing_are_stateless_structured_and_cacheable()
	{
		await using var factory = new McpWebApplicationFactory();
		using var client = factory.CreateClient();
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("TestScheme");

		var discoverResponse = await PostModern(client, "server/discover", id: 1);
		discoverResponse.StatusCode.ShouldBe(HttpStatusCode.OK, await discoverResponse.Content.ReadAsStringAsync());
		discoverResponse.Headers.Contains("Mcp-Session-Id").ShouldBeFalse();
		using var discover = JsonDocument.Parse(ExtractJson(await discoverResponse.Content.ReadAsStringAsync()));
		discover.RootElement.GetProperty("result").GetProperty("supportedVersions")
			.EnumerateArray().Select(item => item.GetString()).ShouldContain("2026-07-28");

		var toolsResponse = await PostModern(client, "tools/list", id: 2);
		toolsResponse.StatusCode.ShouldBe(HttpStatusCode.OK, await toolsResponse.Content.ReadAsStringAsync());
		toolsResponse.Headers.Contains("Mcp-Session-Id").ShouldBeFalse();
		using var toolsDocument = JsonDocument.Parse(ExtractJson(await toolsResponse.Content.ReadAsStringAsync()));
		var result = toolsDocument.RootElement.GetProperty("result");
		result.GetProperty("ttlMs").GetInt64().ShouldBe(3_600_000);
		result.GetProperty("cacheScope").GetString().ShouldBe("public");
		var tools = result.GetProperty("tools").EnumerateArray().ToArray();
		tools.Select(tool => tool.GetProperty("name").GetString()).ShouldBe(
		[
			"haproxy-editor_create",
			"haproxy-editor_delete",
			"haproxy-editor_discover",
			"haproxy-editor_get",
			"haproxy-editor_history",
			"haproxy-editor_list",
			"haproxy-editor_update",
		]);
		tools.All(tool => tool.TryGetProperty("outputSchema", out _)).ShouldBeTrue();
		var create = tools.Single(tool => tool.GetProperty("name").GetString() == "haproxy-editor_create");
		create.GetProperty("annotations").GetProperty("readOnlyHint").GetBoolean().ShouldBeFalse();
		create.GetProperty("annotations").GetProperty("destructiveHint").GetBoolean().ShouldBeFalse();
		create.GetProperty("outputSchema").GetProperty("required").EnumerateArray()
			.Select(property => property.GetString()).ShouldContain("updated");
		var delete = tools.Single(tool => tool.GetProperty("name").GetString() == "haproxy-editor_delete");
		delete.GetProperty("annotations").GetProperty("destructiveHint").GetBoolean().ShouldBeTrue();
		delete.GetProperty("annotations").GetProperty("idempotentHint").GetBoolean().ShouldBeTrue();
	}

	[Fact]
	public async Task Legacy_initialize_is_still_negotiated()
	{
		await using var factory = new McpWebApplicationFactory();
		using var client = factory.CreateClient();
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("TestScheme");
		using var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
		{
			Content = new StringContent(
				"""{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"legacy-test","version":"1.0"}}}""",
				Encoding.UTF8,
				"application/json"),
		};
		request.Headers.Accept.ParseAdd("application/json, text/event-stream");

		var response = await client.SendAsync(request);

		response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
		using var document = JsonDocument.Parse(ExtractJson(await response.Content.ReadAsStringAsync()));
		document.RootElement.GetProperty("result").GetProperty("protocolVersion").GetString().ShouldBe("2025-11-25");
	}

	[Fact]
	public async Task Tool_calls_return_native_structured_content_and_capture_per_request_client_info()
	{
		await using var factory = new McpWebApplicationFactory();
		using var client = factory.CreateClient();
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("TestScheme");
		var createResponse = await PostModern(client, "tools/call", 1, new Dictionary<string, object>
		{
			["name"] = "haproxy-editor_create",
			["arguments"] = new
			{
				request = new
				{
					frontendName = "frontend",
					backendName = "backend",
					aclReferences = new[] { "acl" },
				},
			},
		});

		createResponse.StatusCode.ShouldBe(HttpStatusCode.OK, await createResponse.Content.ReadAsStringAsync());
		using var createDocument = JsonDocument.Parse(ExtractJson(await createResponse.Content.ReadAsStringAsync()));
		var createResult = createDocument.RootElement.GetProperty("result");
		createResult.TryGetProperty("isError", out var isError).ShouldBeFalse();
		createResult.GetProperty("structuredContent").GetProperty("version").GetInt64().ShouldBe(1);
		createResult.GetProperty("structuredContent").GetProperty("updated").ValueKind.ShouldBe(JsonValueKind.Null);
		factory.ExposureService.LastActor.ShouldNotBeNull();
		factory.ExposureService.LastActor.McpClientName.ShouldBe("modern-test");
		factory.ExposureService.LastActor.McpClientVersion.ShouldBe("1.0");

		var missingResponse = await PostModern(client, "tools/call", 2, new Dictionary<string, object>
		{
			["name"] = "haproxy-editor_get",
			["arguments"] = new { id = Guid.NewGuid() },
		});
		using var missingDocument = JsonDocument.Parse(ExtractJson(await missingResponse.Content.ReadAsStringAsync()));
		var missingResult = missingDocument.RootElement.GetProperty("result");
		missingResult.GetProperty("isError").GetBoolean().ShouldBeTrue();
		var errorText = missingResult.GetProperty("content")[0].GetProperty("text").GetString();
		errorText.ShouldNotBeNull();
		errorText.ShouldContain("not_found");
	}

	[Fact]
	public async Task Rest_crud_and_history_use_the_same_actor_and_event_contract()
	{
		await using var factory = new McpWebApplicationFactory();
		using var client = factory.CreateClient();
		client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("TestScheme");
		var createResponse = await client.PostAsJsonAsync("/exposures", new ExposureUpsertRequest
		{
			FrontendName = "frontend",
			BackendName = "backend",
			AclReferences = ["acl"],
		});
		var exposureId = Guid.NewGuid();

		var historyResponse = await client.GetAsync($"/exposures/history?exposureId={exposureId}&cursor=opaque&limit=25");

		createResponse.StatusCode.ShouldBe(HttpStatusCode.Created);
		factory.ExposureService.LastActor.ShouldNotBeNull();
		factory.ExposureService.LastActor.SubjectId.ShouldBe("test-subject");
		factory.ExposureService.LastActor.McpClientName.ShouldBeNull();
		historyResponse.StatusCode.ShouldBe(HttpStatusCode.OK);
		factory.ExposureService.LastHistoryQuery.ShouldBe((exposureId, "opaque", 25));
	}

	private static async Task<HttpResponseMessage> PostModern(HttpClient client, string method, int id, Dictionary<string, object>? parameters = null)
	{
		parameters ??= [];
		parameters["_meta"] = new Dictionary<string, object>
		{
			["io.modelcontextprotocol/protocolVersion"] = "2026-07-28",
			["io.modelcontextprotocol/clientInfo"] = new { name = "modern-test", version = "1.0" },
			["io.modelcontextprotocol/clientCapabilities"] = new { },
		};
		var body = JsonSerializer.Serialize(new
		{
			jsonrpc = "2.0",
			id,
			method,
			@params = parameters,
		});
		var request = new HttpRequestMessage(HttpMethod.Post, "/mcp")
		{
			Content = new StringContent(body, Encoding.UTF8, "application/json"),
		};
		request.Headers.Accept.ParseAdd("application/json, text/event-stream");
		request.Headers.TryAddWithoutValidation("MCP-Protocol-Version", "2026-07-28");
		request.Headers.TryAddWithoutValidation("MCP-Method", method);
		if (parameters.TryGetValue("name", out var name))
		{
			request.Headers.TryAddWithoutValidation("MCP-Name", name.ToString());
		}
		return await client.SendAsync(request);
	}

	private static string ExtractJson(string responseBody)
	{
		const string dataPrefix = "data: ";
		return responseBody.Split('\n', StringSplitOptions.RemoveEmptyEntries)
			.FirstOrDefault(line => line.StartsWith(dataPrefix, StringComparison.Ordinal))?[dataPrefix.Length..].Trim()
			?? responseBody;
	}

	private sealed class McpWebApplicationFactory : WebApplicationFactory<Program>
	{
		public FakeExposureService ExposureService { get; } = new();

		protected override void ConfigureWebHost(IWebHostBuilder builder)
		{
			builder.ConfigureTestServices(services =>
			{
				services.RemoveAll<IExposureService>();
				services.AddSingleton<IExposureService>(ExposureService);
				services.AddAuthentication(options =>
					{
						options.DefaultAuthenticateScheme = "TestScheme";
						options.DefaultChallengeScheme = "TestScheme";
					})
					.AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("TestScheme", _ => { });
				services.AddAuthorization(options => options.AddPolicy("ExposureManager", new AuthorizationPolicyBuilder("TestScheme")
					.RequireAuthenticatedUser()
					.Build()));
			});
		}
	}

	private sealed class FakeExposureService : IExposureService
	{
		public ExposureActorResource? LastActor { get; private set; }
		public (Guid? ExposureId, string? Cursor, int Limit)? LastHistoryQuery { get; private set; }

		public Task<ExposureResource> Create(ExposureActorResource actor, ExposureUpsertRequest request, CancellationToken cancellationToken = default)
		{
			LastActor = actor;
			return Task.FromResult(new ExposureResource
			{
				Id = Guid.NewGuid(),
				Version = 1,
				FrontendName = request.FrontendName,
				BackendName = request.BackendName,
				Matcher = request.Matcher,
				AclReferences = request.AclReferences,
				Operator = request.Operator,
				Condition = request.Condition,
				Created = new ExposureAuditStampResource { At = DateTimeOffset.UtcNow, By = actor },
				Updated = null,
			});
		}

		public Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken = default) =>
			Task.FromResult<IReadOnlyCollection<ExposureResource>>([]);

		public Task<ExposureResource?> Get(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<ExposureResource?>(null);

		public Task<ExposureDiscoveryResource> Discover(CancellationToken cancellationToken = default) => Task.FromResult(new ExposureDiscoveryResource());

		public Task<ExposureResource?> Replace(ExposureActorResource actor, Guid id, ExposureUpsertRequest request, CancellationToken cancellationToken = default) =>
			Task.FromResult<ExposureResource?>(null);

		public Task<bool> Delete(ExposureActorResource actor, Guid id, CancellationToken cancellationToken = default) => Task.FromResult(false);

		public Task<ExposureHistoryPage> History(Guid? exposureId = null, string? cursor = null, int limit = 50, CancellationToken cancellationToken = default)
		{
			LastHistoryQuery = (exposureId, cursor, limit);
			return Task.FromResult(new ExposureHistoryPage());
		}
	}

	private sealed class TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
		: AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
	{
		protected override Task<AuthenticateResult> HandleAuthenticateAsync()
		{
			var identity = new ClaimsIdentity(
			[
				new Claim("sub", "test-subject"),
				new Claim("preferred_username", "test-user"),
				new Claim("azp", "i-shared-mcp"),
			], Scheme.Name);
			return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
		}
	}
}
