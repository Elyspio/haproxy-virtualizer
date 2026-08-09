import type { createBrowserRouter } from "react-router-dom";

declare global {
	interface Window {
		"haproxy-editor": {
			config: {
				oauth: {
					authority: string;
					clientId: string;
					callbackUrl: string;
				};
				endpoints: {
					apiUrl: string;
				};
			};
			router: ReturnType<typeof createBrowserRouter>;
		};
	}
}
