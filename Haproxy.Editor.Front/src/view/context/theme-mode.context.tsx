import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { ThemeMode } from "@modules/dashboard/dashboard.types";
import { getInitialThemeMode, THEME_STORAGE_KEY } from "@modules/dashboard/dashboard.utils";

type ThemeModeContextValue = {
	themeMode: ThemeMode;
	setThemeMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export function ThemeModeProvider({ children }: Readonly<{ children: ReactNode }>) {
	const [themeMode, setThemeModeState] = useState<ThemeMode>(getInitialThemeMode);
	const setThemeMode = useCallback((mode: ThemeMode) => {
		window.localStorage.setItem(THEME_STORAGE_KEY, mode);
		setThemeModeState(mode);
	}, []);
	const value = useMemo(() => ({ themeMode, setThemeMode }), [setThemeMode, themeMode]);

	return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
	const context = useContext(ThemeModeContext);
	if (!context) throw new Error("useThemeMode must be used within ThemeModeProvider");
	return context;
}
