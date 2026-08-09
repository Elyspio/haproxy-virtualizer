using Haproxy.Editor.Abstractions.Exceptions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Haproxy.Editor.Core.Services;

/// <summary>
///     Everything <see cref="HaproxyExtras.Sanitize" /> needs about the section being written.
/// </summary>
/// <param name="Section">Section name, as used by <see cref="Abstractions.Data.HaproxySchemaSections" />.</param>
/// <param name="Resource">Human-readable path of the edited resource, used in error messages.</param>
/// <param name="Owned">Field names the application models explicitly, which never belong in extras.</param>
/// <param name="Known">Field names the Data Plane API accepts for this section.</param>
/// <param name="Denied">Field names that may be preserved but never changed.</param>
internal readonly record struct ExtrasContext(
	string Section,
	string Resource,
	IReadOnlySet<string> Owned,
	IReadOnlySet<string> Known,
	IReadOnlySet<string> Denied);

/// <summary>
///     Moves Data Plane API fields this application does not model between the generated client objects and the
///     <c>extra</c> JSON string carried on the snapshot resources.
/// </summary>
/// <remarks>
///     Newtonsoft is used on purpose: the generated client decorates every property with
///     <see cref="JsonPropertyAttribute" />, so a Newtonsoft round-trip yields the exact Data Plane field names and enum
///     spellings without a second mapping to maintain.
/// </remarks>
internal static class HaproxyExtras
{
	private static readonly JsonSerializer Serializer = JsonSerializer.CreateDefault(new JsonSerializerSettings
	{
		NullValueHandling = NullValueHandling.Ignore,
	});

	/// <summary>
	///     Reads every field of <paramref name="generated" /> outside <paramref name="excluded" /> into a canonical JSON
	///     object: keys sorted, nulls dropped, no whitespace. Canonical form is what makes the plain string comparison used
	///     for change detection reliable.
	/// </summary>
	public static string? Extract<T>(T? generated, IReadOnlySet<string> excluded) where T : class
	{
		return generated is null ? null : Canonicalize(JObject.FromObject(generated, Serializer), excluded);
	}

	/// <summary>
	///     Rebuilds a generated client object from <paramref name="extra" />, then lets the fields already set on
	///     <paramref name="owned" /> win. Anything the application models therefore cannot be shadowed through extras.
	/// </summary>
	public static T Merge<T>(T owned, string? extra, IReadOnlySet<string> excluded) where T : class
	{
		var source = Parse(extra);

		if (source.Count == 0)
		{
			return owned;
		}

		var target = JObject.FromObject(owned, Serializer);

		foreach (var property in source.Properties().Where(property => !excluded.Contains(property.Name)))
		{
			target[property.Name] = property.Value;
		}

		return target.ToObject<T>(Serializer)!;
	}

	/// <summary>
	///     Brings an <c>extra</c> payload received from a client into the same canonical form <see cref="Extract{T}" />
	///     produces.
	/// </summary>
	public static string? Canonicalize(string? extra, IReadOnlySet<string> excluded)
	{
		return Canonicalize(Parse(extra), excluded);
	}

	/// <summary>
	///     Canonicalizes an <c>extra</c> payload received from a client and refuses it when it introduces a field the Data
	///     Plane API does not have, or changes a denied one. Values already present in <paramref name="baseline" /> are left
	///     alone, so a denied field that is simply carried along still round-trips.
	/// </summary>
	public static string? Sanitize(ExtrasContext context, string? extra, string? baseline)
	{
		var canonical = Canonicalize(extra, context.Owned);

		if (string.Equals(canonical, baseline, StringComparison.Ordinal))
		{
			return canonical;
		}

		var desiredFields = Parse(canonical);
		var baselineFields = Parse(baseline);

		foreach (var property in desiredFields.Properties())
		{
			if (!context.Known.Contains(property.Name))
			{
				throw new RequestValidationException($"'{property.Name}' is not a {context.Section} field of the HAProxy Data Plane API ({context.Resource}).");
			}

			if (context.Denied.Contains(property.Name) && !JToken.DeepEquals(property.Value, baselineFields[property.Name]))
			{
				throw new RequestValidationException(BuildDeniedMessage(context, property.Name));
			}
		}

		foreach (var property in baselineFields.Properties().Where(property => context.Denied.Contains(property.Name)))
		{
			if (desiredFields[property.Name] is null)
			{
				throw new RequestValidationException(BuildDeniedMessage(context, property.Name));
			}
		}

		return canonical;
	}

	public static JObject Parse(string? extra)
	{
		if (string.IsNullOrWhiteSpace(extra))
		{
			return [];
		}

		try
		{
			return JObject.Parse(extra);
		}
		catch (JsonException exception)
		{
			throw new RequestValidationException($"Advanced options are not a valid JSON object: {exception.Message}");
		}
	}

	private static string BuildDeniedMessage(ExtrasContext context, string field)
	{
		return $"'{field}' cannot be changed from the editor ({context.Resource}). {HaproxyFields.DeniedReason}";
	}

	private static string? Canonicalize(JObject source, IReadOnlySet<string> excluded)
	{
		var result = new JObject();

		var properties = source.Properties()
			.Where(property => !excluded.Contains(property.Name) && property.Value.Type != JTokenType.Null)
			.OrderBy(property => property.Name, StringComparer.Ordinal);

		foreach (var property in properties)
		{
			result[property.Name] = property.Value;
		}

		return result.Count == 0 ? null : result.ToString(Formatting.None);
	}
}
