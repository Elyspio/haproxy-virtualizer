using System.Net.Http.Headers;
using System.Text;
using Haproxy.Editor.Abstractions.Configurations;
using Haproxy.Editor.Abstractions.Injections;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Haproxy.Editor.Adapters.Haproxy;

public class HaproxyAdapterModule : IModule
{
	/// <inheritdoc />
	public void Load(IServiceCollection services, IConfiguration configuration)
	{
		services.AddHttpClient("HaproxyDataPlane", (serviceProvider, client) =>
			{
				var options = serviceProvider.GetRequiredService<IOptionsMonitor<AppConfig>>().CurrentValue.DataPlaneApi;

				client.BaseAddress = new Uri(options.BaseUrl.TrimEnd('/') + "/");
				client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);

				if (!string.IsNullOrWhiteSpace(options.Token))
				{
					client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.Token);
				}
				else if (!string.IsNullOrWhiteSpace(options.Username))
				{
					var raw = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{options.Username}:{options.Password ?? string.Empty}"));
					client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", raw);
				}
			})
			.ConfigurePrimaryHttpMessageHandler(serviceProvider =>
			{
				var appConfig = serviceProvider.GetRequiredService<IOptionsMonitor<AppConfig>>().CurrentValue;

				return new HttpClientHandler
				{
					ServerCertificateCustomValidationCallback = appConfig.DataPlaneApi.IgnoreTlsErrors
						? (_, _, _, _) => true
						: null
				};
			});

		services.AddTransient<HaproxyClient>(serviceProvider =>
		{
			var httpClientFactory = serviceProvider.GetRequiredService<IHttpClientFactory>();
			return new HaproxyClient(httpClientFactory.CreateClient("HaproxyDataPlane"))
			{
				ReadResponseAsString = true,
			};
		});
	}
}