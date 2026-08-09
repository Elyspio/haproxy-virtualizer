namespace Haproxy.Editor.Abstractions.Data;

/// <summary>
///     Section names shared by <see cref="HaproxySchema" /> and the <c>extra</c> passthrough.
/// </summary>
public static class HaproxySchemaSections
{
	public const string Backend = "backend";

	public const string Server = "server";

	public const string DefaultServer = "default-server";

	public const string Frontend = "frontend";

	public const string Bind = "bind";
}

/// <summary>
///     Describes the Data Plane API fields reachable through <see cref="HaproxyBackendResource.Extra" /> and its siblings,
///     so the editor can offer them without hard-coding a list that drifts from the generated client.
/// </summary>
public sealed record HaproxySchema
{
	public List<HaproxySchemaSection> Sections { get; init; } = [];
}

public sealed record HaproxySchemaSection
{
	/// <summary>
	///     One of <c>backend</c>, <c>server</c>, <c>default-server</c>, <c>frontend</c>, <c>bind</c>.
	/// </summary>
	public string Name { get; init; } = string.Empty;

	public List<HaproxySchemaField> Fields { get; init; } = [];
}

public sealed record HaproxySchemaField
{
	/// <summary>
	///     The Data Plane API field name, e.g. <c>connect_timeout</c>.
	/// </summary>
	public string Name { get; init; } = string.Empty;

	/// <summary>
	///     One of the <see cref="HaproxySchemaFieldTypes" /> values. Kept as a string rather than an enum so the wire format
	///     does not depend on how the host happens to serialize enums.
	/// </summary>
	public string Type { get; init; } = HaproxySchemaFieldTypes.Complex;

	public List<string> EnumValues { get; init; } = [];

	/// <summary>
	///     <c>false</c> for denied fields. Existing values still round-trip untouched, but the API refuses to change them.
	/// </summary>
	public bool Writable { get; init; } = true;

	/// <summary>
	///     Why the field is not writable, when <see cref="Writable" /> is <c>false</c>.
	/// </summary>
	public string? Reason { get; init; }
}

public static class HaproxySchemaFieldTypes
{
	public const string String = "string";

	public const string Number = "number";

	public const string Boolean = "boolean";

	public const string Enum = "enum";

	/// <summary>
	///     Nested object or array. Round-tripped as-is; the editor shows it read-only.
	/// </summary>
	public const string Complex = "complex";
}
