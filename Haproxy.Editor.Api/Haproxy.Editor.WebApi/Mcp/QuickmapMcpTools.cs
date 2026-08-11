using System.ComponentModel;
using Elyspio.Utils.Telemetry.Technical.Helpers;
using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace Haproxy.Editor.Mcp;

[McpServerToolType]
public sealed class QuickmapMcpTools(
	IExposureService exposureService,
	IHttpContextAccessor httpContextAccessor,
	ILogger<QuickmapMcpTools> logger) : TracingService(logger)
{
	[McpServerTool(Name = "haproxy-editor_discover", Title = "Discover HAProxy routing targets", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true, OutputSchemaType = typeof(ExposureDiscoveryResource))]
	[Description("Lists the HAProxy frontends, backends, and existing ACL names available for managed routes.")]
	public Task<ExposureDiscoveryResource> Discover(CancellationToken cancellationToken = default) =>
		Execute(exposureService.Discover, cancellationToken);

	[McpServerTool(Name = "haproxy-editor_list", Title = "List managed HAProxy routes", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true, OutputSchemaType = typeof(ExposureResource[]))]
	[Description("Lists active routes created through the managed exposure subsystem.")]
	public Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken = default) =>
		Execute(exposureService.List, cancellationToken);

	[McpServerTool(Name = "haproxy-editor_get", Title = "Get a managed HAProxy route", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true, OutputSchemaType = typeof(ExposureResource))]
	[Description("Gets one active managed route by exposure identifier.")]
	public async Task<ExposureResource> Get([Description("Managed exposure identifier.")] Guid id, CancellationToken cancellationToken = default)
	{
		using var trace = LogService($"{Log.F(id)}");
		return await Execute(async token => await exposureService.Get(id, token)
			?? throw new ResourceNotFoundException("The requested managed route does not exist."), cancellationToken);
	}

	[McpServerTool(Name = "haproxy-editor_create", Title = "Create a managed HAProxy route", ReadOnly = false, Destructive = false, Idempotent = false, OpenWorld = false, UseStructuredContent = true, OutputSchemaType = typeof(ExposureResource))]
	[Description("Creates and audits a new HAProxy backend-switching route.")]
	public Task<ExposureResource> Create(
		[Description("Complete managed route definition.")] ExposureUpsertRequest request,
		McpServer server,
		CancellationToken cancellationToken = default) =>
		Execute(token => exposureService.Create(GetActor(server), request, token), cancellationToken);

	[McpServerTool(Name = "haproxy-editor_update", Title = "Replace a managed HAProxy route", ReadOnly = false, Destructive = true, Idempotent = false, OpenWorld = false, UseStructuredContent = true, OutputSchemaType = typeof(ExposureResource))]
	[Description("Replaces an active managed route and appends an audit event.")]
	public async Task<ExposureResource> Update(
		[Description("Managed exposure identifier.")] Guid id,
		[Description("Complete replacement route definition.")] ExposureUpsertRequest request,
		McpServer server,
		CancellationToken cancellationToken = default)
	{
		using var trace = LogService($"{Log.F(id)} {Log.F(request.FrontendName)} {Log.F(request.BackendName)}");
		return await Execute(async token => await exposureService.Replace(GetActor(server), id, request, token)
			?? throw new ResourceNotFoundException("The requested managed route does not exist."), cancellationToken);
	}

	[McpServerTool(Name = "haproxy-editor_delete", Title = "Delete a managed HAProxy route", ReadOnly = false, Destructive = true, Idempotent = true, OpenWorld = false, UseStructuredContent = true, OutputSchemaType = typeof(ExposureDeleteResource))]
	[Description("Deletes an active managed route and retains its complete audit history.")]
	public async Task<ExposureDeleteResource> Delete(
		[Description("Managed exposure identifier.")] Guid id,
		McpServer server,
		CancellationToken cancellationToken = default)
	{
		using var trace = LogService($"{Log.F(id)}");
		if (!await Execute(token => exposureService.Delete(GetActor(server), id, token), cancellationToken))
			throw ToMcpException(new ResourceNotFoundException("The requested managed route does not exist."));
		return new ExposureDeleteResource { Id = id, Deleted = true };
	}

	[McpServerTool(Name = "haproxy-editor_history", Title = "Read managed HAProxy route history", ReadOnly = true, Destructive = false, Idempotent = true, OpenWorld = false, UseStructuredContent = true, OutputSchemaType = typeof(ExposureHistoryPage))]
	[Description("Reads the append-only exposure audit history, globally or for one exposure.")]
	public Task<ExposureHistoryPage> History(
		[Description("Optional managed exposure identifier.")] Guid? exposureId = null,
		[Description("Opaque cursor returned by the previous page.")] string? cursor = null,
		[Description("Page size from 1 through 100.")] int limit = 50,
		CancellationToken cancellationToken = default) =>
		Execute(token => exposureService.History(exposureId, cursor, limit, token), cancellationToken);

	private async Task<T> Execute<T>(Func<CancellationToken, Task<T>> action, CancellationToken cancellationToken)
	{
		using var trace = LogService();
		try
		{
			return await action(cancellationToken);
		}
		catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
		{
			throw;
		}
		catch (McpException)
		{
			throw;
		}
		catch (Exception exception)
		{
			throw ToMcpException(exception);
		}
	}

	private ExposureActorResource GetActor(McpServer server)
	{
		var user = httpContextAccessor.HttpContext?.User
			?? throw new UnauthorizedAccessException("The authenticated principal is missing.");
		return ExposureActorFactory.Create(user, server.ClientInfo);
	}

	private static McpException ToMcpException(Exception exception)
	{
		var (code, message) = exception switch
		{
			RequestValidationException => ("invalid_argument", exception.Message),
			ResourceNotFoundException => ("not_found", exception.Message),
			UnauthorizedAccessException => ("unauthorized", "The authenticated actor identity is incomplete."),
			ResourceConflictException => ("conflict", exception.Message),
			UpstreamDependencyException => ("upstream_failure", "The managed route could not be applied."),
			_ => ("upstream_failure", "The managed route operation failed."),
		};
		return new McpException($"{code}: {message}", exception);
	}
}
