using Elyspio.Utils.Telemetry.Technical.Helpers;
using Elyspio.Utils.Telemetry.Tracing.Elements;
using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Haproxy.Editor.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Haproxy.Editor.Controllers;

[ApiController]
[Authorize(Policy = AuthorizationPolicies.ExposureManager)]
[Route("exposures")]
public sealed class ExposuresController(IExposureService exposures, ILogger<ExposuresController> logger) : TracingController(logger)
{
	[HttpPost(Name = "CreateExposure")]
	public async Task<ActionResult<ExposureResource>> Create([FromBody] ExposureUpsertRequest request, CancellationToken cancellationToken)
	{
		using var trace = LogController($"{Log.F(request.FrontendName)} {Log.F(request.BackendName)}");
		var resource = await exposures.Create(ExposureActorFactory.Create(User), request, cancellationToken);
		return CreatedAtAction(nameof(Get), new { id = resource.Id }, resource);
	}

	[HttpGet(Name = "ListExposures")]
	public async Task<IReadOnlyCollection<ExposureResource>> List(CancellationToken cancellationToken)
	{
		using var trace = LogController();
		return await exposures.List(cancellationToken);
	}

	[HttpGet("discovery", Name = "DiscoverExposures")]
	public async Task<ExposureDiscoveryResource> Discover(CancellationToken cancellationToken)
	{
		using var trace = LogController();
		return await exposures.Discover(cancellationToken);
	}

	[HttpGet("history", Name = "GetExposureHistory")]
	public async Task<ExposureHistoryPage> History(
		[FromQuery] Guid? exposureId = null,
		[FromQuery] string? cursor = null,
		[FromQuery] int limit = 50,
		CancellationToken cancellationToken = default)
	{
		using var trace = LogController($"{Log.F(exposureId)} {Log.F(limit)}");
		return await exposures.History(exposureId, cursor, limit, cancellationToken);
	}

	[HttpGet("{id:guid}", Name = "GetExposure")]
	public async Task<ActionResult<ExposureResource>> Get(Guid id, CancellationToken cancellationToken)
	{
		using var trace = LogController($"{Log.F(id)}");
		return await exposures.Get(id, cancellationToken) is { } resource ? Ok(resource) : NotFound();
	}

	[HttpPut("{id:guid}", Name = "ReplaceExposure")]
	public async Task<ActionResult<ExposureResource>> Replace(Guid id, [FromBody] ExposureUpsertRequest request, CancellationToken cancellationToken)
	{
		using var trace = LogController($"{Log.F(id)} {Log.F(request.FrontendName)} {Log.F(request.BackendName)}");
		return await exposures.Replace(ExposureActorFactory.Create(User), id, request, cancellationToken) is { } resource ? Ok(resource) : NotFound();
	}

	[HttpDelete("{id:guid}", Name = "DeleteExposure")]
	public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
	{
		using var trace = LogController($"{Log.F(id)}");
		return await exposures.Delete(ExposureActorFactory.Create(User), id, cancellationToken) ? NoContent() : NotFound();
	}
}
