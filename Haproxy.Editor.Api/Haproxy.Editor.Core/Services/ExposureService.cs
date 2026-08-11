using System.Runtime.ExceptionServices;
using Elyspio.Utils.Telemetry.Technical.Helpers;
using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.Extensions.Logging;

namespace Haproxy.Editor.Core.Services;

/// <inheritdoc cref="IExposureService" />
public sealed class ExposureService(
	IHaproxyService haproxyService,
	IExposureEventRepository repository,
	IExposureMutationLock mutationLock,
	ILogger<ExposureService> logger) : TracingService(logger), IExposureService
{
	/// <inheritdoc />
	public async Task<ExposureResource> Create(ExposureActorResource actor, ExposureUpsertRequest request, CancellationToken cancellationToken = default)
	{
		using var trace = LogService($"{Log.F(actor.SubjectId)} {Log.F(request.FrontendName)} {Log.F(request.BackendName)}");

		await using var lease = await mutationLock.Acquire(cancellationToken);
		using var operationCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lease.LeaseLost);
		var operationToken = operationCancellation.Token;
		var snapshot = await haproxyService.GetConfig(operationToken);
		var managed = BuildManaged(Guid.NewGuid(), request);
		EnsureNoDuplicateRule(snapshot, managed);
		Apply(snapshot, managed, replacementPosition: null);
		operationToken.ThrowIfCancellationRequested();
		var savedSnapshot = await haproxyService.SaveConfig(snapshot, operationToken);
		var occurredAt = DateTimeOffset.UtcNow;
		var exposureEvent = NewEvent(managed, 1, ExposureEventKind.Created, occurredAt, actor);

		try
		{
			operationToken.ThrowIfCancellationRequested();
			await repository.Append(exposureEvent, operationToken);
		}
		catch (Exception exception)
		{
			await CompensateAndRethrow(async cleanupToken =>
			{
				Remove(savedSnapshot, managed);
				await haproxyService.SaveConfig(savedSnapshot, cleanupToken);
			}, exception, "creating an exposure");
		}

		return ToResource(managed.State, managed.Id, 1, new ExposureAuditStampResource { At = occurredAt, By = actor }, updated: null);
	}

	/// <inheritdoc />
	public async Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken = default)
	{
		using var trace = LogService();
		return await repository.List(cancellationToken);
	}

	/// <inheritdoc />
	public async Task<ExposureResource?> Get(Guid id, CancellationToken cancellationToken = default)
	{
		using var trace = LogService($"{Log.F(id)}");
		return await repository.Get(id, cancellationToken);
	}

	/// <inheritdoc />
	public async Task<ExposureDiscoveryResource> Discover(CancellationToken cancellationToken = default)
	{
		using var trace = LogService();

		var snapshot = await haproxyService.GetConfig(cancellationToken);
		return new ExposureDiscoveryResource
		{
			Frontends = snapshot.Frontends.Select(frontend => new ExposureFrontendDiscoveryResource
			{
				Name = frontend.Name,
				AclNames = frontend.Acls.Select(acl => acl.Name).OrderBy(name => name, StringComparer.Ordinal).ToList(),
			}).OrderBy(frontend => frontend.Name, StringComparer.Ordinal).ToList(),
			Backends = snapshot.Backends.Select(backend => backend.Name).OrderBy(name => name, StringComparer.Ordinal).ToList(),
		};
	}

	/// <inheritdoc />
	public async Task<ExposureResource?> Replace(ExposureActorResource actor, Guid id, ExposureUpsertRequest request, CancellationToken cancellationToken = default)
	{
		using var trace = LogService($"{Log.F(actor.SubjectId)} {Log.F(id)} {Log.F(request.FrontendName)} {Log.F(request.BackendName)}");

		await using var lease = await mutationLock.Acquire(cancellationToken);
		using var operationCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lease.LeaseLost);
		var operationToken = operationCancellation.Token;
		var current = await repository.Get(id, operationToken);
		if (current is null) return null;

		var snapshot = await haproxyService.GetConfig(operationToken);
		var currentManaged = BuildManaged(id, current);
		EnsureNotDrifted(snapshot, currentManaged);
		var next = BuildManaged(id, request);
		var previousPosition = FindRulePosition(snapshot.Frontends.Single(x => x.Name == currentManaged.State.FrontendName), currentManaged);
		Remove(snapshot, currentManaged);
		EnsureNoDuplicateRule(snapshot, next);
		Apply(snapshot, next, previousPosition);
		operationToken.ThrowIfCancellationRequested();
		var savedSnapshot = await haproxyService.SaveConfig(snapshot, operationToken);
		var occurredAt = DateTimeOffset.UtcNow;
		var exposureEvent = NewEvent(next, current.Version + 1, ExposureEventKind.Replaced, occurredAt, actor);

		try
		{
			operationToken.ThrowIfCancellationRequested();
			await repository.Append(exposureEvent, operationToken);
		}
		catch (Exception exception)
		{
			await CompensateAndRethrow(async cleanupToken =>
			{
				Remove(savedSnapshot, next);
				Apply(savedSnapshot, currentManaged, previousPosition);
				await haproxyService.SaveConfig(savedSnapshot, cleanupToken);
			}, exception, "replacing an exposure");
		}

		return ToResource(next.State, id, exposureEvent.Version, current.Created, new ExposureAuditStampResource { At = occurredAt, By = actor });
	}

	/// <inheritdoc />
	public async Task<bool> Delete(ExposureActorResource actor, Guid id, CancellationToken cancellationToken = default)
	{
		using var trace = LogService($"{Log.F(actor.SubjectId)} {Log.F(id)}");

		await using var lease = await mutationLock.Acquire(cancellationToken);
		using var operationCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, lease.LeaseLost);
		var operationToken = operationCancellation.Token;
		var current = await repository.Get(id, operationToken);
		if (current is null) return false;

		var managed = BuildManaged(id, current);
		var snapshot = await haproxyService.GetConfig(operationToken);
		EnsureNotDrifted(snapshot, managed);
		var previousPosition = FindRulePosition(snapshot.Frontends.Single(x => x.Name == managed.State.FrontendName), managed);
		Remove(snapshot, managed);
		operationToken.ThrowIfCancellationRequested();
		var savedSnapshot = await haproxyService.SaveConfig(snapshot, operationToken);
		var exposureEvent = NewEvent(managed, current.Version + 1, ExposureEventKind.Deleted, DateTimeOffset.UtcNow, actor);

		try
		{
			operationToken.ThrowIfCancellationRequested();
			await repository.Append(exposureEvent, operationToken);
		}
		catch (Exception exception)
		{
			await CompensateAndRethrow(async cleanupToken =>
			{
				Apply(savedSnapshot, managed, previousPosition);
				await haproxyService.SaveConfig(savedSnapshot, cleanupToken);
			}, exception, "deleting an exposure");
		}

		return true;
	}

	/// <inheritdoc />
	public async Task<ExposureHistoryPage> History(Guid? exposureId = null, string? cursor = null, int limit = 50, CancellationToken cancellationToken = default)
	{
		using var trace = LogService($"{Log.F(exposureId)} {Log.F(limit)}");
		if (limit is < 1 or > 100) throw new RequestValidationException("History limit must be between 1 and 100.");
		return await repository.History(exposureId, cursor, limit, cancellationToken);
	}

	private static ManagedRoute BuildManaged(Guid id, ExposureUpsertRequest request)
	{
		ValidateRequest(request);
		var normalized = Normalize(request);
		var aclName = normalized.Matcher is null ? null : $"api_exposure_{id:N}";
		var names = (aclName is null ? [] : new[] { aclName }).Concat(normalized.AclReferences).ToArray();
		var separator = normalized.Operator == ExposureOperator.And ? " " : " || ";
		return new ManagedRoute
		{
			Id = id,
			State = normalized,
			ManagedAclName = aclName,
			RuleCondition = names.Length == 1 ? names[0] : $"({string.Join(separator, names)})",
		};
	}

	private static ExposureUpsertRequest Normalize(ExposureUpsertRequest request) => new()
	{
		FrontendName = request.FrontendName.Trim(),
		BackendName = request.BackendName.Trim(),
		Matcher = request.Matcher is null ? null : new ExposureMatcher
		{
			Type = request.Matcher.Type,
			Value = request.Matcher.Value.Trim(),
			HeaderName = request.Matcher.HeaderName?.Trim(),
		},
		AclReferences = request.AclReferences.Select(reference => reference.Trim()).Distinct(StringComparer.Ordinal).ToList(),
		Operator = request.Operator,
		Condition = request.Condition,
	};

	private static void ValidateRequest(ExposureUpsertRequest request)
	{
		if (string.IsNullOrWhiteSpace(request.FrontendName) || string.IsNullOrWhiteSpace(request.BackendName)) throw new RequestValidationException("FrontendName and BackendName are required.");
		if (request.Matcher is null && request.AclReferences.Count == 0) throw new RequestValidationException("A matcher or an ACL reference is required.");
		if (request.AclReferences.Any(string.IsNullOrWhiteSpace)) throw new RequestValidationException("ACL references cannot be empty.");
		if (request.Matcher is { } matcher && (string.IsNullOrWhiteSpace(matcher.Value) ||
			(matcher.Type is ExposureMatcherType.Header or ExposureMatcherType.HeaderRegex && string.IsNullOrWhiteSpace(matcher.HeaderName))))
			throw new RequestValidationException("The matcher is incomplete.");
	}

	private static ExposureEventResource NewEvent(ManagedRoute exposure, long version, ExposureEventKind kind, DateTimeOffset occurredAt, ExposureActorResource actor) => new()
	{
		EventId = Guid.NewGuid(),
		ExposureId = exposure.Id,
		Version = version,
		Kind = kind,
		OccurredAt = occurredAt,
		Actor = actor,
		State = exposure.State,
	};

	private static ExposureResource ToResource(
		ExposureUpsertRequest state,
		Guid id,
		long version,
		ExposureAuditStampResource created,
		ExposureAuditStampResource? updated) => new()
		{
			Id = id,
			Version = version,
			FrontendName = state.FrontendName,
			BackendName = state.BackendName,
			Matcher = state.Matcher,
			AclReferences = state.AclReferences,
			Operator = state.Operator,
			Condition = state.Condition,
			Created = created,
			Updated = updated,
		};

	private static void Apply(HaproxyResourceSnapshot snapshot, ManagedRoute exposure, int? replacementPosition)
	{
		var frontend = snapshot.Frontends.SingleOrDefault(x => x.Name == exposure.State.FrontendName) ?? throw new ResourceNotFoundException("The requested frontend does not exist.");
		if (!snapshot.Backends.Any(x => x.Name == exposure.State.BackendName)) throw new ResourceNotFoundException("The requested backend does not exist.");
		if (exposure.State.AclReferences.Any(reference => !frontend.Acls.Any(acl => acl.Name == reference))) throw new ResourceNotFoundException("An ACL reference does not exist on the requested frontend.");
		if (exposure.ManagedAclName is not null) frontend.Acls.Add(ToAcl(exposure.ManagedAclName, exposure.State.Matcher!));
		var rule = new HaproxyBackendSwitchingRuleResource
		{
			BackendName = exposure.State.BackendName,
			Cond = exposure.State.Condition == ExposureCondition.If ? "if" : "unless",
			CondTest = exposure.RuleCondition,
		};
		if (replacementPosition is null) frontend.BackendSwitchingRules.Add(rule);
		else frontend.BackendSwitchingRules.Insert(Math.Min(frontend.BackendSwitchingRules.Count, replacementPosition.Value), rule);
	}

	private static void EnsureNoDuplicateRule(HaproxyResourceSnapshot snapshot, ManagedRoute exposure)
	{
		var frontend = snapshot.Frontends.SingleOrDefault(x => x.Name == exposure.State.FrontendName) ?? throw new ResourceNotFoundException("The requested frontend does not exist.");
		var condition = exposure.State.Condition == ExposureCondition.If ? "if" : "unless";
		if (frontend.BackendSwitchingRules.Any(rule => rule.Cond == condition && rule.CondTest == exposure.RuleCondition))
			throw new ResourceConflictException("An identical backend-switching condition already exists on the requested frontend.");
	}

	private static void Remove(HaproxyResourceSnapshot snapshot, ManagedRoute exposure)
	{
		var frontend = snapshot.Frontends.SingleOrDefault(x => x.Name == exposure.State.FrontendName) ?? throw new ResourceConflictException("Exposure drift detected: frontend is missing.");
		frontend.BackendSwitchingRules.RemoveAll(x => IsManagedRule(x, exposure));
		if (exposure.ManagedAclName is not null) frontend.Acls.RemoveAll(x => x.Name == exposure.ManagedAclName);
	}

	private static void EnsureNotDrifted(HaproxyResourceSnapshot snapshot, ManagedRoute exposure)
	{
		var frontend = snapshot.Frontends.SingleOrDefault(x => x.Name == exposure.State.FrontendName);
		if (frontend is null || !frontend.BackendSwitchingRules.Any(x => IsManagedRule(x, exposure)) ||
			(exposure.ManagedAclName is not null && !frontend.Acls.Any(x => x.Name == exposure.ManagedAclName)))
			throw new ResourceConflictException("Exposure drift detected.");
	}

	private static int FindRulePosition(HaproxyFrontendResource frontend, ManagedRoute exposure) => frontend.BackendSwitchingRules.FindIndex(x => IsManagedRule(x, exposure));

	private static async Task CompensateAndRethrow(Func<CancellationToken, Task> compensate, Exception originalException, string operation)
	{
		try
		{
			await compensate(CancellationToken.None);
		}
		catch (Exception compensationException)
		{
			throw new AggregateException($"HAProxy compensation failed while {operation}.", originalException, compensationException);
		}

		ExceptionDispatchInfo.Capture(originalException).Throw();
	}

	private static bool IsManagedRule(HaproxyBackendSwitchingRuleResource rule, ManagedRoute exposure) =>
		rule.BackendName == exposure.State.BackendName &&
		rule.Cond == (exposure.State.Condition == ExposureCondition.If ? "if" : "unless") &&
		rule.CondTest == exposure.RuleCondition;

	private static HaproxyAclResource ToAcl(string name, ExposureMatcher matcher) => new()
	{
		Name = name,
		Criterion = matcher.Type switch
		{
			ExposureMatcherType.PathPrefix => "path_beg",
			ExposureMatcherType.PathExact => "path",
			ExposureMatcherType.PathRegex => "path_reg",
			ExposureMatcherType.Host => "hdr(host)",
			ExposureMatcherType.HostPrefix => "hdr_beg(host)",
			ExposureMatcherType.HostRegex => "hdr_reg(host)",
			ExposureMatcherType.Source => "src",
			ExposureMatcherType.Method => "method",
			ExposureMatcherType.Header => $"hdr({matcher.HeaderName})",
			ExposureMatcherType.HeaderRegex => $"hdr_reg({matcher.HeaderName})",
			_ => throw new ArgumentOutOfRangeException(),
		},
		Value = matcher.Type is ExposureMatcherType.Host or ExposureMatcherType.HostPrefix or ExposureMatcherType.Method or ExposureMatcherType.Header
			? $"-i {matcher.Value}"
			: matcher.Value,
	};

	private sealed record ManagedRoute
	{
		public required Guid Id { get; init; }
		public required ExposureUpsertRequest State { get; init; }
		public string? ManagedAclName { get; init; }
		public required string RuleCondition { get; init; }
	}
}
