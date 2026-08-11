using Haproxy.Editor.Abstractions.Configurations;
using Haproxy.Editor.Abstractions.Injections;
using Haproxy.Editor.Core.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ZiggyCreatures.Caching.Fusion;

namespace Haproxy.Editor.Core;

public class CoreModule : IModule
{
	public void Load(IServiceCollection services, IConfiguration configuration)
	{
		services.Configure<AppConfig>(configuration.GetRequiredSection(AppConfig.Section));
		services.AddFusionCache();

		services.Scan(selector => selector
			.FromAssemblyOf<CoreModule>()
			.AddClasses(filter => filter.InNamespaceOf<HaproxyService>())
			.AsImplementedInterfaces()
			.WithSingletonLifetime()
		);
	}
}
