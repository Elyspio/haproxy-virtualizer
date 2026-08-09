using System.Security.Claims;
using Elyspio.Utils.Telemetry.Technical.Helpers;
using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Haproxy.Editor.Controllers;

[ApiController]
[Authorize(Policy = "ExposureManager")]
[Route("exposures")]
public sealed class ExposuresController(IExposureService exposures, ILogger<ExposuresController> logger) : TracingController(logger)
{
	[HttpPost(Name = "CreateExposure")]
	public async Task<ActionResult<ExposureResource>> Create([FromBody] ExposureUpsertRequest request)
	{
		using var trace = LogController($"{Log.F(request.FrontendName)} {Log.F(request.BackendName)}");
		var resource = await exposures.Create(GetOwner(User), User.FindFirstValue("sub"), request);
		return CreatedAtAction(nameof(Get), new { id = resource.Id }, resource);
	}

	[HttpGet(Name = "ListExposures")]
	public async Task<IReadOnlyCollection<ExposureResource>> List()
	{
		using var trace = LogController();
		return await exposures.List();
	}

	[HttpGet("discovery", Name = "DiscoverExposures")]
	public async Task<ExposureDiscoveryResource> Discover()
	{
		using var trace = LogController();
		return await exposures.Discover();
	}

	[HttpGet("{id:guid}", Name = "GetExposure")]
	public async Task<ActionResult<ExposureResource>> Get(Guid id)
	{
		using var trace = LogController($"{Log.F(id)}");
		return await exposures.Get(id) is { } resource ? Ok(resource) : NotFound();
	}

	[HttpPut("{id:guid}", Name = "ReplaceExposure")]
	public async Task<ActionResult<ExposureResource>> Replace(Guid id, [FromBody] ExposureUpsertRequest request)
	{
		using var trace = LogController($"{Log.F(id)} {Log.F(request.FrontendName)} {Log.F(request.BackendName)}");
		return await exposures.Replace(GetOwner(User), User.FindFirstValue("sub"), id, request) is { } resource ? Ok(resource) : NotFound();
	}

	[HttpDelete("{id:guid}", Name = "DeleteExposure")]
	public async Task<IActionResult> Delete(Guid id)
	{
		using var trace = LogController($"{Log.F(id)}");
		return await exposures.Delete(GetOwner(User), id) ? NoContent() : NotFound();
	}

	private static string GetOwner(ClaimsPrincipal user) => user.FindFirstValue("azp")
		?? user.FindFirstValue("client_id")
		?? throw new UnauthorizedAccessException("The source client is missing.");
}
