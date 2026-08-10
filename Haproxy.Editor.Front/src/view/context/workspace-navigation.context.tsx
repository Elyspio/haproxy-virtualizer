import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import type { DashboardSelection, FlowViewMode } from "@modules/dashboard/dashboard.types";

type WorkspaceNavigationContextValue = {
	selection: DashboardSelection;
	setSelection: React.Dispatch<React.SetStateAction<DashboardSelection>>;
	flowViewMode: FlowViewMode;
	setFlowViewMode: React.Dispatch<React.SetStateAction<FlowViewMode>>;
};

const WorkspaceNavigationContext = createContext<WorkspaceNavigationContextValue | undefined>(undefined);

export function WorkspaceNavigationProvider({ children }: Readonly<{ children: ReactNode }>) {
	const [selection, setSelection] = useState<DashboardSelection>({ section: "global" });
	const [flowViewMode, setFlowViewMode] = useState<FlowViewMode>("logical");
	const value = useMemo(() => ({ selection, setSelection, flowViewMode, setFlowViewMode }), [flowViewMode, selection]);

	return <WorkspaceNavigationContext.Provider value={value}>{children}</WorkspaceNavigationContext.Provider>;
}

export function useWorkspaceNavigation() {
	const context = useContext(WorkspaceNavigationContext);
	if (!context) throw new Error("useWorkspaceNavigation must be used within WorkspaceNavigationProvider");
	return context;
}
