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
	public required Guid Id { get; init; }
	public required DateTimeOffset CreatedAt { get; init; }
	public required DateTimeOffset UpdatedAt { get; init; }
}

public sealed record ManagedExposure : ExposureResource
{
	public required string OwnerClientId { get; init; }
	public string? SubjectId { get; init; }
	public string? ManagedAclName { get; init; }
	public required string RuleCondition { get; init; }
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