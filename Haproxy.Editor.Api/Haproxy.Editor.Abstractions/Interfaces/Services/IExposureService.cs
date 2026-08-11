using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

/// <summary>
/// Manages HAProxy exposure resources and their immutable audit history.
/// </summary>
public interface IExposureService
{
	/// <summary>Creates a managed exposure.</summary>
	/// <param name="actor">The authenticated actor creating the exposure.</param>
	/// <param name="request">The complete route definition.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The created version-one exposure.</returns>
	Task<ExposureResource> Create(ExposureActorResource actor, ExposureUpsertRequest request, CancellationToken cancellationToken = default);

	/// <summary>Lists current managed exposures.</summary>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The active managed exposures.</returns>
	Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken = default);

	/// <summary>Gets a current managed exposure.</summary>
	/// <param name="id">The managed exposure identifier.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The active exposure, or <see langword="null" />.</returns>
	Task<ExposureResource?> Get(Guid id, CancellationToken cancellationToken = default);

	/// <summary>Discovers HAProxy resources available to managed exposures.</summary>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The available frontends, backends, and ACL names.</returns>
	Task<ExposureDiscoveryResource> Discover(CancellationToken cancellationToken = default);

	/// <summary>Replaces a managed exposure.</summary>
	/// <param name="actor">The authenticated actor replacing the exposure.</param>
	/// <param name="id">The managed exposure identifier.</param>
	/// <param name="request">The complete replacement route definition.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The replaced exposure, or <see langword="null" />.</returns>
	Task<ExposureResource?> Replace(ExposureActorResource actor, Guid id, ExposureUpsertRequest request, CancellationToken cancellationToken = default);

	/// <summary>Deletes a managed exposure.</summary>
	/// <param name="actor">The authenticated actor deleting the exposure.</param>
	/// <param name="id">The managed exposure identifier.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns><see langword="true" /> when deleted; otherwise <see langword="false" />.</returns>
	Task<bool> Delete(ExposureActorResource actor, Guid id, CancellationToken cancellationToken = default);

	/// <summary>Reads the immutable exposure history.</summary>
	/// <param name="exposureId">Optional exposure identifier filter.</param>
	/// <param name="cursor">Optional opaque pagination cursor.</param>
	/// <param name="limit">Maximum number of events to return.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>A newest-first event page.</returns>
	Task<ExposureHistoryPage> History(Guid? exposureId = null, string? cursor = null, int limit = 50, CancellationToken cancellationToken = default);
}
