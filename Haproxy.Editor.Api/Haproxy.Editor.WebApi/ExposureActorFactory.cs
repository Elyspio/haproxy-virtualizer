using System.Security.Claims;
using Haproxy.Editor.Abstractions.Data;
using ModelContextProtocol.Protocol;

namespace Haproxy.Editor;

internal static class ExposureActorFactory
{
	public static ExposureActorResource Create(ClaimsPrincipal user, Implementation? mcpClient = null)
	{
		var subject = user.FindFirstValue("sub")
			?? throw new UnauthorizedAccessException("The authenticated subject is missing.");
		var oauthClient = user.FindFirstValue("azp")
			?? user.FindFirstValue("client_id")
			?? throw new UnauthorizedAccessException("The source OAuth client is missing.");
		return new ExposureActorResource
		{
			SubjectId = subject,
			Username = user.FindFirstValue("preferred_username") ?? user.FindFirstValue("name") ?? subject,
			OAuthClientId = oauthClient,
			McpClientName = mcpClient?.Name,
			McpClientVersion = mcpClient?.Version,
		};
	}
}
