using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.Extensions.Logging;
using System.Reflection;
using System.Runtime.Serialization;
using Generated = Haproxy.Editor.Adapters.Haproxy;

namespace Haproxy.Editor.Core.Services;

public class HaproxyService : TracingService, IHaproxyService
{
	private readonly Generated.HaproxyClient _client;

	public HaproxyService(Generated.HaproxyClient client, ILogger<HaproxyService> logger) : base(logger)
	{
		_client = client;
	}

	public async Task<HaproxyResourceSnapshot> GetConfig()
	{
		using var _ = LogService();
		return await ExecuteDataPlaneCall("loading HAProxy configuration", () => LoadSnapshot());
	}

	public async Task<DashboardSnapshot> GetDashboardSnapshot()
	{
		using var _ = LogService();

		var configTask = ExecuteDataPlaneCall("loading HAProxy configuration", () => LoadSnapshot());
		var healthTask = ExecuteDataPlaneCall("loading HAProxy health", () => _client.GetHealthAsync());
		var statsTask = ExecuteDataPlaneCall("loading HAProxy stats", () => _client.GetStatsAsync());

		await Task.WhenAll(configTask, healthTask, statsTask);

		var config = await configTask;
		var health = await healthTask;
		var stats = await statsTask;
		var runtimeServers = await LoadRuntimeServers(config.Backends);
		var backends = BuildRuntimeBackends(config, stats, runtimeServers);
		var alerts = BuildDashboardAlerts(config, health, stats, backends);

		return new DashboardSnapshot
		{
			Summary = BuildDashboardSummary(config, health, alerts, backends),
			Alerts = alerts,
			Backends = backends,
		};
	}

	public async Task<HaproxyResourceSnapshot> SaveConfig(HaproxyResourceSnapshot config)
	{
		using var _ = LogService();

		var transaction = await ExecuteDataPlaneCall("starting HAProxy transaction", () => _client.StartTransactionAsync(ToClientVersion(config.Version)));
		var transactionId = GetTransactionId(transaction);

		try
		{
			var baseline = await ExecuteDataPlaneCall("loading HAProxy configuration baseline", () => LoadSnapshot(transactionId));
			await ApplySnapshot(config, baseline, transactionId);
			await ExecuteDataPlaneCall("committing HAProxy transaction", () => _client.CommitTransactionAsync(transactionId));
		}
		catch (Generated.ApiException exception)
		{
			await TryDeleteTransaction(transactionId);
			throw CreateDataPlaneException("saving HAProxy configuration", exception);
		}
		catch
		{
			await TryDeleteTransaction(transactionId);
			throw;
		}

		return await ExecuteDataPlaneCall("loading saved HAProxy configuration", () => LoadSnapshot());
	}

	public async Task<IValidationResult> ValidateConfig(HaproxyResourceSnapshot config)
	{
		using var _ = LogService();

		var transaction = await ExecuteDataPlaneCall("starting HAProxy transaction", () => _client.StartTransactionAsync(ToClientVersion(config.Version)));
		var transactionId = GetTransactionId(transaction);

		try
		{
			var baseline = await ExecuteDataPlaneCall("loading HAProxy configuration baseline", () => LoadSnapshot(transactionId));
			await ApplySnapshot(config, baseline, transactionId);
			return new ValidationResult(true);
		}
		catch (Generated.ApiException exception)
		{
			return new ValidationResult(false, BuildDataPlaneErrorMessage("validating HAProxy configuration", exception));
		}
		catch (UpstreamDependencyException)
		{
			throw;
		}
		catch (Exception err)
		{
			return new ValidationResult(false, err.Message);
		}
		finally
		{
			await TryDeleteTransaction(transactionId);
		}
	}

