using Newtonsoft.Json;
using System.Reflection;
using Generated = Haproxy.Editor.Adapters.Haproxy;

namespace Haproxy.Editor.Core.Services;

/// <summary>
///     The Data Plane API field names each snapshot resource owns explicitly, and the ones that may never be written.
///     Everything else flows through the <c>extra</c> passthrough.
/// </summary>
internal static class HaproxyFields
{
	/// <summary>
	///     Modelled backend fields, plus the child collections the Data Plane API returns inside a backend
	///     (servers, ACL lists, rule lists…). Those are reconciled through their own endpoints, so echoing them back in a
	///     backend <c>PUT</c> would fight the rest of the reconciliation.
	/// </summary>
	public static readonly IReadOnlySet<string> Backend = Own(typeof(Generated.Backend), "name", "mode", "balance", "adv_check", "default_server");

	/// <inheritdoc cref="Backend" />
	public static readonly IReadOnlySet<string> Frontend = Own(typeof(Generated.Frontend), "name", "mode", "default_backend");

	public static readonly IReadOnlySet<string> Server = Own(declaringType: null, "name", "address", "port", "check", "ssl", "verify");

	public static readonly IReadOnlySet<string> DefaultServer = Own(declaringType: null, "ssl", "verify");

	public static readonly IReadOnlySet<string> Bind = Own(declaringType: null, "name", "address", "port");

	/// <summary>
	///     Fields that turn a configuration edit into command execution or arbitrary file access inside the HAProxy
	///     container. They are still round-tripped, so existing values survive a save, but changing them is refused.
	/// </summary>
	public static readonly IReadOnlySet<string> Denied = new HashSet<string>(StringComparer.Ordinal)
	{
		"external_check_command",
		"external_check_path",
		"server_state_file_name",
		"load_server_state_from_file",
	};

	public const string DeniedReason = "This field runs commands or reads files inside the HAProxy container and cannot be changed from the editor.";

	public static string? GetFieldName(PropertyInfo property)
	{
		return property.GetCustomAttribute<JsonPropertyAttribute>()?.PropertyName;
	}

	/// <summary>
	///     Combines explicitly modelled names with the child collections declared directly on
	///     <paramref name="declaringType" /> — for <c>Backend</c> and <c>Frontend</c>, the inherited base class holds the
	///     scalar settings and the derived class holds nothing but nested resources.
	/// </summary>
	private static IReadOnlySet<string> Own(Type? declaringType, params string[] names)
	{
		var owned = new HashSet<string>(names, StringComparer.Ordinal);

		if (declaringType is null)
		{
			return owned;
		}

		var declared = declaringType
			.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
			.Select(GetFieldName)
			.OfType<string>();

		foreach (var name in declared)
		{
			owned.Add(name);
		}

		return owned;
	}
}
