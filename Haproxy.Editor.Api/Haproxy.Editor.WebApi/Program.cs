using Elyspio.Utils.Telemetry.Technical.Extensions;
using Elyspio.Utils.Telemetry.Tracing.Builder;
using Haproxy.Editor.Abstractions.Configurations;
using Haproxy.Editor.Abstractions.Extensions;
using Haproxy.Editor.Adapters.Haproxy;
using Haproxy.Editor.Adapters.MongoDB;
using Haproxy.Editor.Core;
using Haproxy.Editor.Core.Services;
using Haproxy.Editor.Controllers;
using Haproxy.Editor.Filters;
using Haproxy.Editor.Mcp;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

IdentityModelEventSource.ShowPII = true;

builder.Configuration.AddJsonFile("appsettings.dockerhost.json", optional: true, reloadOnChange: true);
builder.Host.UseSerilogWithTelemetry();

if (builder.Configuration.IsTelemetryEnabled(out var telemetryOptions))
{
	var telemetry = new AppOpenTelemetryBuilder<Program>(telemetryOptions!, builder.Configuration);
	telemetry.AddAssembly<ConfigController>();
	telemetry.AddAssembly<HaproxyService>();
	telemetry.AddAssembly<MongoExposureRepository>();
	telemetry.Build(builder.Services);
	builder.Services.AddOpenTelemetryJsonConfiguration(builder.Configuration);
}

builder.AddModule<CoreModule>();
builder.AddModule<HaproxyAdapterModule>();
builder.AddModule<MongoAdapterModule>();

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpContextAccessor();
builder.Services.AddMcpServer()
	.WithHttpTransport(options => options.Stateless = true)
	.WithTools<QuickmapMcpTools>();
builder.Services.AddControllers(options => options.Filters.Add<HttpExceptionFilter>());
builder.Services.AddSwaggerGen(options =>
{
	options.NonNullableReferenceTypesAsRequired();
	options.SupportNonNullableReferenceTypes();

	options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
	{
		Name = "Authorization",
		Type = SecuritySchemeType.Http,
		Scheme = "Bearer",
		BearerFormat = "JWT",
		In = ParameterLocation.Header,
		Description = "Enter your token."
	});

	options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
	{
		{
			new OpenApiSecuritySchemeReference("Bearer", hostDocument: document, externalResource: null),
			[]
		}
	});
});

var oidcConfig = builder.Configuration.GetRequiredSection("Oidc").Get<OidcConfig>()!;
var mcpOAuthConfig = builder.Configuration.GetRequiredSection(McpOAuthConfig.Section).Get<McpOAuthConfig>()!;

builder.Services.AddAuthentication("Bearer")
	.AddJwtBearer("Bearer", options =>
	{
		options.Authority = oidcConfig.Issuer;
		options.Audience = oidcConfig.Audience;
		options.TokenValidationParameters = new TokenValidationParameters
		{
			ValidateAudience = true,
			ValidAudience = oidcConfig.Audience,
			ValidateIssuer = true,
			ValidIssuer = oidcConfig.Issuer,
			ValidateLifetime = true,
			ClockSkew = TimeSpan.FromMinutes(0.5),
			ValidateIssuerSigningKey = true
		};
	});

builder.Services.AddAuthentication()
	.AddJwtBearer("McpBearer", options =>
	{
		options.Authority = mcpOAuthConfig.NormalizedIssuer;
		options.MapInboundClaims = false;
		options.TokenValidationParameters = new TokenValidationParameters
		{
			ValidateAudience = true, ValidAudience = mcpOAuthConfig.Resource,
			ValidateIssuer = true, ValidIssuer = mcpOAuthConfig.NormalizedIssuer, ValidateLifetime = true,
			ClockSkew = TimeSpan.FromMinutes(0.5), ValidateIssuerSigningKey = true,
		};
		options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
		{
			OnChallenge = context =>
			{
				context.HandleResponse();
				context.Response.StatusCode = StatusCodes.Status401Unauthorized;
				context.Response.Headers.WWWAuthenticate = McpOAuthEndpoints.BuildChallenge(
					mcpOAuthConfig,
					context.AuthenticateFailure is null ? null : "invalid_token");
				return Task.CompletedTask;
			},
			OnForbidden = context =>
			{
				context.Response.StatusCode = StatusCodes.Status403Forbidden;
				context.Response.Headers.WWWAuthenticate = McpOAuthEndpoints.BuildChallenge(mcpOAuthConfig, "insufficient_scope");
				return Task.CompletedTask;
			},
		};
	});

builder.Services.AddAuthorization(options => options.AddPolicy("ExposureManager", policy =>
{
	policy.AuthenticationSchemes.Add("McpBearer");
	policy.RequireAuthenticatedUser();
	policy.RequireAssertion(context =>
	{
		var authorizedParty = context.User.FindFirst("azp")?.Value
			?? context.User.FindFirst("client_id")?.Value;
		if (!string.Equals(authorizedParty, mcpOAuthConfig.ClientId, StringComparison.Ordinal)) return false;

		var resourceAccess = context.User.FindFirst("resource_access")?.Value;
		if (string.IsNullOrWhiteSpace(resourceAccess)) return false;
		try
		{
			using var document = System.Text.Json.JsonDocument.Parse(resourceAccess);
			var hasRole = document.RootElement.TryGetProperty(mcpOAuthConfig.ClientId, out var client)
			       && client.TryGetProperty("roles", out var roles)
			       && roles.EnumerateArray().Any(role => role.GetString() == mcpOAuthConfig.Role);
			var hasScope = context.User.FindAll("scope")
				.SelectMany(claim => claim.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
				.Contains(mcpOAuthConfig.Scope, StringComparer.Ordinal);
			return hasRole && hasScope;
		}
		catch (System.Text.Json.JsonException)
		{
			return false;
		}
	});
}));
builder.Services.AddCors(options =>
{
	options.AddDefaultPolicy(policy =>
	{
		policy.WithOrigins("https://localhost:4000")
			.AllowAnyHeader()
			.AllowAnyMethod();
	});
});

var app = builder.Build();

app.UseOpenTelemetryJsonConfiguration();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
	app.UseSwagger();
	app.UseSwaggerUI();
	app.UseCors();
}

app.UseAuthentication();
app.UseAuthorization();


app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok("healthy"));

app.MapMcpOAuthMetadata(mcpOAuthConfig);
app.MapControllers();
app.MapMcp("/mcp").RequireAuthorization("ExposureManager");


app.Run();

public partial class Program;