	private async Task<HaproxyResourceSnapshot> LoadSnapshot(string? transactionId = null)
	{
		using var _ = LogService();

		var versionTask = _client.GetConfigurationVersionAsync(transactionId);
		var globalTask = _client.GetGlobalAsync(transactionId, true);
		var defaultsTask = _client.GetDefaultsSectionsAsync(transactionId, true);
		var frontendsTask = _client.GetFrontendsAsync(transactionId, true);
		var backendsTask = _client.GetBackendsAsync(transactionId, true);

		await Task.WhenAll(versionTask, globalTask, defaultsTask, frontendsTask, backendsTask);

		var frontends = await BuildFrontends((await frontendsTask).ToList(), transactionId);
		var backends = await BuildBackends((await backendsTask).ToList(), transactionId);

		return new HaproxyResourceSnapshot
		{
			Version = await versionTask,
			Global = ToResource(await globalTask),
			Defaults = (await defaultsTask)
				.Select(ToResource)
				.OrderBy(x => x.Name, StringComparer.Ordinal)
				.ToList(),
			Frontends = frontends.OrderBy(x => x.Name, StringComparer.Ordinal).ToList(),
			Backends = backends.OrderBy(x => x.Name, StringComparer.Ordinal).ToList(),
			Summary = new HaproxySummary
			{
				FrontendCount = frontends.Count,
				BackendCount = backends.Count,
				ServerCount = backends.Sum(x => x.Servers.Count),
			},
		};
	}

	private async Task<Dictionary<string, IReadOnlyCollection<Generated.Runtime_server>>> LoadRuntimeServers(IEnumerable<HaproxyBackendResource> backends)
	{
		var tasks = backends.Select(async backend =>
		{
			var servers = await ExecuteDataPlaneCall("loading HAProxy runtime servers", () => _client.GetAllRuntimeServerAsync(backend.Name));
			return new KeyValuePair<string, IReadOnlyCollection<Generated.Runtime_server>>(backend.Name, servers.ToList());
		});

		return (await Task.WhenAll(tasks)).ToDictionary(x => x.Key, x => x.Value, StringComparer.Ordinal);
	}

	private static List<RuntimeBackendStatus> BuildRuntimeBackends(
		HaproxyResourceSnapshot config,
		Generated.Native_stats? stats,
		IReadOnlyDictionary<string, IReadOnlyCollection<Generated.Runtime_server>> runtimeServers)
	{
		var allStats = stats?.Stats?.ToList() ?? [];
		var backendStats = allStats
			.Where(x => x.Type == Generated.Native_statType.Backend)
			.ToDictionary(GetStatName, x => x, StringComparer.Ordinal);
		var serverStats = allStats
			.Where(x => x.Type == Generated.Native_statType.Server)
			.GroupBy(x => $"{x.Backend_name ?? string.Empty}/{x.Name ?? string.Empty}", StringComparer.Ordinal)
			.ToDictionary(x => x.Key, x => x.Last(), StringComparer.Ordinal);

		return config.Backends.Select(backend =>
		{
			runtimeServers.TryGetValue(backend.Name, out var runtimeBackendServers);
			backendStats.TryGetValue(backend.Name, out var backendStat);

			var runtimeByName = (runtimeBackendServers ?? [])
				.Where(x => !string.IsNullOrWhiteSpace(x.Name))
				.ToDictionary(x => x.Name!, x => x, StringComparer.Ordinal);

			var servers = backend.Servers.Select(server =>
			{
				runtimeByName.TryGetValue(server.Name, out var runtimeServer);
				serverStats.TryGetValue($"{backend.Name}/{server.Name}", out var serverStat);

				return new RuntimeServerStatus
				{
					Name = server.Name,
					Status = DetermineServerStatus(runtimeServer, serverStat),
					Address = runtimeServer?.Address ?? server.Address,
					Port = runtimeServer?.Port ?? server.Port,
					AdminState = runtimeServer?.Admin_state?.ToString()?.ToLowerInvariant(),
					OperationalState = runtimeServer?.Operational_state?.ToString()?.ToLowerInvariant(),
					CheckStatus = serverStat?.Stats?.Check_status?.ToString()?.ToLowerInvariant(),
					CurrentSessions = serverStat?.Stats?.Scur ?? 0,
					SessionRate = serverStat?.Stats?.Rate ?? serverStat?.Stats?.Conn_rate ?? 0,
				};
			}).ToList();

			return new RuntimeBackendStatus
			{
				Name = backend.Name,
				Status = DetermineBackendStatus(backendStat, servers),
				CurrentSessions = backendStat?.Stats?.Scur ?? 0,
				SessionRate = backendStat?.Stats?.Rate ?? backendStat?.Stats?.Conn_rate ?? 0,
				BytesIn = backendStat?.Stats?.Bin ?? 0,
				BytesOut = backendStat?.Stats?.Bout ?? 0,
				HealthyServers = servers.Count(x => x.Status == RuntimeStatus.Up),
				DownServers = servers.Count(x => x.Status == RuntimeStatus.Down),
				MaintenanceServers = servers.Count(x => x.Status == RuntimeStatus.Maintenance),
				Servers = servers,
			};
		}).ToList();
	}

