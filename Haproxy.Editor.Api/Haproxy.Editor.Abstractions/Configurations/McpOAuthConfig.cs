namespace Haproxy.Editor.Abstractions.Configurations;

public sealed class McpOAuthConfig
{
	public const string Section = "McpOAuth";
	public required string Issuer { get; init; }
	public required string Resource { get; init; }
	public required string MetadataPath { get; init; }
	public required string ClientId { get; init; }
	public required string Scope { get; init; }
	public required string Role { get; init; }

	public string NormalizedIssuer => Issuer.TrimEnd('/');
	public string MetadataUrl => new Uri(new Uri(Resource).GetLeftPart(UriPartial.Authority) + MetadataPath).AbsoluteUri;
}
