import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import { cloneSnapshot, createEmptySnapshot, snapshotsEqual } from "@modules/config/config.utils";
import type { DashboardSelection, FlowViewMode, ThemeMode } from "@modules/dashboard/dashboard.types";
import { getInitialThemeMode, THEME_STORAGE_KEY } from "@modules/dashboard/dashboard.utils";
import { useConfigQuery } from "@/core/api/queries";
import { useAuth } from "@/view/context/auth.context";

type ApplicationContextValue = {
	snapshot: HaproxyResourceSnapshot;
	setSnapshot: React.Dispatch<React.SetStateAction<HaproxyResourceSnapshot>>;
	hasUnsavedChanges: boolean;
	acceptSnapshot: (snapshot: HaproxyResourceSnapshot) => void;
	discardSnapshotChanges: () => void;
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
	const [savedBaseline, setSavedBaseline] = useState<HaproxyResourceSnapshot>(createEmptySnapshot);
	const [selection, setSelection] = useState<DashboardSelection>({ section: "global" });
	const [flowViewMode, setFlowViewMode] = useState<FlowViewMode>("logical");
	const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);

	const hasUnsavedChanges = useMemo(() => !snapshotsEqual(snapshot, savedBaseline), [savedBaseline, snapshot]);
	const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
	hasUnsavedChangesRef.current = hasUnsavedChanges;

	const acceptSnapshot = useCallback((nextSnapshot: HaproxyResourceSnapshot) => {
		const accepted = cloneSnapshot(nextSnapshot);
		setSavedBaseline(accepted);
		setSnapshot(cloneSnapshot(accepted));
	}, []);

	const discardSnapshotChanges = useCallback(() => {
		setSnapshot(cloneSnapshot(savedBaseline));
	}, [savedBaseline]);

	useEffect(() => {
		if (config.data && !hasUnsavedChangesRef.current) {
			acceptSnapshot(config.data);
		}
	}, [acceptSnapshot, config.data]);

	useEffect(() => {
		if (!hasUnsavedChanges) {
			return;
		}

		const warnBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", warnBeforeUnload);
		return () => window.removeEventListener("beforeunload", warnBeforeUnload);
	}, [hasUnsavedChanges]);

	const setThemeMode = useCallback((mode: ThemeMode) => {
		window.localStorage.setItem(THEME_STORAGE_KEY, mode);
		setThemeModeState(mode);
	}, []);

	const value = useMemo(
		() => ({
			snapshot,
			setSnapshot,
			hasUnsavedChanges,
			acceptSnapshot,
			discardSnapshotChanges,
			selection,
			setSelection,
			flowViewMode,
			setFlowViewMode,
			themeMode,
			setThemeMode,
		}),
		[acceptSnapshot, discardSnapshotChanges, flowViewMode, hasUnsavedChanges, selection, setThemeMode, snapshot, themeMode],
	);

	return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplication() {
	const context = useContext(ApplicationContext);
	if (!context) throw new Error("useApplication must be used within ApplicationProvider");
	return context;
}
