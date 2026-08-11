import type { ReactNode } from "react";
import { ConfigurationDraftProvider } from "@/view/context/configuration-draft.context";
import { ThemeModeProvider } from "@/view/context/theme-mode.context";
import { WorkspaceNavigationProvider } from "@/view/context/workspace-navigation.context";

/** Composes the independent application contexts without coupling their values or consumers. */
export function ApplicationProvider({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<ThemeModeProvider>
			<ConfigurationDraftProvider>
				<WorkspaceNavigationProvider>{children}</WorkspaceNavigationProvider>
			</ConfigurationDraftProvider>
		</ThemeModeProvider>
	);
}
