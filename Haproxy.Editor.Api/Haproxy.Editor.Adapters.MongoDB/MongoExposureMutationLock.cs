using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Haproxy.Editor.Adapters.MongoDB;

public sealed class MongoExposureMutationLock : TracingRepository, IExposureMutationLock
{
	private const string LockId = "haproxy-config";
	private static readonly TimeSpan DefaultLeaseDuration = TimeSpan.FromMinutes(2);
	private static readonly TimeSpan DefaultRenewalInterval = TimeSpan.FromSeconds(30);
	private readonly IMongoCollection<BsonDocument> _locks;
	private readonly TimeProvider _timeProvider;
	private readonly TimeSpan _leaseDuration;
	private readonly TimeSpan _renewalInterval;

	public MongoExposureMutationLock(IMongoDatabase database, ILogger<MongoExposureMutationLock> logger)
		: this(database, logger, TimeProvider.System, DefaultLeaseDuration, DefaultRenewalInterval)
	{
	}

	public MongoExposureMutationLock(
		IMongoDatabase database,
		ILogger<MongoExposureMutationLock> logger,
		TimeProvider timeProvider,
		TimeSpan leaseDuration,
		TimeSpan renewalInterval) : base(logger)
	{
		if (leaseDuration <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(leaseDuration));
		if (renewalInterval <= TimeSpan.Zero || renewalInterval >= leaseDuration) throw new ArgumentOutOfRangeException(nameof(renewalInterval));

		_locks = database.GetCollection<BsonDocument>("exposureLocks");
		_timeProvider = timeProvider;
		_leaseDuration = leaseDuration;
		_renewalInterval = renewalInterval;
	}

	public async Task<IExposureMutationLease> Acquire(CancellationToken cancellationToken = default)
	{
		using var trace = LogRepository();
		var owner = Guid.NewGuid().ToString("N");
		var now = _timeProvider.GetUtcNow().UtcDateTime;
		var filter = Builders<BsonDocument>.Filter.Eq("_id", LockId) &
		             (Builders<BsonDocument>.Filter.Lte("expiresAt", now) | Builders<BsonDocument>.Filter.Exists("expiresAt", false));
		var update = Builders<BsonDocument>.Update
			.SetOnInsert("_id", LockId)
			.Set("owner", owner)
			.Set("expiresAt", now.Add(_leaseDuration));

		BsonDocument? result;
		try
		{
			result = await _locks.FindOneAndUpdateAsync(
				filter,
				update,
				new FindOneAndUpdateOptions<BsonDocument> { IsUpsert = true, ReturnDocument = ReturnDocument.After },
				cancellationToken);
		}
		catch (MongoWriteException exception) when (exception.WriteError?.Category == ServerErrorCategory.DuplicateKey)
		{
			throw Conflict();
		}
		catch (MongoCommandException exception) when (exception.Code is 11000 or 11001)
		{
			throw Conflict();
		}

		if (result is null || !result.TryGetValue("owner", out var resultOwner) || resultOwner.AsString != owner)
		{
			throw Conflict();
		}

		return new Lease(_locks, owner, _timeProvider, _leaseDuration, _renewalInterval);
	}

	private static ResourceConflictException Conflict()
	{
		return new ResourceConflictException("Another HAProxy exposure mutation is in progress.");
	}

	private sealed class Lease : IExposureMutationLease
	{
		private readonly IMongoCollection<BsonDocument> _locks;
		private readonly string _owner;
		private readonly TimeProvider _timeProvider;
		private readonly TimeSpan _leaseDuration;
		private readonly TimeSpan _renewalInterval;
		private readonly CancellationTokenSource _stopRenewal = new();
		private readonly CancellationTokenSource _leaseLost = new();
		private readonly Task _renewalTask;
		private int _disposed;

		public Lease(
			IMongoCollection<BsonDocument> locks,
			string owner,
			TimeProvider timeProvider,
			TimeSpan leaseDuration,
			TimeSpan renewalInterval)
		{
			_locks = locks;
			_owner = owner;
			_timeProvider = timeProvider;
			_leaseDuration = leaseDuration;
			_renewalInterval = renewalInterval;
			_renewalTask = RenewUntilDisposed();
		}

		public CancellationToken LeaseLost => _leaseLost.Token;

		public async ValueTask DisposeAsync()
		{
			if (Interlocked.Exchange(ref _disposed, 1) != 0) return;

			await _stopRenewal.CancelAsync();
			await _renewalTask;
			await _locks.DeleteOneAsync(
				Builders<BsonDocument>.Filter.Eq("_id", LockId) & Builders<BsonDocument>.Filter.Eq("owner", _owner),
				CancellationToken.None);
			_stopRenewal.Dispose();
		}

		private async Task RenewUntilDisposed()
		{
			try
			{
				while (true)
				{
					await Task.Delay(_renewalInterval, _timeProvider, _stopRenewal.Token);
					var result = await _locks.UpdateOneAsync(
						Builders<BsonDocument>.Filter.Eq("_id", LockId) & Builders<BsonDocument>.Filter.Eq("owner", _owner),
						Builders<BsonDocument>.Update.Set("expiresAt", _timeProvider.GetUtcNow().UtcDateTime.Add(_leaseDuration)),
						cancellationToken: _stopRenewal.Token);
					if (result.MatchedCount != 1)
					{
						await _leaseLost.CancelAsync();
						return;
					}
				}
			}
			catch (OperationCanceledException) when (_stopRenewal.IsCancellationRequested)
			{
			}
			catch
			{
				await _leaseLost.CancelAsync();
			}
		}
	}
}