	private static DashboardSummary BuildDashboardSummary(
		HaproxyResourceSnapshot config,
		Generated.Health? health,
		IReadOnlyCollection<DashboardAlert> alerts,
		IReadOnlyCollection<RuntimeBackendStatus> backends)
	{
		var criticalAlerts = alerts.Count(x => x.Severity == DashboardAlertSeverity.Critical);
		var totalRoutes = config.Frontends.Sum(x => x.BackendSwitchingRules.Count);
		var activeServices = backends.Sum(x => x.HealthyServers);
		var downServices = backends.Sum(x => x.DownServers);

		return new DashboardSummary
		{
			GeneratedAt = DateTimeOffset.UtcNow,
			RuntimeStatus = health?.Haproxy switch
			{
				Generated.HealthHaproxy.Up => RuntimeStatus.Up,
				Generated.HealthHaproxy.Down => RuntimeStatus.Down,
				_ => RuntimeStatus.Unknown,
			},
			Alerts = new DashboardKpi
			{
				Title = "Alerts",
				Value = criticalAlerts > 0 ? criticalAlerts : alerts.Count,
				Subtitle = criticalAlerts > 0 ? $"{criticalAlerts} critical issues" : alerts.Count == 0 ? "No active issues" : $"{alerts.Count} operational notices",
				Tone = criticalAlerts > 0 ? DashboardTone.Critical : alerts.Count > 0 ? DashboardTone.Warning : DashboardTone.Success,
				Trend = [alerts.Count, criticalAlerts, backends.Sum(x => x.DownServers), backends.Sum(x => x.MaintenanceServers)],
			},
			Routes = new DashboardKpi
			{
				Title = "Routes",
				Value = totalRoutes,
				Subtitle = totalRoutes == 0 ? "No switching rules" : $"{totalRoutes} redirected rules",
				Tone = totalRoutes > 0 ? DashboardTone.Warning : DashboardTone.Neutral,
				Trend = config.Frontends.Select(x => x.BackendSwitchingRules.Count).DefaultIfEmpty(0).ToList(),
			},
			Services = new DashboardKpi
			{
				Title = "Services",
				Value = activeServices,
				Subtitle = downServices > 0 ? $"{downServices} services degraded" : $"{backends.Count} backend groups monitored",
				Tone = downServices > 0 ? DashboardTone.Warning : DashboardTone.Info,
				Trend = backends.Select(x => x.SessionRate).DefaultIfEmpty(0).ToList(),
			},
		};
	}

