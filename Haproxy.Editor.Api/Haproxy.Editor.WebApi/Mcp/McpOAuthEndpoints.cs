using System.Text.Json.Serialization;
using Haproxy.Editor.Abstractions.Configurations;

namespace Haproxy.Editor.Mcp;

public static class McpOAuthEndpoints
{
	public static WebApplication MapMcpOAuthMetadata(this WebApplication app, McpOAuthConfig config)
	{
		app.MapGet(config.MetadataPath, () => Results.Ok(new McpProtectedResourceMetadata
		{
			Resource = config.Resource,
			AuthorizationServers = [config.NormalizedIssuer],
			ScopesSupported = [config.Scope],
			BearerMethodsSupported = ["header"],
		})).AllowAnonymous();

		return app;
	}

	public static string BuildChallenge(McpOAuthConfig config, string? error = null)
	{
		var parameters = new List<string>
		{
			$"resource_metadata=\"{config.MetadataUrl}\"",
			$"scope=\"{config.Scope}\"",
		};

		if (error is not null)
		{
			parameters.Add($"error=\"{error}\"");
		}

		return $"Bearer {string.Join(", ", parameters)}";
	}
}

public sealed record McpProtectedResourceMetadata
{
	[JsonPropertyName("resource")]
	public required string Resource { get; init; }

	[JsonPropertyName("authorization_servers")]
	public required List<string> AuthorizationServers { get; init; }

	[JsonPropertyName("scopes_supported")]
	public required List<string> ScopesSupported { get; init; }

	[JsonPropertyName("bearer_methods_supported")]
	public required List<string> BearerMethodsSupported { get; init; }
}
