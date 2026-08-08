import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "oidc-client-ts";
import { container } from "@/core/di/di";
import { AuthService } from "@services/auth.service";

type AuthContextType = {
	user: User | null;
	signIn: () => void;
	signOut: () => void;
	completeSigninCallback: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const authService = useMemo(() => container.get(AuthService), []);
	const [user, setUser] = useState<User | null>(null);

	useEffect(() => {
		void authService.getUser().then((session) => setUser(session?.expired ? null : session));
	}, [authService]);

	useEffect(() => {
		const onUserLoaded = (renewed: User) => {
			authService.user = renewed;
			setUser(renewed);
		};

		const onUserUnloaded = () => {
			setUser(null);
		};

		const onAccessTokenExpiring = () => {
			void authService.silentRenew().then((renewed) => {
				if (renewed) onUserLoaded(renewed);
			});
		};

		const onSilentRenewError = () => {
			console.warn("Silent token renewal failed");
		};

		authService.events.addUserLoaded(onUserLoaded);
		authService.events.addUserUnloaded(onUserUnloaded);
		authService.events.addAccessTokenExpiring(onAccessTokenExpiring);
		authService.events.addSilentRenewError(onSilentRenewError);

		return () => {
			authService.events.removeUserLoaded(onUserLoaded);
			authService.events.removeUserUnloaded(onUserUnloaded);
			authService.events.removeAccessTokenExpiring(onAccessTokenExpiring);
			authService.events.removeSilentRenewError(onSilentRenewError);
		};
	}, [authService]);

	const completeSigninCallback = useCallback(async () => {
		const signedInUser = await authService.handleSigninCallback();
		if (signedInUser && !signedInUser.expired) {
			authService.user = signedInUser;
			setUser(signedInUser);
		} else {
			setUser(null);
		}
	}, [authService]);

	const authContextValue: AuthContextType = useMemo(() => {
		const signIn = () => void authService.signIn();
		const signOut = () => void authService.signOut();

		return { user, signIn, signOut, completeSigninCallback };
	}, [authService, completeSigninCallback, user]);

	return <AuthContext.Provider value={authContextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error("useAuth must be used within AuthContext");
	return ctx;
};