	private static List<DashboardAlert> BuildDashboardAlerts(
		HaproxyResourceSnapshot config,
		Generated.Health? health,
		Generated.Native_stats? stats,
		IReadOnlyCollection<RuntimeBackendStatus> backends)
	{
		var alerts = new List<DashboardAlert>();

		if (health?.Haproxy != Generated.HealthHaproxy.Up)
		{
			alerts.Add(new DashboardAlert
			{
				Id = "haproxy-health",
				Severity = DashboardAlertSeverity.Critical,
				Message = $"HAProxy health is {health?.Haproxy?.ToString()?.ToLowerInvariant() ?? "unknown"}.",
				ResourceType = DashboardResourceType.Service,
				ResourceName = "haproxy",
			});
		}

		if (!string.IsNullOrWhiteSpace(stats?.Error))
		{
			alerts.Add(new DashboardAlert
			{
				Id = "stats-error",
				Severity = DashboardAlertSeverity.Warning,
				Message = stats!.Error!,
				ResourceType = DashboardResourceType.Runtime,
				ResourceName = "stats",
			});
		}

		foreach (var backend in config.Backends.Where(x => x.Servers.Count == 0))
		{
			alerts.Add(new DashboardAlert
			{
				Id = $"backend-empty-{backend.Name}",
				Severity = DashboardAlertSeverity.Critical,
				Message = $"Backend {backend.Name} has no servers configured.",
				ResourceType = DashboardResourceType.Backend,
				ResourceName = backend.Name,
			});
		}

		foreach (var frontend in config.Frontends)
		{
			var knownBackends = config.Backends.Select(x => x.Name).ToHashSet(StringComparer.Ordinal);
			var hasDefaultBackend = !string.IsNullOrWhiteSpace(frontend.DefaultBackend);
			var hasRules = frontend.BackendSwitchingRules.Count > 0;

			if (!hasDefaultBackend && !hasRules)
			{
				alerts.Add(new DashboardAlert
				{
					Id = $"frontend-empty-{frontend.Name}",
					Severity = DashboardAlertSeverity.Warning,
					Message = $"Frontend {frontend.Name} has no route target.",
					ResourceType = DashboardResourceType.Frontend,
					ResourceName = frontend.Name,
				});
			}

			if (hasDefaultBackend && !knownBackends.Contains(frontend.DefaultBackend!))
			{
				alerts.Add(new DashboardAlert
				{
					Id = $"frontend-default-{frontend.Name}",
					Severity = DashboardAlertSeverity.Critical,
					Message = $"Frontend {frontend.Name} points to missing backend {frontend.DefaultBackend}.",
					ResourceType = DashboardResourceType.Frontend,
					ResourceName = frontend.Name,
				});
			}

			foreach (var rule in frontend.BackendSwitchingRules.Where(rule => !knownBackends.Contains(rule.BackendName)))
			{
				alerts.Add(new DashboardAlert
				{
					Id = $"frontend-rule-{frontend.Name}-{rule.BackendName}",
					Severity = DashboardAlertSeverity.Critical,
					Message = $"Routing rule on {frontend.Name} points to missing backend {rule.BackendName}.",
					ResourceType = DashboardResourceType.Frontend,
					ResourceName = frontend.Name,
				});
			}
		}

		foreach (var backend in backends.Where(x => x.DownServers > 0))
		{
			alerts.Add(new DashboardAlert
			{
				Id = $"backend-runtime-{backend.Name}",
				Severity = backend.HealthyServers == 0 ? DashboardAlertSeverity.Critical : DashboardAlertSeverity.Warning,
				Message = backend.HealthyServers == 0
					? $"All services in backend {backend.Name} are unavailable."
					: $"{backend.DownServers} services are down in backend {backend.Name}.",
				ResourceType = DashboardResourceType.Backend,
				ResourceName = backend.Name,
			});
		}

		return alerts;
	}

	private static RuntimeStatus DetermineBackendStatus(Generated.Native_stat? backendStat, IReadOnlyCollection<RuntimeServerStatus> servers)
	{
		if (servers.Count == 0)
		{
			return RuntimeStatus.Empty;
		}

		if (servers.Any(x => x.Status == RuntimeStatus.Up) && servers.Any(x => x.Status == RuntimeStatus.Down))
		{
			return RuntimeStatus.Degraded;
		}

		if (servers.All(x => x.Status == RuntimeStatus.Down))
		{
			return RuntimeStatus.Critical;
		}

		if (servers.All(x => x.Status == RuntimeStatus.Maintenance))
		{
			return RuntimeStatus.Maintenance;
		}

		return backendStat?.Stats?.Status switch
		{
			Generated.Native_stat_statsStatus.UP => RuntimeStatus.Healthy,
			Generated.Native_stat_statsStatus.No_check => RuntimeStatus.Healthy,
			Generated.Native_stat_statsStatus.MAINT => RuntimeStatus.Maintenance,
			Generated.Native_stat_statsStatus.DOWN => RuntimeStatus.Critical,
			_ => servers.Any(x => x.Status == RuntimeStatus.Up) ? RuntimeStatus.Healthy : RuntimeStatus.Unknown,
		};
	}

