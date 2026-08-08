import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import { createEmptySnapshot, recalculateSummary } from "@modules/config/config.utils";
import type { DashboardSelection, FlowViewMode, ThemeMode } from "@modules/dashboard/dashboard.types";
import { getInitialThemeMode, THEME_STORAGE_KEY } from "@modules/dashboard/dashboard.utils";
import { useConfigQuery } from "@/core/api/queries";
import { useAuth } from "@/view/context/auth.context";

type ApplicationContextValue = {
	snapshot: HaproxyResourceSnapshot;
	setSnapshot: React.Dispatch<React.SetStateAction<HaproxyResourceSnapshot>>;
	selection: DashboardSelection;
	setSelection: React.Dispatch<React.SetStateAction<DashboardSelection>>;
	flowViewMode: FlowViewMode;
	setFlowViewMode: React.Dispatch<React.SetStateAction<FlowViewMode>>;
	themeMode: ThemeMode;
	setThemeMode: (mode: ThemeMode) => void;
};

const ApplicationContext = createContext<ApplicationContextValue | undefined>(undefined);

export function ApplicationProvider({ children }: Readonly<{ children: React.ReactNode }>) {
	const { user } = useAuth();
	const config = useConfigQuery(Boolean(user && !user.expired));
	const [snapshot, setSnapshot] = useState<HaproxyResourceSnapshot>(createEmptySnapshot);
	const [selection, setSelection] = useState<DashboardSelection>({ section: "global" });
	const [flowViewMode, setFlowViewMode] = useState<FlowViewMode>("logical");
	const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);

	useEffect(() => {
		if (config.data) setSnapshot(recalculateSummary(config.data));
	}, [config.data]);

	const setThemeMode = useCallback((mode: ThemeMode) => {
		window.localStorage.setItem(THEME_STORAGE_KEY, mode);
		setThemeModeState(mode);
	}, []);

	const value = useMemo(
		() => ({ snapshot, setSnapshot, selection, setSelection, flowViewMode, setFlowViewMode, themeMode, setThemeMode }),
		[flowViewMode, selection, setThemeMode, snapshot, themeMode],
	);

	return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication() {
	const context = useContext(ApplicationContext);
	if (!context) throw new Error("useApplication must be used within ApplicationProvider");
	return context;
}
