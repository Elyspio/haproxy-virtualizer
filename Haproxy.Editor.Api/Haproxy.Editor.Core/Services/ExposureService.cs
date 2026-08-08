using Elyspio.Utils.Telemetry.Technical.Helpers;
using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.Extensions.Logging;

namespace Haproxy.Editor.Core.Services;

public sealed class ExposureService(
	IHaproxyService haproxyService,
	IExposureRepository repository,
	IExposureMutationLock mutationLock,
	ILogger<ExposureService> logger) : TracingService(logger), IExposureService
{
	public async Task<ExposureResource> Create(string ownerClientId, string? subjectId, ExposureUpsertRequest request)
	{
		using var trace = LogService($"{Log.F(ownerClientId)} {Log.F(request.FrontendName)} {Log.F(request.BackendName)}");

		using var held = await mutationLock.Acquire();
		var snapshot = await haproxyService.GetConfig();
		var id = Guid.NewGuid();
		var managed = BuildManaged(id, ownerClientId, subjectId, request, DateTimeOffset.UtcNow);
		EnsureNoDuplicateRule(snapshot, managed);
		Apply(snapshot, managed, replacementPosition: null);
		await haproxyService.SaveConfig(snapshot);
		await repository.Create(managed);
		return ToResource(managed);
	}

	public async Task<IReadOnlyCollection<ExposureResource>> List()
	{
		using var trace = LogService();
		return (await repository.ListAll()).Select(ToResource).ToArray();
	}

	public async Task<ExposureResource?> Get(Guid id)
	{
		using var trace = LogService($"{Log.F(id)}");

		var exposure = await repository.Get(id);
		return exposure is null ? null : ToResource(exposure);
	}

	public async Task<ExposureDiscoveryResource> Discover()
	{
		using var trace = LogService();

		var snapshot = await haproxyService.GetConfig();
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

	public async Task<ExposureResource?> Replace(string ownerClientId, string? subjectId, Guid id, ExposureUpsertRequest request)
	{
		using var trace = LogService($"{Log.F(ownerClientId)} {Log.F(id)} {Log.F(request.FrontendName)} {Log.F(request.BackendName)}");

		using var held = await mutationLock.Acquire();
		var current = await repository.Get(ownerClientId, id);
		if (current is null) return null;
		var snapshot = await haproxyService.GetConfig();
		EnsureNotDrifted(snapshot, current);
		var next = BuildManaged(id, ownerClientId, subjectId, request, current.CreatedAt);
		var previousPosition = FindRulePosition(snapshot.Frontends.Single(x => x.Name == current.FrontendName), current);
		Remove(snapshot, current);
		EnsureNoDuplicateRule(snapshot, next);
		Apply(snapshot, next, previousPosition);
		await haproxyService.SaveConfig(snapshot);
		await repository.Replace(next);
		return ToResource(next);
	}

	public async Task<bool> Delete(string ownerClientId, Guid id)
	{
		using var trace = LogService($"{Log.F(ownerClientId)} {Log.F(id)}");

		using var held = await mutationLock.Acquire();
		var current = await repository.Get(ownerClientId, id);
		if (current is null) return false;
		var snapshot = await haproxyService.GetConfig();
		EnsureNotDrifted(snapshot, current);
		Remove(snapshot, current);
		await haproxyService.SaveConfig(snapshot);
		await repository.Delete(id);
		return true;
	}

	private static ManagedExposure BuildManaged(Guid id, string owner, string? subject, ExposureUpsertRequest request, DateTimeOffset createdAt)
	{
		ValidateRequest(request);
		var aclName = request.Matcher is null ? null : $"api_exposure_{id:N}";
		var names = (aclName is null ? [] : new[] { aclName }).Concat(request.AclReferences).ToArray();
		var separator = request.Operator == ExposureOperator.And ? " && " : " || ";
		return new ManagedExposure
		{
			Id = id, OwnerClientId = owner, SubjectId = subject, FrontendName = request.FrontendName.Trim(), BackendName = request.BackendName.Trim(),
			Matcher = request.Matcher, AclReferences = request.AclReferences.Select(x => x.Trim()).Distinct(StringComparer.Ordinal).ToList(),
			Operator = request.Operator, Condition = request.Condition, ManagedAclName = aclName,
			RuleCondition = names.Length == 1 ? names[0] : $"({string.Join(separator, names)})",
			CreatedAt = createdAt, UpdatedAt = DateTimeOffset.UtcNow,
		};
	}

	private static void ValidateRequest(ExposureUpsertRequest request)
	{
		if (string.IsNullOrWhiteSpace(request.FrontendName) || string.IsNullOrWhiteSpace(request.BackendName)) throw new RequestValidationException("FrontendName and BackendName are required.");
		if (request.Matcher is null && request.AclReferences.Count == 0) throw new RequestValidationException("A matcher or an ACL reference is required.");
		if (request.AclReferences.Any(string.IsNullOrWhiteSpace)) throw new RequestValidationException("ACL references cannot be empty.");
		if (request.Matcher is { } matcher && (string.IsNullOrWhiteSpace(matcher.Value) ||
		                                       (matcher.Type is ExposureMatcherType.Header or ExposureMatcherType.HeaderRegex && string.IsNullOrWhiteSpace(matcher.HeaderName))))
			throw new RequestValidationException("The matcher is incomplete.");
	}

	private static void Apply(HaproxyResourceSnapshot snapshot, ManagedExposure exposure, int? replacementPosition)
	{
		var frontend = snapshot.Frontends.SingleOrDefault(x => x.Name == exposure.FrontendName) ?? throw new ResourceNotFoundException("The requested frontend does not exist.");
		if (!snapshot.Backends.Any(x => x.Name == exposure.BackendName)) throw new ResourceNotFoundException("The requested backend does not exist.");
		if (exposure.AclReferences.Any(reference => !frontend.Acls.Any(acl => acl.Name == reference))) throw new ResourceNotFoundException("An ACL reference does not exist on the requested frontend.");
		if (exposure.ManagedAclName is not null) frontend.Acls.Add(ToAcl(exposure.ManagedAclName, exposure.Matcher!));
		var rule = new HaproxyBackendSwitchingRuleResource
			{ BackendName = exposure.BackendName, Cond = exposure.Condition == ExposureCondition.If ? "if" : "unless", CondTest = exposure.RuleCondition };
		if (replacementPosition is null) frontend.BackendSwitchingRules.Add(rule);
		else frontend.BackendSwitchingRules.Insert(Math.Min(frontend.BackendSwitchingRules.Count, replacementPosition.Value), rule);
	}

	private static void EnsureNoDuplicateRule(HaproxyResourceSnapshot snapshot, ManagedExposure exposure)
	{
		var frontend = snapshot.Frontends.SingleOrDefault(x => x.Name == exposure.FrontendName) ?? throw new ResourceNotFoundException("The requested frontend does not exist.");
		var condition = exposure.Condition == ExposureCondition.If ? "if" : "unless";
		if (frontend.BackendSwitchingRules.Any(rule => rule.Cond == condition && rule.CondTest == exposure.RuleCondition))
		{
			throw new ResourceConflictException("An identical backend-switching condition already exists on the requested frontend.");
		}
	}

	private static void Remove(HaproxyResourceSnapshot snapshot, ManagedExposure exposure)
	{
		var frontend = snapshot.Frontends.SingleOrDefault(x => x.Name == exposure.FrontendName) ?? throw new ResourceConflictException("Exposure drift detected: frontend is missing.");
		frontend.BackendSwitchingRules.RemoveAll(x => IsManagedRule(x, exposure));
		if (exposure.ManagedAclName is not null) frontend.Acls.RemoveAll(x => x.Name == exposure.ManagedAclName);
	}

	private static void EnsureNotDrifted(HaproxyResourceSnapshot snapshot, ManagedExposure exposure)
	{
		var frontend = snapshot.Frontends.SingleOrDefault(x => x.Name == exposure.FrontendName);
		if (frontend is null || !frontend.BackendSwitchingRules.Any(x => IsManagedRule(x, exposure)) ||
		    (exposure.ManagedAclName is not null && !frontend.Acls.Any(x => x.Name == exposure.ManagedAclName))) throw new ResourceConflictException("Exposure drift detected.");
	}

	private static int FindRulePosition(HaproxyFrontendResource frontend, ManagedExposure exposure) => frontend.BackendSwitchingRules.FindIndex(x => IsManagedRule(x, exposure));

	private static bool IsManagedRule(HaproxyBackendSwitchingRuleResource rule, ManagedExposure exposure) => rule.BackendName == exposure.BackendName &&
	                                                                                                         rule.Cond == (exposure.Condition == ExposureCondition.If ? "if" : "unless") &&
	                                                                                                         rule.CondTest == exposure.RuleCondition;

	private static HaproxyAclResource ToAcl(string name, ExposureMatcher matcher) => new()
	{
		Name = name,
		Criterion = matcher.Type switch
		{
			ExposureMatcherType.PathPrefix => "path_beg", ExposureMatcherType.PathExact => "path", ExposureMatcherType.PathRegex => "path_reg", ExposureMatcherType.Host => "hdr(host)",
			ExposureMatcherType.HostPrefix => "hdr_beg(host)", ExposureMatcherType.HostRegex => "hdr_reg(host)", ExposureMatcherType.Source => "src", ExposureMatcherType.Method => "method",
			ExposureMatcherType.Header => $"hdr({matcher.HeaderName})", ExposureMatcherType.HeaderRegex => $"hdr_reg({matcher.HeaderName})", _ => throw new ArgumentOutOfRangeException()
		},
		Value = matcher.Type is ExposureMatcherType.Host or ExposureMatcherType.HostPrefix or ExposureMatcherType.Method or ExposureMatcherType.Header
			? $"-i {matcher.Value.Trim()}"
			: matcher.Value.Trim()
	};

	private static ExposureResource ToResource(ManagedExposure value) => new()
	{
		Id = value.Id, FrontendName = value.FrontendName, BackendName = value.BackendName, Matcher = value.Matcher, AclReferences = value.AclReferences, Operator = value.Operator,
		Condition = value.Condition, CreatedAt = value.CreatedAt, UpdatedAt = value.UpdatedAt
	};
}
