using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

/// <summary>
/// Persists and reconstructs managed exposure event streams.
/// </summary>
public interface IExposureEventRepository
{
	/// <summary>Appends an immutable event to an exposure stream.</summary>
	/// <param name="exposureEvent">The event to append.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>A task that completes after the event is durable.</returns>
	Task Append(ExposureEventResource exposureEvent, CancellationToken cancellationToken = default);

	/// <summary>Lists the current non-deleted exposure resources.</summary>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The active reconstructed exposures.</returns>
	Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken = default);

	/// <summary>Gets the current non-deleted state of an exposure.</summary>
	/// <param name="id">The managed exposure identifier.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>The active reconstructed exposure, or <see langword="null" />.</returns>
	Task<ExposureResource?> Get(Guid id, CancellationToken cancellationToken = default);

	/// <summary>Reads the global or exposure-filtered event history.</summary>
	/// <param name="exposureId">Optional exposure identifier filter.</param>
	/// <param name="cursor">Optional opaque pagination cursor.</param>
	/// <param name="limit">Maximum number of events to return.</param>
	/// <param name="cancellationToken">Token that cancels the operation.</param>
	/// <returns>A newest-first page of exposure events.</returns>
	Task<ExposureHistoryPage> History(Guid? exposureId, string? cursor, int limit, CancellationToken cancellationToken = default);
}

/// <summary>
/// Serializes exposure mutations across application instances.
/// </summary>
public interface IExposureMutationLock
{
	/// <summary>Acquires the distributed exposure mutation lease.</summary>
	/// <param name="cancellationToken">Token that cancels lock acquisition.</param>
	/// <returns>The acquired renewable lease.</returns>
	Task<IExposureMutationLease> Acquire(CancellationToken cancellationToken = default);
}

/// <summary>
/// Represents ownership of a renewable exposure mutation lease.
/// </summary>
public interface IExposureMutationLease : IAsyncDisposable
{
	/// <summary>Gets a token that is canceled when lease ownership is lost.</summary>
	CancellationToken LeaseLost { get; }
}