	private static RuntimeStatus DetermineServerStatus(Generated.Runtime_server? runtimeServer, Generated.Native_stat? serverStat)
	{
		if (runtimeServer?.Admin_state is Generated.Runtime_serverAdmin_state.Maint or Generated.Runtime_serverAdmin_state.Drain)
		{
			return RuntimeStatus.Maintenance;
		}

		if (runtimeServer?.Operational_state == Generated.Runtime_serverOperational_state.Down)
		{
			return RuntimeStatus.Down;
		}

		return serverStat?.Stats?.Status switch
		{
			Generated.Native_stat_statsStatus.UP => RuntimeStatus.Up,
			Generated.Native_stat_statsStatus.No_check => RuntimeStatus.Up,
			Generated.Native_stat_statsStatus.MAINT => RuntimeStatus.Maintenance,
			Generated.Native_stat_statsStatus.DOWN => RuntimeStatus.Down,
			_ => runtimeServer?.Operational_state == Generated.Runtime_serverOperational_state.Up ? RuntimeStatus.Up : RuntimeStatus.Unknown,
		};
	}

	private static string GetStatName(Generated.Native_stat stat)
	{
		return stat.Backend_name
		       ?? stat.Name
		       ?? string.Empty;
	}

	private async Task<List<HaproxyFrontendResource>> BuildFrontends(IReadOnlyList<Generated.Frontend> frontends, string? transactionId)
	{
		var tasks = frontends.Select(async frontend =>
		{
			var bindsTask = _client.GetAllBindFrontendAsync(frontend.Name, transactionId);
			var aclsTask = _client.GetAllAclFrontendAsync(frontend.Name, null, transactionId);
			var rulesTask = _client.GetBackendSwitchingRulesAsync(frontend.Name, transactionId);

			await Task.WhenAll(bindsTask, aclsTask, rulesTask);

			return new HaproxyFrontendResource
			{
				Name = frontend.Name,
				Mode = ToApiString(frontend.Mode),
				DefaultBackend = frontend.Default_backend,
				Binds = (await bindsTask).Select(ToResource).OrderBy(x => x.Name, StringComparer.Ordinal).ToList(),
				Acls = (await aclsTask).Select(ToResource).OrderBy(x => x.Name, StringComparer.Ordinal).ToList(),
				BackendSwitchingRules = (await rulesTask).Select(ToResource).ToList(),
			};
		});

		return (await Task.WhenAll(tasks)).ToList();
	}

	private async Task<List<HaproxyBackendResource>> BuildBackends(IReadOnlyList<Generated.Backend> backends, string? transactionId)
	{
		var tasks = backends.Select(async backend =>
		{
			var servers = await _client.GetAllServerBackendAsync(backend.Name, transactionId);

			return new HaproxyBackendResource
			{
				Name = backend.Name,
				Mode = ToApiString(backend.Mode),
				Balance = backend.Balance?.Algorithm.ToString().ToLowerInvariant(),
				AdvCheck = ToApiString(backend.Adv_check),
				Servers = servers.Select(ToResource).OrderBy(x => x.Name, StringComparer.Ordinal).ToList(),
			};
		});

		return (await Task.WhenAll(tasks)).ToList();
	}

