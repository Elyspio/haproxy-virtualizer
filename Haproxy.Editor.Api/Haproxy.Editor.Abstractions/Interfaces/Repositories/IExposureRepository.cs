using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

public interface IExposureRepository
{
	Task Create(ManagedExposure exposure, CancellationToken cancellationToken = default);
	Task<IReadOnlyCollection<ManagedExposure>> ListAll(CancellationToken cancellationToken = default);
	Task<IReadOnlyCollection<ManagedExposure>> List(string ownerClientId, CancellationToken cancellationToken = default);
	Task<ManagedExposure?> Get(Guid id, CancellationToken cancellationToken = default);
	Task<ManagedExposure?> Get(string ownerClientId, Guid id, CancellationToken cancellationToken = default);
	Task Replace(ManagedExposure exposure, CancellationToken cancellationToken = default);
	Task Delete(Guid id, CancellationToken cancellationToken = default);
}

public interface IExposureMutationLock
{
	Task<IExposureMutationLease> Acquire(CancellationToken cancellationToken = default);
}

public interface IExposureMutationLease : IAsyncDisposable
{
	CancellationToken LeaseLost { get; }
}
