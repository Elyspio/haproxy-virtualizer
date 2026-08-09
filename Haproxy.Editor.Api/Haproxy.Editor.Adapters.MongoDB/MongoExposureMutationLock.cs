using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Haproxy.Editor.Adapters.MongoDB;

public sealed class MongoExposureMutationLock : TracingRepository, IExposureMutationLock
{
	private readonly IMongoCollection<BsonDocument> _locks;
	public MongoExposureMutationLock(IMongoDatabase database, ILogger<MongoExposureMutationLock> logger) : base(logger) => _locks = database.GetCollection<BsonDocument>("exposureLocks");

	public async Task<IDisposable> Acquire(CancellationToken cancellationToken = default)
	{
		using var trace = LogRepository();
		var owner = Guid.NewGuid().ToString("N");
		var now = DateTime.UtcNow;
		var until = now.AddMinutes(2);
		var idFilter = Builders<BsonDocument>.Filter.Eq("_id", "haproxy-config");
		await _locks.UpdateOneAsync(
			idFilter,
			Builders<BsonDocument>.Update.SetOnInsert("expiresAt", DateTime.UnixEpoch),
			new UpdateOptions { IsUpsert = true },
			cancellationToken);
		var filter = Builders<BsonDocument>.Filter.Eq("_id", "haproxy-config") &
		             (Builders<BsonDocument>.Filter.Lte("expiresAt", now) | Builders<BsonDocument>.Filter.Exists("expiresAt", false));
		var update = Builders<BsonDocument>.Update.Set("owner", owner).Set("expiresAt", until);
		var result = await _locks.FindOneAndUpdateAsync(filter, update, new FindOneAndUpdateOptions<BsonDocument> { ReturnDocument = ReturnDocument.After }, cancellationToken);
		if (result is null || result["owner"].AsString != owner) throw new ResourceConflictException("Another HAProxy exposure mutation is in progress.");
		return new Releaser(_locks, owner);
	}

	private sealed class Releaser(IMongoCollection<BsonDocument> locks, string owner) : IDisposable
	{
		public void Dispose() => locks.DeleteOne(Builders<BsonDocument>.Filter.Eq("_id", "haproxy-config") & Builders<BsonDocument>.Filter.Eq("owner", owner));
	}
}
