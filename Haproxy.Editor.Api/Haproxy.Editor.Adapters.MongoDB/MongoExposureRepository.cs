using Elyspio.Utils.Telemetry.Technical.Helpers;
using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Haproxy.Editor.Adapters.MongoDB;

public sealed class MongoExposureRepository : TracingRepository, IExposureRepository
{
	private readonly IMongoCollection<ManagedExposure> _exposures;

	public MongoExposureRepository(IMongoDatabase database, ILogger<MongoExposureRepository> logger) : base(logger)
	{
		_exposures = database.GetCollection<ManagedExposure>("exposures");
		_exposures.Indexes.CreateOne(new CreateIndexModel<ManagedExposure>(Builders<ManagedExposure>.IndexKeys.Ascending(x => x.OwnerClientId).Descending(x => x.CreatedAt)));
	}

	public async Task Create(ManagedExposure exposure)
	{
		using var trace = LogRepository($"{Log.F(exposure.Id)} {Log.F(exposure.OwnerClientId)}");
		await _exposures.InsertOneAsync(exposure);
	}

	public async Task<IReadOnlyCollection<ManagedExposure>> ListAll()
	{
		using var trace = LogRepository();
		return await _exposures.Find(_ => true).SortByDescending(x => x.CreatedAt).ToListAsync();
	}

	public async Task<IReadOnlyCollection<ManagedExposure>> List(string ownerClientId)
	{
		using var trace = LogRepository($"{Log.F(ownerClientId)}");
		return await _exposures.Find(x => x.OwnerClientId == ownerClientId).SortByDescending(x => x.CreatedAt).ToListAsync();
	}

	public async Task<ManagedExposure?> Get(Guid id)
	{
		using var trace = LogRepository($"{Log.F(id)}");
		return await _exposures.Find(x => x.Id == id).FirstOrDefaultAsync();
	}

	public async Task<ManagedExposure?> Get(string ownerClientId, Guid id)
	{
		using var trace = LogRepository($"{Log.F(ownerClientId)} {Log.F(id)}");
		return await _exposures.Find(x => x.OwnerClientId == ownerClientId && x.Id == id).FirstOrDefaultAsync();
	}

	public async Task Replace(ManagedExposure exposure)
	{
		using var trace = LogRepository($"{Log.F(exposure.Id)} {Log.F(exposure.OwnerClientId)}");
		await _exposures.ReplaceOneAsync(x => x.Id == exposure.Id && x.OwnerClientId == exposure.OwnerClientId, exposure);
	}

	public async Task Delete(Guid id)
	{
		using var trace = LogRepository($"{Log.F(id)}");
		await _exposures.DeleteOneAsync(x => x.Id == id);
	}
}
