using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

public interface IExposureRepository
{
	Task Create(ManagedExposure exposure);
	Task<IReadOnlyCollection<ManagedExposure>> ListAll();
	Task<IReadOnlyCollection<ManagedExposure>> List(string ownerClientId);
	Task<ManagedExposure?> Get(Guid id);
	Task<ManagedExposure?> Get(string ownerClientId, Guid id);
	Task Replace(ManagedExposure exposure);
	Task Delete(Guid id);
}

public interface IExposureMutationLock
{
	Task<IDisposable> Acquire(CancellationToken cancellationToken = default);
}