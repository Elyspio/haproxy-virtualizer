using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System.Reflection;
using System.Runtime.Serialization;
using Generated = Haproxy.Editor.Adapters.Haproxy;

namespace Haproxy.Editor.Core.Services;

/// <summary>
///     Derives the advanced-field catalogue from the generated Data Plane client by reflection, so it cannot drift from
///     the client the writes actually go through.
/// </summary>
public sealed class SchemaService(ILogger<SchemaService> logger) : TracingService(logger), ISchemaService
{
	private static readonly Lazy<HaproxySchema> Schema = new(Build, LazyThreadSafetyMode.ExecutionAndPublication);

	private static readonly Lazy<Dictionary<string, IReadOnlySet<string>>> KnownFields = new(
		() => Schema.Value.Sections.ToDictionary(
			section => section.Name,
			section => (IReadOnlySet<string>)new HashSet<string>(section.Fields.Select(field => field.Name), StringComparer.Ordinal),
			StringComparer.Ordinal),
		LazyThreadSafetyMode.ExecutionAndPublication);

	private static readonly Lazy<Dictionary<string, IReadOnlySet<string>>> DeniedFields = new(
		() => Schema.Value.Sections.ToDictionary(
			section => section.Name,
			section => (IReadOnlySet<string>)new HashSet<string>(
				section.Fields.Where(field => !field.Writable).Select(field => field.Name),
				StringComparer.Ordinal),
			StringComparer.Ordinal),
		LazyThreadSafetyMode.ExecutionAndPublication);

	public HaproxySchema GetSchema()
	{
		using var _ = LogService();
		return Schema.Value;
	}

	public IReadOnlySet<string> GetKnownFields(string section)
	{
		return KnownFields.Value.TryGetValue(section, out var fields)
			? fields
			: throw new RequestValidationException($"Unknown configuration section '{section}'.");
	}

	public IReadOnlySet<string> GetDeniedFields(string section)
	{
		return DeniedFields.Value.TryGetValue(section, out var fields)
			? fields
			: throw new RequestValidationException($"Unknown configuration section '{section}'.");
	}

	private static HaproxySchema Build()
	{
		return new HaproxySchema
		{
			Sections =
			[
				BuildSection(HaproxySchemaSections.Backend, typeof(Generated.Backend), HaproxyFields.Backend),
				BuildSection(HaproxySchemaSections.Server, typeof(Generated.Server), HaproxyFields.Server),
				BuildSection(HaproxySchemaSections.DefaultServer, typeof(Generated.Server_params), HaproxyFields.DefaultServer),
				BuildSection(HaproxySchemaSections.Frontend, typeof(Generated.Frontend), HaproxyFields.Frontend),
				BuildSection(HaproxySchemaSections.Bind, typeof(Generated.Bind), HaproxyFields.Bind),
			],
		};
	}

	private static HaproxySchemaSection BuildSection(string name, Type type, IReadOnlySet<string> owned)
	{
		var fields = type
			.GetProperties(BindingFlags.Public | BindingFlags.Instance)
			.Select(property => (Name: HaproxyFields.GetFieldName(property), property.PropertyType))
			.Where(field => field.Name is not null && !owned.Contains(field.Name))
			.Select(field => BuildField(field.Name!, field.PropertyType))
			.OrderBy(field => field.Name, StringComparer.Ordinal)
			.ToList();

		return new HaproxySchemaSection
		{
			Name = name,
			Fields = fields,
		};
	}

	private static HaproxySchemaField BuildField(string name, Type type)
	{
		var denied = HaproxyFields.Denied.Contains(name);
		var underlying = Nullable.GetUnderlyingType(type) ?? type;

		return new HaproxySchemaField
		{
			Name = name,
			Type = ResolveType(underlying),
			EnumValues = underlying.IsEnum ? GetEnumValues(underlying) : [],
			Writable = !denied,
			Reason = denied ? HaproxyFields.DeniedReason : null,
		};
	}

	private static string ResolveType(Type type)
	{
		if (type.IsEnum) return HaproxySchemaFieldTypes.Enum;
		if (type == typeof(string)) return HaproxySchemaFieldTypes.String;
		if (type == typeof(bool)) return HaproxySchemaFieldTypes.Boolean;

		return Type.GetTypeCode(type) switch
		{
			TypeCode.Byte or TypeCode.SByte
				or TypeCode.Int16 or TypeCode.UInt16
				or TypeCode.Int32 or TypeCode.UInt32
				or TypeCode.Int64 or TypeCode.UInt64
				or TypeCode.Single or TypeCode.Double or TypeCode.Decimal => HaproxySchemaFieldTypes.Number,
			_ => HaproxySchemaFieldTypes.Complex,
		};
	}

	private static List<string> GetEnumValues(Type type)
	{
		return type
			.GetFields(BindingFlags.Public | BindingFlags.Static)
			.Select(field => field.GetCustomAttribute<EnumMemberAttribute>()?.Value ?? field.Name.ToLowerInvariant())
			.ToList();
	}
}
