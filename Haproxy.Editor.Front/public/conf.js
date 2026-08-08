window["haproxy-editor"] ??= {};

const origin = window.location.origin;

window["haproxy-editor"].config = {
	endpoints: {
		apiUrl: `${origin}/api`,
	},
	oauth: {
		authority: "https://localhost:8080/realms/haproxy-editor",
		clientId: "a-haproxy-editor",
		callbackUrl: `${origin}/oauth/callback`,
	},
};
