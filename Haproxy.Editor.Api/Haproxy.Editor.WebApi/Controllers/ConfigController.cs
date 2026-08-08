using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Haproxy.Editor.Controllers;

[ApiController]
[Authorize]
[Route("config")]
public sealed class ConfigController(IHaproxyService config, ILogger<ConfigController> logger) : TracingController(logger)
{
	[HttpGet(Name = "GetConfig")]
	public async Task<HaproxyResourceSnapshot> Get()
	{
		using var trace = LogController();
		return await config.GetConfig();
	}

	[HttpPut(Name = "SaveConfig")]
	public async Task<HaproxyResourceSnapshot> Save([FromBody] HaproxyResourceSnapshot snapshot)
	{
		using var trace = LogController();
		return await config.SaveConfig(snapshot);
	}

	[HttpPost("validate", Name = "ValidateConfig")]
	public async Task<IActionResult> Validate([FromBody] HaproxyResourceSnapshot snapshot)
	{
		using var trace = LogController();
		var result = await config.ValidateConfig(snapshot);
		return result.IsValid
			? NoContent()
			: Problem(statusCode: StatusCodes.Status400BadRequest, title: "The configuration is invalid.", detail: result.ErrorMessage);
	}
}
