using System.Text.Json.Serialization;

namespace Haproxy.Editor.Abstractions.Data;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum RuntimeStatus
{
	Unknown,
	Up,
	Down,
	Maintenance,
	Healthy,
	Degraded,
	Critical,
	Empty,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DashboardTone
{
	Neutral,
	Info,
	Success,
	Warning,
	Critical,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DashboardAlertSeverity
{
	Info,
	Warning,
	Critical,
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum DashboardResourceType
{
	Service,
	Runtime,
	Frontend,
	Backend,
}

public sealed record DashboardSnapshot
{
	public DashboardSummary Summary { get; init; } = new();

	public List<DashboardAlert> Alerts { get; init; } = [];

	public List<RuntimeBackendStatus> Backends { get; init; } = [];
}

public sealed record DashboardSummary
{
	public DateTimeOffset GeneratedAt { get; init; } = DateTimeOffset.UtcNow;

	public RuntimeStatus RuntimeStatus { get; init; } = RuntimeStatus.Unknown;

	public DashboardKpi Alerts { get; init; } = new();

	public DashboardKpi Routes { get; init; } = new();

	public DashboardKpi Services { get; init; } = new();
}

public sealed record DashboardKpi
{
	public string Title { get; init; } = string.Empty;

	public int Value { get; init; }

	public string Subtitle { get; init; } = string.Empty;

	public DashboardTone Tone { get; init; } = DashboardTone.Neutral;

	public List<int> Trend { get; init; } = [];
}

public sealed record DashboardAlert
{
	public string Id { get; init; } = string.Empty;

	public DashboardAlertSeverity Severity { get; init; } = DashboardAlertSeverity.Info;

	public string Message { get; init; } = string.Empty;

	public DashboardResourceType? ResourceType { get; init; }

	public string? ResourceName { get; init; }
}

public sealed record RuntimeBackendStatus
{
	public string Name { get; init; } = string.Empty;

	public RuntimeStatus Status { get; init; } = RuntimeStatus.Unknown;

	public int CurrentSessions { get; init; }

	public int SessionRate { get; init; }

	public long BytesIn { get; init; }

	public long BytesOut { get; init; }

	public int HealthyServers { get; init; }

	public int DownServers { get; init; }

	public int MaintenanceServers { get; init; }

	public List<RuntimeServerStatus> Servers { get; init; } = [];
}

public sealed record RuntimeServerStatus
{
	public string Name { get; init; } = string.Empty;

	public RuntimeStatus Status { get; init; } = RuntimeStatus.Unknown;

	public string? Address { get; init; }

	public int? Port { get; init; }

	public string? AdminState { get; init; }

	public string? OperationalState { get; init; }

	public string? CheckStatus { get; init; }

	public int CurrentSessions { get; init; }

	public int SessionRate { get; init; }
}