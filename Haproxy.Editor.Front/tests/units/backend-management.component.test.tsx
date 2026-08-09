import { useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendManagementSection } from "@components/management/BackendManagementSection";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import type { DashboardSelection } from "@modules/dashboard/dashboard.types";
import { withSnapshot } from "@modules/config/config.utils";

const { applicationState, mediaState } = vi.hoisted(() => ({
	applicationState: {
		selection: { section: "backend", backendName: "be_main" } as DashboardSelection,
		hasUnsavedChanges: true,
		discardSnapshotChanges: vi.fn(),
	},
	mediaState: { isDesktop: true },
}));

vi.mock("@/view/context/application.context", () => ({
	useApplication: () => applicationState,
}));

vi.mock("@mui/material/useMediaQuery", () => ({ default: () => mediaState.isDesktop }));

vi.mock("@components/management/AdvancedOptionsEditor", () => ({
	useSchemaFields: () => [],
	AdvancedOptionsEditor: ({ testId }: { testId: string }) => <div data-testid={testId}>Advanced options</div>,
}));

vi.mock("@components/shared/ConfigToolbar", () => ({
	ConfigToolbar: ({ variant, commitDisabled }: { variant: string; commitDisabled?: boolean }) => (
		<button type="button" disabled={commitDisabled}>
			{variant}
		</button>
	),
}));

const initialSnapshot: HaproxyResourceSnapshot = {
	version: 1,
	global: { daemon: false },
	defaults: [{ name: "defaults", mode: "http" }],
	frontends: [],
	backends: [
		{
			name: "be_main",
			mode: "http",
			balance: "roundrobin",
			advCheck: "httpchk",
			defaultServer: null,
			servers: [{ name: "app_1", address: "10.0.0.10", port: 8080, check: "enabled", ssl: null, verify: null, extra: null }],
			extra: null,
		},
	],
	summary: { frontendCount: 0, backendCount: 1, serverCount: 1 },
};

afterEach(() => {
	cleanup();
	mediaState.isDesktop = true;
	applicationState.selection = { section: "backend", backendName: "be_main" };
});

function Harness({ initial = initialSnapshot }: Readonly<{ initial?: HaproxyResourceSnapshot }>) {
	const [snapshot, setSnapshot] = useState(() => structuredClone(initial));
	const [selection, setSelectionState] = useState<DashboardSelection>(applicationState.selection);
	applicationState.selection = selection;
	const selectedBackend = snapshot.backends.find((backend) => backend.name === selection.backendName) ?? snapshot.backends[0] ?? null;

	const setSelection = (nextSelection: DashboardSelection) => {
		applicationState.selection = nextSelection;
		setSelectionState(nextSelection);
	};

	return (
		<ThemeProvider theme={createTheme()}>
			<BackendManagementSection
				snapshot={snapshot}
				runtimeBackends={[]}
				frontendContext={null}
				backendCandidates={snapshot.backends}
				selectedBackend={selectedBackend}
				selectedRuntimeBackend={null}
				shouldFilterBackendPanel={false}
				updateSnapshot={(updater) => setSnapshot((current) => withSnapshot(current, updater))}
				setSelection={setSelection}
				focused
			/>
		</ThemeProvider>
	);
}

describe("BackendManagementSection", () => {
	it.each([
		["Ctrl", { ctrlKey: true }],
		["Command", { metaKey: true }],
	])("opens the searchable backend selector with %s+K", async (_label, modifier) => {
		render(<Harness />);

		fireEvent.keyDown(window, { key: "k", ...modifier });

		expect(await screen.findByTestId("backend-item-be_main")).toBeTruthy();
	});

	it("selects a backend, edits cells with tab navigation and opens the same drawer for server settings", async () => {
		const user = userEvent.setup();
		const secondBackend: HaproxyResourceSnapshot["backends"][number] = {
			...initialSnapshot.backends[0]!,
			name: "be_secondary",
			servers: [{ ...initialSnapshot.backends[0]!.servers[0]!, name: "app_2" }],
		};
		render(<Harness initial={{ ...initialSnapshot, backends: [...initialSnapshot.backends, secondBackend] }} />);

		await user.click(screen.getByRole("combobox", { name: "Select a backend" }));
		await user.click(screen.getByTestId("backend-item-be_secondary"));
		expect((screen.getByRole("combobox", { name: "Select a backend" }) as HTMLInputElement).value).toBe("be_secondary");

		const address = screen.getByLabelText("Server 1 address") as HTMLInputElement;
		await user.clear(address);
		await user.type(address, "10.0.0.42");
		expect(address.value).toBe("10.0.0.42");
		expect(screen.getByRole("combobox", { name: "Server 1 TLS" })).toBeTruthy();
		expect(screen.getByRole("combobox", { name: "Server 1 verify" })).toBeTruthy();

		const serverName = screen.getByLabelText("Server 1 name");
		serverName.focus();
		await user.tab();
		expect(document.activeElement).toBe(address);

		await user.click(screen.getByTestId("server-settings-0"));
		expect(await screen.findByText("Server settings")).toBeTruthy();
		expect(screen.getByTestId("advanced-server-0")).toBeTruthy();
	});

	it("discards the global draft and disables commit actions for invalid local fields", async () => {
		const user = userEvent.setup();
		applicationState.discardSnapshotChanges.mockClear();
		const invalid = structuredClone(initialSnapshot);
		invalid.backends[0]!.servers[0]!.port = 0;
		render(<Harness initial={invalid} />);

		expect(screen.getByRole("button", { name: "commit" })).toHaveProperty("disabled", true);
		await user.click(screen.getByRole("button", { name: "Cancel changes" }));
		expect(applicationState.discardSnapshotChanges).toHaveBeenCalledOnce();
	});

	it("renders unknown runtime and empty backend states", () => {
		const { unmount } = render(<Harness />);
		expect(screen.getByText("Runtime unknown")).toBeTruthy();
		unmount();

		render(<Harness initial={{ ...initialSnapshot, backends: [], summary: { ...initialSnapshot.summary, backendCount: 0, serverCount: 0 } }} />);
		expect(screen.getByText("No backend selected")).toBeTruthy();
	});

	it("opens backend settings as a temporary drawer on mobile", async () => {
		mediaState.isDesktop = false;
		const user = userEvent.setup();
		render(<Harness />);

		expect(screen.queryByText("Backend settings")).toBeNull();
		await user.click(screen.getByRole("button", { name: "Modify" }));
		expect(await screen.findByText("Backend settings")).toBeTruthy();
		expect(screen.getByRole("presentation")).toBeTruthy();
	});
});
