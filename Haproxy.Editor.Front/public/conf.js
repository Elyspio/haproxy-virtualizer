window["haproxy-editor"] ??= {};

const origin = window.location.origin;

window["haproxy-editor"].config = {
	endpoints: {
		apiUrl: `${origin}/api`,
	},
	oauth: {
		authority: "https://auth.elyspio.fr/realms/apps-dev/",
		clientId: "a-haproxy-editor",
		callbackUrl: `${origin}/oauth/callback`,
	},
};
