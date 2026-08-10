using Haproxy.Editor.Abstractions.Data;
using Haproxy.Editor.Abstractions.Interfaces.Services;
using Haproxy.Editor.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Shouldly;
using Xunit;

namespace Haproxy.Editor.WebApi.Tests;

public sealed class DashboardControllerTests
{
	[Theory]
	[InlineData(null, false)]
	[InlineData("max-age=0, no-cache", true)]
	public async Task Get_uses_the_requested_dashboard_cache_policy(string? cacheControl, bool shouldRefresh)
	{
		var service = new RecordingHaproxyService();
		var controller = new DashboardController(service, NullLogger<DashboardController>.Instance)
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext(),
			},
		};
		if (cacheControl is not null)
		{
			controller.Request.Headers.CacheControl = cacheControl;
		}

		await controller.Get(CancellationToken.None);

		service.RefreshCalls.ShouldBe(shouldRefresh ? 1 : 0);
		service.CachedCalls.ShouldBe(shouldRefresh ? 0 : 1);
	}

	private sealed class RecordingHaproxyService : IHaproxyService
	{
		public int CachedCalls { get; private set; }

		public int RefreshCalls { get; private set; }

		public Task<HaproxyResourceSnapshot> GetConfig(CancellationToken cancellationToken = default) => throw new NotSupportedException();

		public Task<HaproxyResourceSnapshot> SaveConfig(HaproxyResourceSnapshot config, CancellationToken cancellationToken = default) => throw new NotSupportedException();

		public Task<DashboardSnapshot> GetDashboardSnapshot(CancellationToken cancellationToken = default)
		{
			CachedCalls++;
			return Task.FromResult(new DashboardSnapshot());
		}

		public Task<DashboardSnapshot> RefreshDashboardSnapshot(CancellationToken cancellationToken = default)
		{
			RefreshCalls++;
			return Task.FromResult(new DashboardSnapshot());
		}

		public Task<IValidationResult> ValidateConfig(HaproxyResourceSnapshot config, CancellationToken cancellationToken = default) => throw new NotSupportedException();
	}
}
