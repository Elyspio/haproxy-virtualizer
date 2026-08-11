using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

/// <summary>
///     Persists managed exposure ownership and reconciliation metadata.
/// </summary>
public interface IExposureRepository
{
	/// <summary>
	///     Creates a managed exposure record.
	/// </summary>
	/// <param name="exposure">The exposure to persist.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>A task that completes when the exposure is persisted.</returns>
	Task Create(ManagedExposure exposure, CancellationToken cancellationToken = default);

	/// <summary>
	///     Lists every managed exposure.
	/// </summary>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>All managed exposures.</returns>
	Task<IReadOnlyCollection<ManagedExposure>> ListAll(CancellationToken cancellationToken = default);

	/// <summary>
	///     Lists managed exposures owned by a client.
	/// </summary>
	/// <param name="ownerClientId">The owner OAuth client identifier.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The exposures owned by the client.</returns>
	Task<IReadOnlyCollection<ManagedExposure>> List(string ownerClientId, CancellationToken cancellationToken = default);

	/// <summary>
	///     Gets a managed exposure by identifier.
	/// </summary>
	/// <param name="id">The exposure identifier.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The exposure, or <see langword="null" /> when it does not exist.</returns>
	Task<ManagedExposure?> Get(Guid id, CancellationToken cancellationToken = default);

	/// <summary>
	///     Gets a managed exposure by owner and identifier.
	/// </summary>
	/// <param name="ownerClientId">The owner OAuth client identifier.</param>
	/// <param name="id">The exposure identifier.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The owned exposure, or <see langword="null" /> when it does not exist.</returns>
	Task<ManagedExposure?> Get(string ownerClientId, Guid id, CancellationToken cancellationToken = default);

	/// <summary>
	///     Replaces a managed exposure record.
	/// </summary>
	/// <param name="exposure">The replacement exposure.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>A task that completes when the exposure is replaced.</returns>
	Task Replace(ManagedExposure exposure, CancellationToken cancellationToken = default);

	/// <summary>
	///     Deletes a managed exposure record.
	/// </summary>
	/// <param name="id">The exposure identifier.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>A task that completes when the exposure is deleted.</returns>
	Task Delete(Guid id, CancellationToken cancellationToken = default);
}

/// <summary>
///     Serializes exposure mutations across application instances.
/// </summary>
public interface IExposureMutationLock
{
	/// <summary>
	///     Acquires the distributed exposure mutation lease.
	/// </summary>
	/// <param name="cancellationToken">Token that cancels lock acquisition.</param>
	/// <returns>The acquired renewable lease.</returns>
	Task<IExposureMutationLease> Acquire(CancellationToken cancellationToken = default);
}

/// <summary>
///     Represents ownership of a renewable exposure mutation lease.
/// </summary>
public interface IExposureMutationLease : IAsyncDisposable
{
	/// <summary>
	///     Gets a token that is canceled when lease ownership is lost.
	/// </summary>
	CancellationToken LeaseLost { get; }
}
