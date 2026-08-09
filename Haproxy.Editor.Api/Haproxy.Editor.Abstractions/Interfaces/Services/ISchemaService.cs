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
	HaproxySchema GetSchema();

	/// <summary>
	///     Field names of <paramref name="section" /> that may appear in an <c>extra</c> payload.
	/// </summary>
	IReadOnlySet<string> GetKnownFields(string section);

	/// <summary>
	///     Field names of <paramref name="section" /> that may never be written, only preserved.
	/// </summary>
	IReadOnlySet<string> GetDeniedFields(string section);
}
