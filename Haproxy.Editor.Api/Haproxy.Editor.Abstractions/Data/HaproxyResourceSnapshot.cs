namespace Haproxy.Editor.Abstractions.Data;

public sealed record HaproxyResourceSnapshot
{
	public long Version { get; init; }

	public HaproxyGlobalResource Global { get; init; } = new();

	public List<HaproxyDefaultsResource> Defaults { get; init; } = [];

	public List<HaproxyFrontendResource> Frontends { get; init; } = [];

	public List<HaproxyBackendResource> Backends { get; init; } = [];

	public HaproxySummary Summary { get; init; } = new();
}

public sealed record HaproxyGlobalResource
{
	public bool Daemon { get; init; }
}

public sealed record HaproxyDefaultsResource
{
	public string Name { get; init; } = string.Empty;

	public string? Mode { get; init; }
}

public sealed record HaproxyFrontendResource
{
	public string Name { get; init; } = string.Empty;

	public string? Mode { get; init; }

	public string? DefaultBackend { get; init; }

	public List<HaproxyBindResource> Binds { get; init; } = [];

	public List<HaproxyAclResource> Acls { get; init; } = [];

	public List<HaproxyBackendSwitchingRuleResource> BackendSwitchingRules { get; init; } = [];

	/// <inheritdoc cref="HaproxyBackendResource.Extra" />
	public string? Extra { get; init; }
}

public sealed record HaproxyBackendResource
{
	public string Name { get; init; } = string.Empty;

	public string? Mode { get; init; }

	public string? Balance { get; init; }

	public string? AdvCheck { get; init; }

	public HaproxyDefaultServerResource? DefaultServer { get; init; }

	public List<HaproxyServerResource> Servers { get; init; } = [];

	/// <summary>
	///     Every Data Plane API field this application does not model, as a canonical JSON object (sorted keys, no whitespace).
	///     Carrying them on the snapshot is what keeps a full <c>PUT</c> replace from wiping configuration the UI never showed,
	///     and is also how custom options are written.
	/// </summary>
	public string? Extra { get; init; }
}

/// <summary>
///     The <c>default-server</c> line of a backend: server parameters inherited by every server of that backend.
/// </summary>
public sealed record HaproxyDefaultServerResource
{
	/// <inheritdoc cref="HaproxyServerResource.Ssl" />
	public string? Ssl { get; init; }

	/// <inheritdoc cref="HaproxyServerResource.Verify" />
	public string? Verify { get; init; }

	/// <inheritdoc cref="HaproxyBackendResource.Extra" />
	public string? Extra { get; init; }
}

public sealed record HaproxyBindResource
{
	public string Name { get; init; } = string.Empty;

	public string? Address { get; init; }

	public int? Port { get; init; }

	/// <inheritdoc cref="HaproxyBackendResource.Extra" />
	public string? Extra { get; init; }
}

public sealed record HaproxyAclResource
{
	public string Name { get; init; } = string.Empty;

	public string? Criterion { get; init; }

	public string? Value { get; init; }
}

public sealed record HaproxyBackendSwitchingRuleResource
{
	public string BackendName { get; init; } = string.Empty;

	public string? Cond { get; init; }

	public string? CondTest { get; init; }
}

public sealed record HaproxyServerResource
{
	public string Name { get; init; } = string.Empty;

	public string? Address { get; init; }

	public int? Port { get; init; }

	public string? Check { get; init; }

	/// <summary>
	///     Enables TLS towards the server: <c>enabled</c> or <c>disabled</c>.
	/// </summary>
	public string? Ssl { get; init; }

	/// <summary>
	///     Peer certificate verification: <c>none</c> (accepts self-signed certificates) or <c>required</c>.
	/// </summary>
	public string? Verify { get; init; }

	/// <inheritdoc cref="HaproxyBackendResource.Extra" />
	public string? Extra { get; init; }
}

public sealed record HaproxySummary
{
	public int FrontendCount { get; init; }

	public int BackendCount { get; init; }

	public int ServerCount { get; init; }
}