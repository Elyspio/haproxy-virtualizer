using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

/// <summary>
///     Manages HAProxy exposure resources and their persisted ownership metadata.
/// </summary>
public interface IExposureService
{
	/// <summary>
	///     Creates an exposure owned by the authenticated client.
	/// </summary>
	/// <param name="ownerClientId">The OAuth client identifier that owns the exposure.</param>
	/// <param name="subjectId">The optional authenticated subject that requested the exposure.</param>
	/// <param name="request">The desired exposure definition.</param>
	/// <param name="cancellationToken">Token that cancels the mutation.</param>
	/// <returns>The created exposure.</returns>
	Task<ExposureResource> Create(string ownerClientId, string? subjectId, ExposureUpsertRequest request, CancellationToken cancellationToken = default);

	/// <summary>
	///     Lists all managed exposures.
	/// </summary>
	/// <param name="cancellationToken">Token that cancels the query.</param>
	/// <returns>The managed exposures.</returns>
	Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken = default);

	/// <summary>
	///     Gets a managed exposure by identifier.
	/// </summary>
	/// <param name="id">The exposure identifier.</param>
	/// <param name="cancellationToken">Token that cancels the query.</param>
	/// <returns>The exposure, or <see langword="null" /> when it does not exist.</returns>
	Task<ExposureResource?> Get(Guid id, CancellationToken cancellationToken = default);

	/// <summary>
	///     Discovers HAProxy resources that are available for exposure management.
	/// </summary>
	/// <param name="cancellationToken">Token that cancels the query.</param>
	/// <returns>The current exposure discovery data.</returns>
	Task<ExposureDiscoveryResource> Discover(CancellationToken cancellationToken = default);

	/// <summary>
	///     Replaces an exposure owned by the authenticated client.
	/// </summary>
	/// <param name="ownerClientId">The OAuth client identifier that owns the exposure.</param>
	/// <param name="subjectId">The optional authenticated subject that requested the replacement.</param>
	/// <param name="id">The exposure identifier.</param>
	/// <param name="request">The replacement exposure definition.</param>
	/// <param name="cancellationToken">Token that cancels the mutation.</param>
	/// <returns>The replaced exposure, or <see langword="null" /> when it does not exist.</returns>
	Task<ExposureResource?> Replace(string ownerClientId, string? subjectId, Guid id, ExposureUpsertRequest request, CancellationToken cancellationToken = default);

	/// <summary>
	///     Deletes an exposure owned by the authenticated client.
	/// </summary>
	/// <param name="ownerClientId">The OAuth client identifier that owns the exposure.</param>
	/// <param name="id">The exposure identifier.</param>
	/// <param name="cancellationToken">Token that cancels the mutation.</param>
	/// <returns><see langword="true" /> when an exposure was deleted; otherwise, <see langword="false" />.</returns>
	Task<bool> Delete(string ownerClientId, Guid id, CancellationToken cancellationToken = default);
}
