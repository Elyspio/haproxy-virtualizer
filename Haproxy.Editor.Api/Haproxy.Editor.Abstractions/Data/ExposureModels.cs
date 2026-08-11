namespace Haproxy.Editor.Abstractions.Data;

public enum ExposureMatcherType
{
	PathPrefix,
	PathExact,
	PathRegex,
	Host,
	HostPrefix,
	HostRegex,
	Source,
	Method,
	Header,
	HeaderRegex
}

public enum ExposureOperator
{
	And,
	Or
}

public enum ExposureCondition
{
	If,
	Unless
}

public sealed record ExposureMatcher
{
	public required ExposureMatcherType Type { get; init; }
	public required string Value { get; init; }
	public string? HeaderName { get; init; }
}

public record ExposureUpsertRequest
{
	public required string FrontendName { get; init; }
	public required string BackendName { get; init; }
	public ExposureMatcher? Matcher { get; init; }
	public List<string> AclReferences { get; init; } = [];
	public ExposureOperator Operator { get; init; } = ExposureOperator.And;
	public ExposureCondition Condition { get; init; } = ExposureCondition.If;
}

public record ExposureResource : ExposureUpsertRequest
{
	/// <summary>Gets the managed exposure identifier.</summary>
	public required Guid Id { get; init; }
	/// <summary>Gets the current event-stream version.</summary>
	public required long Version { get; init; }
	/// <summary>Gets the creation audit stamp.</summary>
	public required ExposureAuditStampResource Created { get; init; }
	/// <summary>Gets the latest replacement audit stamp, or <see langword="null" /> before the first update.</summary>
	public ExposureAuditStampResource? Updated { get; init; }
}

/// <summary>Identifies when and by whom an exposure mutation occurred.</summary>
public sealed record ExposureAuditStampResource
{
	/// <summary>Gets the UTC timestamp of the mutation.</summary>
	public required DateTimeOffset At { get; init; }
	/// <summary>Gets the authenticated actor responsible for the mutation.</summary>
	public required ExposureActorResource By { get; init; }
}

/// <summary>Describes the authenticated human and advisory MCP client involved in a mutation.</summary>
public sealed record ExposureActorResource
{
	/// <summary>Gets the stable subject identifier from the access token.</summary>
	public required string SubjectId { get; init; }
	/// <summary>Gets the best available human-readable username from the access token.</summary>
	public required string Username { get; init; }
	/// <summary>Gets the OAuth authorized-party client identifier.</summary>
	public required string OAuthClientId { get; init; }
	/// <summary>Gets the advisory MCP client implementation name, when supplied.</summary>
	public string? McpClientName { get; init; }
	/// <summary>Gets the advisory MCP client implementation version, when supplied.</summary>
	public string? McpClientVersion { get; init; }
}

/// <summary>Identifies the immutable mutation represented by an exposure event.</summary>
public enum ExposureEventKind
{
	Created,
	Replaced,
	Deleted
}

/// <summary>Represents one immutable event in a managed exposure stream.</summary>
public sealed record ExposureEventResource
{
	/// <summary>Gets the unique event identifier.</summary>
	public required Guid EventId { get; init; }
	/// <summary>Gets the managed exposure identifier.</summary>
	public required Guid ExposureId { get; init; }
	/// <summary>Gets the monotonically increasing stream version.</summary>
	public required long Version { get; init; }
	/// <summary>Gets the mutation kind.</summary>
	public required ExposureEventKind Kind { get; init; }
	/// <summary>Gets the UTC event timestamp.</summary>
	public required DateTimeOffset OccurredAt { get; init; }
	/// <summary>Gets the authenticated actor responsible for the event.</summary>
	public required ExposureActorResource Actor { get; init; }
	/// <summary>Gets the complete route state at the time of the event.</summary>
	public required ExposureUpsertRequest State { get; init; }
}

/// <summary>Represents a cursor-paginated page of exposure events.</summary>
public sealed record ExposureHistoryPage
{
	/// <summary>Gets the events in newest-first order.</summary>
	public IReadOnlyCollection<ExposureEventResource> Items { get; init; } = [];
	/// <summary>Gets the opaque cursor for the next page, or <see langword="null" /> at the end.</summary>
	public string? NextCursor { get; init; }
}

/// <summary>Reports the result of an MCP exposure deletion.</summary>
public sealed record ExposureDeleteResource
{
	/// <summary>Gets the deleted exposure identifier.</summary>
	public required Guid Id { get; init; }
	/// <summary>Gets whether the exposure was deleted.</summary>
	public required bool Deleted { get; init; }
}

public sealed record ExposureDiscoveryResource
{
	public List<ExposureFrontendDiscoveryResource> Frontends { get; init; } = [];
	public List<string> Backends { get; init; } = [];
}

public sealed record ExposureFrontendDiscoveryResource
{
	public required string Name { get; init; }
	public List<string> AclNames { get; init; } = [];
}
