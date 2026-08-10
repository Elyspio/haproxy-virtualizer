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
	/// <param name="cancellationToken">Token that cancels the request.</param>
	/// <returns>The current <see cref="HaproxyResourceSnapshot" />.</returns>
	public Task<HaproxyResourceSnapshot> GetConfig(CancellationToken cancellationToken = default);

	/// <summary>
	///     Saves the provided HAProxy configuration through the Data Plane API.
	/// </summary>
	/// <param name="config">The configuration to save.</param>
	/// <param name="cancellationToken">Token that cancels the request.</param>
	/// <returns>The canonical saved configuration.</returns>
	public Task<HaproxyResourceSnapshot> SaveConfig(HaproxyResourceSnapshot config, CancellationToken cancellationToken = default);

	/// <summary>
	///     Retrieves an operational dashboard snapshot combining config and runtime data.
	/// </summary>
	/// <param name="cancellationToken">Token that cancels the request.</param>
	/// <returns>The current <see cref="DashboardSnapshot" />.</returns>
	public Task<DashboardSnapshot> GetDashboardSnapshot(CancellationToken cancellationToken = default);

	/// <summary>
	///     Validates the provided HAProxy configuration object.
	/// </summary>
	/// <param name="config">The configuration object to validate.</param>
	/// <param name="cancellationToken">Token that cancels the request.</param>
	/// <returns>The result of the validation.</returns>
	Task<IValidationResult> ValidateConfig(HaproxyResourceSnapshot config, CancellationToken cancellationToken = default);
}