	private async Task ApplySnapshot(HaproxyResourceSnapshot desired, HaproxyResourceSnapshot baseline, string transactionId)
	{
		if (desired.Global != baseline.Global)
		{
			await _client.ReplaceGlobalAsync(ToGenerated(desired.Global), transactionId, null, null, true);
		}

		var desiredDefaults = desired.Defaults.ToDictionary(x => x.Name, StringComparer.Ordinal);
		var currentDefaults = baseline.Defaults.ToDictionary(x => x.Name, StringComparer.Ordinal);
		foreach (var defaults in desired.Defaults)
		{
			var payload = ToGenerated(defaults);

			if (!currentDefaults.TryGetValue(defaults.Name, out var existing))
			{
				await _client.AddDefaultsSectionAsync(payload, transactionId, null, null, true);
				continue;
			}

			if (defaults != existing)
			{
				await _client.ReplaceDefaultsSectionAsync(defaults.Name, payload, transactionId, null, null, true);
			}
		}

		var desiredFrontends = desired.Frontends.ToDictionary(x => x.Name, StringComparer.Ordinal);
		var currentFrontends = baseline.Frontends.ToDictionary(x => x.Name, StringComparer.Ordinal);
		foreach (var frontend in desired.Frontends)
		{
			var payload = ToGenerated(frontend);

			if (!currentFrontends.TryGetValue(frontend.Name, out var existing))
			{
				await _client.CreateFrontendAsync(payload, transactionId, null, null, true);
			}
			else if (HasFrontendChanged(frontend, existing))
			{
				await _client.ReplaceFrontendAsync(frontend.Name, payload, transactionId, null, null, true);
			}
		}

		var desiredBackends = desired.Backends.ToDictionary(x => x.Name, StringComparer.Ordinal);
		var currentBackends = baseline.Backends.ToDictionary(x => x.Name, StringComparer.Ordinal);
		foreach (var backend in desired.Backends)
		{
			var payload = ToGenerated(backend);

			if (!currentBackends.TryGetValue(backend.Name, out var existing))
			{
				await _client.CreateBackendAsync(payload, transactionId, null, null, true);
			}
			else if (HasBackendChanged(backend, existing))
			{
				await _client.ReplaceBackendAsync(backend.Name, payload, transactionId, null, null, true);
			}
		}

		foreach (var frontend in desired.Frontends)
		{
			currentFrontends.TryGetValue(frontend.Name, out var current);
			await ReconcileBinds(frontend, current, transactionId);
			await ReconcileFrontendAcls(frontend, current, transactionId);
		}

		foreach (var backend in desired.Backends)
		{
			currentBackends.TryGetValue(backend.Name, out var current);
			await ReconcileServers(backend, current, transactionId);
		}

		foreach (var frontend in desired.Frontends)
		{
			currentFrontends.TryGetValue(frontend.Name, out var current);
			await ReconcileFrontendBackendSwitchingRules(frontend, current, transactionId);
		}

		foreach (var removed in baseline.Frontends.Where(x => !desiredFrontends.ContainsKey(x.Name)))
		{
			await _client.DeleteFrontendAsync(removed.Name, transactionId);
		}

		foreach (var removed in baseline.Backends.Where(x => !desiredBackends.ContainsKey(x.Name)))
		{
			await _client.DeleteBackendAsync(removed.Name, transactionId);
		}

		foreach (var removed in baseline.Defaults.Where(x => !desiredDefaults.ContainsKey(x.Name)))
		{
			await _client.DeleteDefaultsSectionAsync(removed.Name, transactionId, null, null, true);
		}
	}

	private async Task ReconcileBinds(HaproxyFrontendResource desired, HaproxyFrontendResource? current, string transactionId)
	{
		var currentByName = (current?.Binds ?? []).ToDictionary(x => x.Name, StringComparer.Ordinal);
		var desiredByName = desired.Binds.ToDictionary(x => x.Name, StringComparer.Ordinal);

		foreach (var removed in currentByName.Keys.Except(desiredByName.Keys, StringComparer.Ordinal))
		{
			await _client.DeleteBindFrontendAsync(removed, desired.Name, transactionId);
		}

		foreach (var bind in desired.Binds)
		{
			var payload = ToGenerated(bind);

			if (!currentByName.TryGetValue(bind.Name, out var existing))
			{
				await _client.CreateBindFrontendAsync(desired.Name, payload, transactionId);
				continue;
			}

			if (bind != existing)
			{
				await _client.ReplaceBindFrontendAsync(bind.Name, desired.Name, payload, transactionId);
			}
		}
	}

	private async Task ReconcileServers(HaproxyBackendResource desired, HaproxyBackendResource? current, string transactionId)
	{
		var currentByName = (current?.Servers ?? []).ToDictionary(x => x.Name, StringComparer.Ordinal);
		var desiredByName = desired.Servers.ToDictionary(x => x.Name, StringComparer.Ordinal);

		foreach (var removed in currentByName.Keys.Except(desiredByName.Keys, StringComparer.Ordinal))
		{
			await _client.DeleteServerBackendAsync(removed, desired.Name, transactionId);
		}

		foreach (var server in desired.Servers)
		{
			var payload = ToGenerated(server);

			if (!currentByName.TryGetValue(server.Name, out var existing))
			{
				await _client.CreateServerBackendAsync(desired.Name, payload, transactionId);
				continue;
			}

			if (server != existing)
			{
				await _client.ReplaceServerBackendAsync(server.Name, desired.Name, payload, transactionId);
			}
		}
	}

