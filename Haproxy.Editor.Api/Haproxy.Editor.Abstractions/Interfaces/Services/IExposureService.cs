using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

public interface IExposureService
{
	Task<ExposureResource> Create(string ownerClientId, string? subjectId, ExposureUpsertRequest request, CancellationToken cancellationToken = default);
	Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken = default);
	Task<ExposureResource?> Get(Guid id, CancellationToken cancellationToken = default);
	Task<ExposureDiscoveryResource> Discover(CancellationToken cancellationToken = default);
	Task<ExposureResource?> Replace(string ownerClientId, string? subjectId, Guid id, ExposureUpsertRequest request, CancellationToken cancellationToken = default);
	Task<bool> Delete(string ownerClientId, Guid id, CancellationToken cancellationToken = default);
}
