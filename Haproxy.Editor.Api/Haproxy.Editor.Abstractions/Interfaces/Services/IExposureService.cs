using Haproxy.Editor.Abstractions.Data;

namespace Haproxy.Editor.Abstractions.Interfaces.Services;

public interface IExposureService
{
	Task<ExposureResource> Create(string ownerClientId, string? subjectId, ExposureUpsertRequest request);
	Task<IReadOnlyCollection<ExposureResource>> List();
	Task<ExposureResource?> Get(Guid id);
	Task<ExposureDiscoveryResource> Discover();
	Task<ExposureResource?> Replace(string ownerClientId, string? subjectId, Guid id, ExposureUpsertRequest request);
	Task<bool> Delete(string ownerClientId, Guid id);
}