	private async Task ReconcileFrontendAcls(HaproxyFrontendResource desired, HaproxyFrontendResource? current, string transactionId)
	{
		var currentAcls = current?.Acls ?? [];

		if (!desired.Acls.SequenceEqual(currentAcls))
		{
			await _client.ReplaceAllAclFrontendAsync(desired.Name, desired.Acls.Select(ToGenerated), transactionId);
		}
	}

	private async Task ReconcileFrontendBackendSwitchingRules(HaproxyFrontendResource desired, HaproxyFrontendResource? current, string transactionId)
	{
		var currentRules = current?.BackendSwitchingRules ?? [];

		if (!desired.BackendSwitchingRules.SequenceEqual(currentRules))
		{
			await _client.ReplaceBackendSwitchingRulesAsync(desired.Name, desired.BackendSwitchingRules.Select(ToGenerated), transactionId);
		}
	}

	private async Task TryDeleteTransaction(string transactionId)
	{
		try
		{
			await _client.DeleteTransactionAsync(transactionId);
		}
		catch
		{
			// Best-effort cleanup after validation/save failures.
		}
	}

	private static UpstreamDependencyException CreateDataPlaneException(string operation, Generated.ApiException exception)
	{
		return new(BuildDataPlaneErrorMessage(operation, exception), exception);
	}

	private static string BuildDataPlaneErrorMessage(string operation, Generated.ApiException exception)
	{
		var details = string.IsNullOrWhiteSpace(exception.Response)
			? exception.Message
			: exception.Response.Trim();

		if (details.Contains("Client sent an HTTP request to an HTTPS server.", StringComparison.OrdinalIgnoreCase))
		{
			details += " Check the Data Plane API BaseUrl scheme; the current target expects HTTPS.";
		}

		return $"HAProxy Data Plane API error while {operation} (HTTP {exception.StatusCode}): {details}";
	}

	private static async Task<T> ExecuteDataPlaneCall<T>(string operation, Func<Task<T>> action)
	{
		try
		{
			return await action();
		}
		catch (Generated.ApiException exception)
		{
			throw CreateDataPlaneException(operation, exception);
		}
	}

	private static bool HasFrontendChanged(HaproxyFrontendResource desired, HaproxyFrontendResource current)
	{
		return !string.Equals(desired.Mode, current.Mode, StringComparison.Ordinal)
		       || !string.Equals(desired.DefaultBackend, current.DefaultBackend, StringComparison.Ordinal);
	}

	private static bool HasBackendChanged(HaproxyBackendResource desired, HaproxyBackendResource current)
	{
		return !string.Equals(desired.Mode, current.Mode, StringComparison.Ordinal)
		       || !string.Equals(desired.Balance, current.Balance, StringComparison.Ordinal)
		       || !string.Equals(desired.AdvCheck, current.AdvCheck, StringComparison.Ordinal);
	}

	private static string GetTransactionId(Generated.Transaction transaction)
	{
		return transaction.Id ?? throw new InvalidOperationException("Data Plane API did not return a transaction id.");
	}

	private static int ToClientVersion(long version)
	{
		return checked((int)version);
	}

	private static string? ToApiString<TEnum>(TEnum? value) where TEnum : struct, Enum
	{
		if (!value.HasValue)
		{
			return null;
		}

		var field = typeof(TEnum).GetField(value.Value.ToString());
		var enumMember = field?.GetCustomAttribute<EnumMemberAttribute>();
		return enumMember?.Value ?? value.Value.ToString().ToLowerInvariant();
	}

	private static TEnum? ParseEnum<TEnum>(string? value) where TEnum : struct, Enum
	{
		if (string.IsNullOrWhiteSpace(value))
		{
			return null;
		}

		foreach (var field in typeof(TEnum).GetFields(BindingFlags.Public | BindingFlags.Static))
		{
			var enumMember = field.GetCustomAttribute<EnumMemberAttribute>();
			if (!string.Equals(enumMember?.Value, value, StringComparison.OrdinalIgnoreCase)
			    && !string.Equals(field.Name, value, StringComparison.OrdinalIgnoreCase))
			{
				continue;
			}

			return (TEnum)field.GetValue(null)!;
		}

		return null;
	}

