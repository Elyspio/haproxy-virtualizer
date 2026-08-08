using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

/// <summary>
///     Service interface for managing HAProxy configuration.
/// </summary>
public interface IHaproxyService
{
	/// <summary>
	///     Retrieves the current HAProxy configuration.
	/// </summary>
	/// <returns>The current <see cref="HaproxyResourceSnapshot" />.</returns>
	public Task<HaproxyResourceSnapshot> GetConfig();

	/// <summary>
	///     Saves the provided HAProxy configuration through the Data Plane API.
	/// </summary>
	/// <param name="config">The configuration to save.</param>
	public Task<HaproxyResourceSnapshot> SaveConfig(HaproxyResourceSnapshot config);

	/// <summary>
	///     Retrieves an operational dashboard snapshot combining config and runtime data.
	/// </summary>
	/// <returns>The current <see cref="DashboardSnapshot" />.</returns>
	public Task<DashboardSnapshot> GetDashboardSnapshot();

	/// <summary>
	///     Validates the provided HAProxy configuration object.
	/// </summary>
	/// <param name="config">The configuration object to validate.</param>
	/// <returns>The result of the validation.</returns>
	Task<IValidationResult> ValidateConfig(HaproxyResourceSnapshot config);
}
