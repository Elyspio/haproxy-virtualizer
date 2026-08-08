import { Log, UserManager, type UserManagerSettings, WebStorageStateStore } from "oidc-client-ts";

const runtimeOauth = window["haproxy-editor"]?.config?.oauth ?? {
	authority: "https://oidc.invalid",
	clientId: "haproxy-editor-test",
	callbackUrl: "http://localhost/oauth/callback",
};
const oauth = {
	authority: import.meta.env.VITE_OIDC_AUTHORITY ?? runtimeOauth.authority,
	clientId: import.meta.env.VITE_OIDC_CLIENT_ID ?? runtimeOauth.clientId,
	callbackUrl: runtimeOauth.callbackUrl,
};
const oidcConfig: UserManagerSettings = {
	authority: oauth.authority,
	client_id: oauth.clientId,
	redirect_uri: oauth.callbackUrl,
	post_logout_redirect_uri: window.location.origin,
	silent_redirect_uri: oauth.callbackUrl,
	response_type: "code",
	scope: "openid",
	automaticSilentRenew: true,
	accessTokenExpiringNotificationTimeInSeconds: 120,
	userStore: new WebStorageStateStore({ store: window.localStorage }),
};

Log.setLogger(console);
Log.setLevel(Log.INFO);

export const userManager = new UserManager(oidcConfig);
