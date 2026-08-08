using Haproxy.Editor.Abstractions.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Haproxy.Editor.Filters;

public sealed class HttpExceptionFilter(ILogger<HttpExceptionFilter> logger) : IExceptionFilter
{
	public void OnException(ExceptionContext context)
	{
		var (status, title, detail) = context.Exception switch
		{
			RequestValidationException exception => (StatusCodes.Status400BadRequest, "The request is invalid.", exception.Message),
			ResourceNotFoundException exception => (StatusCodes.Status404NotFound, "The requested resource was not found.", exception.Message),
			ResourceConflictException exception => (StatusCodes.Status409Conflict, "The request conflicts with the current state.", exception.Message),
			UnauthorizedAccessException exception => (StatusCodes.Status401Unauthorized, "Authentication is required.", exception.Message),
			UpstreamDependencyException => (StatusCodes.Status502BadGateway, "HAProxy is unavailable.", "The request could not be completed because HAProxy did not respond successfully."),
			_ => default,
		};

		if (status == default) return;

		if (context.Exception is UpstreamDependencyException)
		{
			logger.LogError(context.Exception, "HAProxy Data Plane request failed.");
		}

		context.Result = new ObjectResult(new ProblemDetails
		{
			Status = status,
			Title = title,
			Detail = detail,
		})
		{
			StatusCode = status,
		};
		context.ExceptionHandled = true;
	}
}
