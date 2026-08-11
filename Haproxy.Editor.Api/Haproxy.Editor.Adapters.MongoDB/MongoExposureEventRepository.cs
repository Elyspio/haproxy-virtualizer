using System.Globalization;
using System.Text;
using Elyspio.Utils.Telemetry.Technical.Helpers;
using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;

namespace Haproxy.Editor.Adapters.MongoDB;

/// <inheritdoc cref="IExposureEventRepository" />
public sealed class MongoExposureEventRepository : TracingRepository, IExposureEventRepository
{
	private readonly IMongoCollection<ExposureEventResource> _events;

	public MongoExposureEventRepository(IMongoDatabase database, ILogger<MongoExposureEventRepository> logger) : base(logger)
	{
		_events = database.GetCollection<ExposureEventResource>("exposure_events");
		_events.Indexes.CreateMany(
		[
			new CreateIndexModel<ExposureEventResource>(
				Builders<ExposureEventResource>.IndexKeys.Ascending(x => x.ExposureId).Ascending(x => x.Version),
				new CreateIndexOptions { Unique = true, Name = "exposure_version_unique" }),
			new CreateIndexModel<ExposureEventResource>(
				Builders<ExposureEventResource>.IndexKeys.Descending(x => x.OccurredAt).Descending(x => x.EventId),
				new CreateIndexOptions { Name = "history_global" }),
			new CreateIndexModel<ExposureEventResource>(
				Builders<ExposureEventResource>.IndexKeys.Ascending(x => x.ExposureId).Descending(x => x.OccurredAt).Descending(x => x.EventId),
				new CreateIndexOptions { Name = "history_by_exposure" }),
		]);
	}

	/// <inheritdoc />
	public async Task Append(ExposureEventResource exposureEvent, CancellationToken cancellationToken = default)
	{
		using var trace = LogRepository($"{Log.F(exposureEvent.ExposureId)} {Log.F(exposureEvent.Version)}");
		await _events.InsertOneAsync(exposureEvent, cancellationToken: cancellationToken);
	}

	/// <inheritdoc />
	public async Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken = default)
	{
		using var trace = LogRepository();
		var pipeline = new BsonDocument[]
		{
			new("$sort", new BsonDocument { { "ExposureId", 1 }, { "Version", 1 } }),
			new("$group", new BsonDocument
			{
				{ "_id", "$ExposureId" },
				{ "created", new BsonDocument("$first", "$$ROOT") },
				{ "latest", new BsonDocument("$last", "$$ROOT") },
			}),
			new("$match", new BsonDocument("latest.Kind", new BsonDocument("$ne", (int)ExposureEventKind.Deleted))),
			new("$sort", new BsonDocument { { "latest.OccurredAt", -1 }, { "latest.EventId", -1 } }),
		};

		var documents = await _events.Aggregate<BsonDocument>(pipeline).ToListAsync(cancellationToken);
		return documents.Select(document => ToResource(
			BsonSerializer.Deserialize<ExposureEventResource>(document["created"].AsBsonDocument),
			BsonSerializer.Deserialize<ExposureEventResource>(document["latest"].AsBsonDocument))).ToArray();
	}

	/// <inheritdoc />
	public async Task<ExposureResource?> Get(Guid id, CancellationToken cancellationToken = default)
	{
		using var trace = LogRepository($"{Log.F(id)}");
		var filter = Builders<ExposureEventResource>.Filter.Eq(x => x.ExposureId, id);
		var createdTask = _events.Find(filter).SortBy(x => x.Version).FirstOrDefaultAsync(cancellationToken);
		var latestTask = _events.Find(filter).SortByDescending(x => x.Version).FirstOrDefaultAsync(cancellationToken);
		await Task.WhenAll(createdTask, latestTask);
		var created = await createdTask;
		var latest = await latestTask;
		return created is null || latest is null || latest.Kind == ExposureEventKind.Deleted ? null : ToResource(created, latest);
	}

	/// <inheritdoc />
	public async Task<ExposureHistoryPage> History(Guid? exposureId, string? cursor, int limit, CancellationToken cancellationToken = default)
	{
		using var trace = LogRepository($"{Log.F(exposureId)} {Log.F(limit)}");
		var filter = exposureId is null
			? Builders<ExposureEventResource>.Filter.Empty
			: Builders<ExposureEventResource>.Filter.Eq(x => x.ExposureId, exposureId.Value);

		if (!string.IsNullOrWhiteSpace(cursor))
		{
			var position = DecodeCursor(cursor);
			filter &= Builders<ExposureEventResource>.Filter.Or(
				Builders<ExposureEventResource>.Filter.Lt(x => x.OccurredAt, position.OccurredAt),
				Builders<ExposureEventResource>.Filter.And(
					Builders<ExposureEventResource>.Filter.Eq(x => x.OccurredAt, position.OccurredAt),
					Builders<ExposureEventResource>.Filter.Lt(x => x.EventId, position.EventId)));
		}

		var events = await _events.Find(filter)
			.SortByDescending(x => x.OccurredAt)
			.ThenByDescending(x => x.EventId)
			.Limit(limit + 1)
			.ToListAsync(cancellationToken);
		var hasMore = events.Count > limit;
		var items = events.Take(limit).ToArray();
		return new ExposureHistoryPage
		{
			Items = items,
			NextCursor = hasMore ? EncodeCursor(items[^1]) : null,
		};
	}

	private static ExposureResource ToResource(ExposureEventResource created, ExposureEventResource latest) => new()
	{
		Id = latest.ExposureId,
		Version = latest.Version,
		FrontendName = latest.State.FrontendName,
		BackendName = latest.State.BackendName,
		Matcher = latest.State.Matcher,
		AclReferences = latest.State.AclReferences,
		Operator = latest.State.Operator,
		Condition = latest.State.Condition,
		Created = new ExposureAuditStampResource { At = created.OccurredAt, By = created.Actor },
		Updated = latest.Kind == ExposureEventKind.Replaced
			? new ExposureAuditStampResource { At = latest.OccurredAt, By = latest.Actor }
			: null,
	};

	private static string EncodeCursor(ExposureEventResource exposureEvent)
	{
		var value = $"{exposureEvent.OccurredAt.UtcTicks.ToString(CultureInfo.InvariantCulture)}|{exposureEvent.EventId:N}";
		return Convert.ToBase64String(Encoding.UTF8.GetBytes(value)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
	}

	private static HistoryCursor DecodeCursor(string cursor)
	{
		try
		{
			var normalized = cursor.Replace('-', '+').Replace('_', '/');
			normalized = normalized.PadRight(normalized.Length + ((4 - normalized.Length % 4) % 4), '=');
			var parts = Encoding.UTF8.GetString(Convert.FromBase64String(normalized)).Split('|', 2);
			if (parts.Length != 2 || !long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks) || !Guid.TryParseExact(parts[1], "N", out var eventId))
				throw new FormatException();
			return new HistoryCursor(new DateTimeOffset(ticks, TimeSpan.Zero), eventId);
		}
		catch (Exception exception) when (exception is FormatException or ArgumentOutOfRangeException)
		{
			throw new RequestValidationException("The history cursor is invalid.");
		}
	}

	private sealed record HistoryCursor(DateTimeOffset OccurredAt, Guid EventId);
}
