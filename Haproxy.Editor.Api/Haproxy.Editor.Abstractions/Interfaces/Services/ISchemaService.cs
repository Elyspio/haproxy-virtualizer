using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

/// <summary>
///     Exposes the Data Plane API field surface reachable through the <c>extra</c> passthrough.
/// </summary>
public interface ISchemaService
{
	/// <summary>
	///     Describes every writable and denied field, per configuration section.
	/// </summary>
	/// <returns>The complete HAProxy schema.</returns>
	HaproxySchema GetSchema();

	/// <summary>
	///     Field names of <paramref name="section" /> that may appear in an <c>extra</c> payload.
	/// </summary>
	/// <param name="section">The HAProxy configuration section name.</param>
	/// <returns>The known field names for the section.</returns>
	IReadOnlySet<string> GetKnownFields(string section);

	/// <summary>
	///     Field names of <paramref name="section" /> that may never be written, only preserved.
	/// </summary>
	/// <param name="section">The HAProxy configuration section name.</param>
	/// <returns>The denied field names for the section.</returns>
	IReadOnlySet<string> GetDeniedFields(string section);
}
