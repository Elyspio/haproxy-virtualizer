import type { createBrowserRouter } from "react-router-dom";

declare global {
	/** Runtime configuration and application services exposed by the host page. */
	interface Window {
		/** HAProxy Editor runtime state. */
		"haproxy-editor": {
			/** Environment-specific frontend configuration. */
			config: {
				/** OpenID Connect settings. */
				oauth: {
					/** OpenID Connect authority URL. */
					authority: string;
					/** Browser client identifier. */
					clientId: string;
					/** Sign-in callback URL. */
					callbackUrl: string;
				};
				/** Backend endpoint settings. */
				endpoints: {
					/** HAProxy Editor API base URL. */
					apiUrl: string;
				};
			};
			/** Application router used by non-component navigation helpers. */
			router: ReturnType<typeof createBrowserRouter>;
		};
	}
}
