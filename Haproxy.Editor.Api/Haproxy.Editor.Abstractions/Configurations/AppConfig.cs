namespace Haproxy.Editor.Abstractions.Configurations;

/// <summary>
///     Represents the application configuration section.
/// </summary>
public class AppConfig
{
	/// <summary>
	///     The configuration section name.
	/// </summary>
	public const string Section = "App";

	/// <summary>
	///     Data Plane API connectivity settings.
	/// </summary>
	public required DataPlaneApiConfig DataPlaneApi { get; init; }
}

/// <summary>
///     Represents Data Plane API connectivity settings.
/// </summary>
public class DataPlaneApiConfig
{
	/// <summary>
	///     The Data Plane API base URL.
	/// </summary>
	public required string BaseUrl { get; init; }

	/// <summary>
	///     Username used for basic authentication.
	/// </summary>
	public string? Username { get; init; }

	/// <summary>
	///     Password used for basic authentication.
	/// </summary>
	public string? Password { get; init; }

	/// <summary>
	///     Bearer token used for authentication.
	/// </summary>
	public string? Token { get; init; }

	/// <summary>
	///     Ignore TLS certificate validation errors.
	/// </summary>
	public bool IgnoreTlsErrors { get; init; }

	/// <summary>
	///     Request timeout, in seconds.
	/// </summary>
	public int TimeoutSeconds { get; init; } = 30;
}

/// <summary>
///     Represents the OpenID Connect configuration.
/// </summary>
public class OidcConfig
{
	/// <summary>
	///     The expected audience for the OIDC token.
	/// </summary>
	public required string Audience { get; init; }

	/// <summary>
	///     The issuer of the OIDC token.
	/// </summary>
	public required string Issuer { get; init; }
}