	private static HaproxyGlobalResource ToResource(Generated.Global global)
	{
		return new HaproxyGlobalResource
		{
			Daemon = global.Daemon ?? false,
		};
	}

	private static HaproxyDefaultsResource ToResource(Generated.Defaults defaults)
	{
		return new HaproxyDefaultsResource
		{
			Name = defaults.Name ?? string.Empty,
			Mode = ToApiString(defaults.Mode),
		};
	}

	private static HaproxyBindResource ToResource(Generated.Bind bind)
	{
		return new HaproxyBindResource
		{
			Name = bind.Name ?? string.Empty,
			Address = bind.Address,
			Port = bind.Port,
		};
	}

	private static HaproxyAclResource ToResource(Generated.Acl acl)
	{
		return new HaproxyAclResource
		{
			Name = acl.Acl_name ?? string.Empty,
			Criterion = acl.Criterion,
			Value = acl.Value,
		};
	}

	private static HaproxyBackendSwitchingRuleResource ToResource(Generated.Backend_switching_rule rule)
	{
		return new HaproxyBackendSwitchingRuleResource
		{
			BackendName = rule.Name ?? string.Empty,
			Cond = ToApiString(rule.Cond),
			CondTest = rule.Cond_test,
		};
	}

	private static HaproxyServerResource ToResource(Generated.Server server)
	{
		return new HaproxyServerResource
		{
			Name = server.Name ?? string.Empty,
			Address = server.Address,
			Port = server.Port,
			Check = ToApiString(server.Check),
		};
	}

	private static Generated.Global ToGenerated(HaproxyGlobalResource global)
	{
		return new Generated.Global
		{
			Daemon = global.Daemon,
		};
	}

	private static Generated.Defaults ToGenerated(HaproxyDefaultsResource defaults)
	{
		return new Generated.Defaults
		{
			Name = defaults.Name,
			Mode = ParseEnum<Generated.Defaults_baseMode>(defaults.Mode),
		};
	}

	private static Generated.Frontend ToGenerated(HaproxyFrontendResource frontend)
	{
		return new Generated.Frontend
		{
			Name = frontend.Name,
			Mode = ParseEnum<Generated.Frontend_baseMode>(frontend.Mode),
			Default_backend = frontend.DefaultBackend,
		};
	}

	private static Generated.Backend ToGenerated(HaproxyBackendResource backend)
	{
		return new Generated.Backend
		{
			Name = backend.Name,
			Mode = ParseEnum<Generated.Backend_baseMode>(backend.Mode),
			Adv_check = ParseEnum<Generated.Backend_baseAdv_check>(backend.AdvCheck),
			Balance = string.IsNullOrWhiteSpace(backend.Balance)
				? null
				: new Generated.Balance
				{
					Algorithm = ParseEnum<Generated.BalanceAlgorithm>(backend.Balance)
					            ?? throw new InvalidOperationException($"Unsupported balance algorithm '{backend.Balance}'."),
				},
		};
	}

	private static Generated.Bind ToGenerated(HaproxyBindResource bind)
	{
		return new Generated.Bind
		{
			Name = bind.Name,
			Address = bind.Address,
			Port = bind.Port,
		};
	}

	private static Generated.Acl ToGenerated(HaproxyAclResource acl)
	{
		return new Generated.Acl
		{
			Acl_name = acl.Name,
			Criterion = acl.Criterion ?? string.Empty,
			Value = acl.Value,
		};
	}

	private static Generated.Backend_switching_rule ToGenerated(HaproxyBackendSwitchingRuleResource rule)
	{
		return new Generated.Backend_switching_rule
		{
			Name = rule.BackendName,
			Cond = ParseEnum<Generated.Backend_switching_ruleCond>(rule.Cond),
			Cond_test = rule.CondTest,
		};
	}

	private static Generated.Server ToGenerated(HaproxyServerResource server)
	{
		return new Generated.Server
		{
			Name = server.Name,
			Address = server.Address ?? string.Empty,
			Port = server.Port,
			Check = ParseEnum<Generated.Server_paramsCheck>(server.Check),
		};
	}
}
