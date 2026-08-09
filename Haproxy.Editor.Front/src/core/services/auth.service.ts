import { injectable } from "inversify";
import type { User } from "oidc-client-ts";
import axios, { type AxiosInstance } from "axios";
import { userManager } from "@apis/oidc.client";

@injectable()
export class AuthService {
	#token?: string;

	private instance!: AxiosInstance;

	public get axios(): AxiosInstance {
		if (this.instance) return this.instance;

		this.instance = axios.create();

		this.instance.interceptors.request.use(async (config) => {
			const freshUser = await userManager.getUser();
			if (freshUser && !freshUser.expired) {
				this.#token = freshUser.access_token;
			}

			config.headers["Authorization"] = `Bearer ${this.#token}`;
			return config;
		});

		this.instance.interceptors.response.use(
			(response) => response,
			async (error) => {
				if (error?.response?.status === 401) {
					try {
						const renewed = await userManager.signinSilent();
						if (renewed) {
							this.#token = renewed.access_token;
							error.config.headers["Authorization"] = `Bearer ${this.#token}`;
							return axios.request(error.config);
						}
					} catch {
						// Silent renew failed — will be handled by session monitoring
					}
				}
				return Promise.reject(error);
			},
		);

		return this.instance;
	}

	set user(user: User) {
		this.#token = user.access_token;
	}

	get events() {
		return userManager.events;
	}

	async getUser() {
		return await userManager.getUser();
	}

	async handleSigninCallback() {
		return await userManager.signinCallback();
	}

	async silentRenew() {
		return await userManager.signinSilent();
	}

	signIn() {
		return userManager.signinRedirect();
	}

	signOut() {
		return userManager.signoutRedirect();
	}
}
