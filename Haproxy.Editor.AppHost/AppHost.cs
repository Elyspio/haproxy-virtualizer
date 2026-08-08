using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Projects;
using System.Net.NetworkInformation;

var builder = DistributedApplication.CreateBuilder(args);

builder.Services.AddLogging(x => x.AddSimpleConsole(xx => xx.SingleLine = true) );

var reservedPorts = IPGlobalProperties.GetIPGlobalProperties()
	.GetActiveTcpListeners()
	.Select(endpoint => endpoint.Port)
	.ToHashSet();

static int SelectAvailablePort(int minimum, int maximum, ISet<int> reservedPorts)
{
	var count = maximum - minimum + 1;
	var start = Random.Shared.Next(count);

	for (var offset = 0; offset < count; offset++)
	{
		var candidate = minimum + ((start + offset) % count);
		if (reservedPorts.Add(candidate)) return candidate;
	}

	throw new InvalidOperationException($"No available TCP port found between {minimum} and {maximum}.");
}

// Keycloak redirect URIs require an exact port, unlike its own local endpoint.
var frontPort = 3000;
var keycloakPort = SelectAvailablePort(8000, 8999, reservedPorts);
var apiPort = SelectAvailablePort(7000, 7999, reservedPorts);
var dataPlanePort = SelectAvailablePort(7000, 7999, reservedPorts);

var haproxyConfigPath = Path.Combine(builder.AppHostDirectory, "haproxy");

var mongo = builder.AddMongoDB("mongo")
	.WithImageTag("8.0.4")
	.WithDataVolume("haproxy-editor-mongo-8-0-data");
var mongoDatabase = mongo.AddDatabase("haproxy-editor");

// Local identity provider. The realm import is intentionally ephemeral so updates to the
// development realm are picked up on every Aspire run. Admin console: admin/admin.
var keycloakAdminUsername = builder.AddParameter("keycloak-admin-username", "admin", secret: false, publishValueAsDefault: true);
var keycloakAdminPassword = builder.AddParameter("keycloak-admin-password", "admin", secret: false, publishValueAsDefault: true);
var keycloak = builder.AddKeycloak("keycloak", keycloakPort, keycloakAdminUsername, keycloakAdminPassword)
	.WithRealmImport("./Realms")
	.WithDataVolume("haproxy-editor-keycloak");

var oidcAuthority = ReferenceExpression.Create($"{keycloak.GetEndpoint("http")}/realms/haproxy-editor");
const string oidcClientId = "a-haproxy-editor";

var haproxy = builder.AddContainer("haproxy", "haproxytech/haproxy-alpine", "s6-latest")
	.WithHttpEndpoint(port: dataPlanePort, targetPort: 5555, isProxied: false)
	.WithBindMount(haproxyConfigPath, "/usr/local/etc/haproxy", isReadOnly: false);
var dataPlaneApiUrl = ReferenceExpression.Create($"{haproxy.GetEndpoint("http")}/v3/");

var api = builder.AddProject<Haproxy_Editor_WebApi>("api")
	.WithEndpoint("https", annotation => annotation.Port = apiPort)
	.WithReference(mongoDatabase, "MongoDB")
	.WaitFor(mongoDatabase)
	.WaitForStart(haproxy)
	.WaitFor(keycloak)
	.WithEnvironment("Oidc__Issuer", oidcAuthority)
	.WithEnvironment("Oidc__Audience", oidcClientId)
	.WithEnvironment("App__DataPlaneApi__BaseUrl", dataPlaneApiUrl);


var front = builder.AddViteApp("front", "../Haproxy.Editor.Front")
	.WithPnpm()
	.WithEndpoint("http", annotation =>
	{
		annotation.Port = frontPort;
		annotation.TargetPort = frontPort;
		annotation.UriScheme = "https";
		annotation.IsProxied = false;
	})
	.WithReference(api)
	.WithEnvironment("VITE_OIDC_AUTHORITY", oidcAuthority)
	.WithEnvironment("VITE_OIDC_CLIENT_ID", oidcClientId)
	.WaitForStart(api);

builder.Build().Run();
