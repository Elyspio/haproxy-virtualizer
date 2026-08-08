using System.Security.Claims;
using Elyspio.Utils.Telemetry.Technical.Helpers;
using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Exceptions;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using ModelContextProtocol.Server;

namespace Haproxy.Editor.Mcp;

[McpServerToolType]
public sealed class QuickmapMcpTools(
	IExposureService exposureService,
	IHttpContextAccessor httpContextAccessor,
	ILogger<QuickmapMcpTools> logger) : TracingService(logger)
{
	[McpServerTool(Name = "haproxy-editor_discover", Title = "Discover HAProxy routing targets", ReadOnly = true)]
	public async Task<QuickmapToolResult<ExposureDiscoveryResource>> Discover()
	{
		using var trace = LogService();
		return await Execute(exposureService.Discover);
	}

	[McpServerTool(Name = "haproxy-editor_list", Title = "List HAProxy mappings", ReadOnly = true)]
	public async Task<QuickmapToolResult<IReadOnlyCollection<ExposureResource>>> List()
	{
		using var trace = LogService();
		return await Execute(exposureService.List);
	}

	[McpServerTool(Name = "haproxy-editor_get", Title = "Get an HAProxy mapping", ReadOnly = true)]
	public async Task<QuickmapToolResult<ExposureResource>> Get(Guid id)
	{
		using var trace = LogService($"{Log.F(id)}");
		try
		{
			var mapping = await exposureService.Get(id);
			return mapping is null ? Failure<ExposureResource>("not_found", "The requested mapping does not exist.", new { id }) : Success(mapping);
		}
		catch (Exception exception)
		{
			return Failure<ExposureResource>("upstream_failure", "Unable to retrieve the requested mapping.", new { id, exception.GetType().Name });
		}
	}

	[McpServerTool(Name = "haproxy-editor_create", Title = "Create an HAProxy mapping", Destructive = true)]
	public async Task<QuickmapToolResult<ExposureResource>> Create(ExposureUpsertRequest request)
	{
		using var trace = LogService($"{Log.F(request.FrontendName)} {Log.F(request.BackendName)}");
		return await Execute(() => exposureService.Create(GetOwner(), GetSubject(), request));
	}

	[McpServerTool(Name = "haproxy-editor_update", Title = "Update an HAProxy mapping", Destructive = true)]
	public async Task<QuickmapToolResult<ExposureResource>> Update(Guid id, ExposureUpsertRequest request)
	{
		using var trace = LogService($"{Log.F(id)} {Log.F(request.FrontendName)} {Log.F(request.BackendName)}");
		try
		{
			var mapping = await exposureService.Replace(GetOwner(), GetSubject(), id, request);
			return mapping is null ? Failure<ExposureResource>("not_found", "The requested mapping does not exist or is not owned by this client.", new { id }) : Success(mapping);
		}
		catch (Exception exception)
		{
			return ToFailure<ExposureResource>(exception);
		}
	}

	[McpServerTool(Name = "haproxy-editor_delete", Title = "Delete an HAProxy mapping", Destructive = true)]
	public async Task<QuickmapToolResult<object>> Delete(Guid id)
	{
		using var trace = LogService($"{Log.F(id)}");
		try
		{
			return await exposureService.Delete(GetOwner(), id)
				? Success<object>(new { id, deleted = true })
				: Failure<object>("not_found", "The requested mapping does not exist or is not owned by this client.", new { id });
		}
		catch (Exception exception)
		{
			return ToFailure<object>(exception);
		}
	}

	private static async Task<QuickmapToolResult<T>> Execute<T>(Func<Task<T>> action)
	{
		try
		{
			return Success(await action());
		}
		catch (Exception exception)
		{
			return ToFailure<T>(exception);
		}
	}

	private string GetOwner()
	{
		return httpContextAccessor.HttpContext?.User.FindFirstValue("azp")
		       ?? httpContextAccessor.HttpContext?.User.FindFirstValue("client_id")
		       ?? throw new UnauthorizedAccessException("The source client is missing.");
	}

	private string? GetSubject()
	{
		return httpContextAccessor.HttpContext?.User.FindFirstValue("sub");
	}

	private static QuickmapToolResult<T> Success<T>(T value)
	{
		return new QuickmapToolResult<T> { Success = true, Data = value };
	}

	private static QuickmapToolResult<T> Failure<T>(string code, string message, object? context = null)
	{
		return new QuickmapToolResult<T> { Success = false, Error = new QuickmapToolError { Code = code, Message = message, Context = context } };
	}

	private static QuickmapToolResult<T> ToFailure<T>(Exception exception)
	{
		return exception switch
		{
			RequestValidationException => Failure<T>("invalid_argument", exception.Message),
			ResourceNotFoundException => Failure<T>("not_found", exception.Message),
			UnauthorizedAccessException => Failure<T>("unauthorized", "The caller does not have a source client identity."),
			ResourceConflictException => Failure<T>("conflict", exception.Message),
			UpstreamDependencyException => Failure<T>("upstream_failure", "The mapping could not be applied."),
			_ => Failure<T>("upstream_failure", "The mapping could not be applied."),
		};
	}
}

public sealed record QuickmapToolResult<T>
{
	public required bool Success { get; init; }
	public T? Data { get; init; }
	public QuickmapToolError? Error { get; init; }
}

public sealed record QuickmapToolError
{
	public required string Code { get; init; }
	public required string Message { get; init; }
	public object? Context { get; init; }
}
