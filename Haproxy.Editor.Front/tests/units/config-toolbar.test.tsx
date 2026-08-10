import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import { ConfigurationDraftProvider, useConfigurationDraft } from "@/view/context/configuration-draft.context";
import { ConfigurationSaveOverlay } from "@pages/DashboardLayout";
import { ConfigToolbar } from "@components/shared/ConfigToolbar";

const initialSnapshot: HaproxyResourceSnapshot = {
	version: 1,
	global: { daemon: false },
	defaults: [],
	frontends: [],
	backends: [],
	summary: { frontendCount: 0, backendCount: 0, serverCount: 0 },
};

const { save, validate, dashboard, toastError } = vi.hoisted(() => ({
	save: { mutateAsync: vi.fn(), isPending: false },
	validate: { mutateAsync: vi.fn(), isPending: false },
	dashboard: { refetch: vi.fn(), isFetching: false },
	toastError: vi.fn(),
}));

vi.mock("@/view/context/auth.context", () => ({
	useAuth: () => ({ user: { expired: false } }),
}));

vi.mock("@/core/api/queries", () => ({
	useConfigQuery: () => ({ data: initialSnapshot, isPending: false, isLoading: false, isError: false, refetch: vi.fn() }),
	useDashboardQuery: () => dashboard,
}));

vi.mock("@/core/api/mutations", () => ({
	useSaveConfig: () => save,
	useValidateConfig: () => validate,
}));

vi.mock("react-toastify", () => ({
	toast: { error: toastError },
}));

function Harness() {
	const draft = useConfigurationDraft();
	return (
		<>
			<div data-testid="daemon">{String(draft.snapshot.global.daemon)}</div>
			<div data-testid="dirty">{String(draft.hasUnsavedChanges)}</div>
			<div data-testid="locked">{String(draft.isDraftLocked)}</div>
			<button type="button" onClick={() => draft.updateSnapshot((snapshot) => void (snapshot.global.daemon = true))}>
				Edit
			</button>
			<button type="button" onClick={() => draft.updateSnapshot((snapshot) => void (snapshot.global.daemon = false))}>
				Attempt edit
			</button>
			<ConfigToolbar />
			<ConfigurationSaveOverlay />
		</>
	);
}

function renderToolbar() {
	return render(
		<ThemeProvider theme={createTheme()}>
			<ConfigurationDraftProvider>
				<Harness />
			</ConfigurationDraftProvider>
		</ThemeProvider>,
	);
}

beforeEach(() => {
	save.mutateAsync.mockReset();
	validate.mutateAsync.mockReset();
	dashboard.refetch.mockReset();
	toastError.mockReset();
});

afterEach(cleanup);

describe("ConfigToolbar", () => {
	it("captures and locks the submitted draft until the canonical save response is accepted", async () => {
		let resolveSave!: (snapshot: HaproxyResourceSnapshot) => void;
		save.mutateAsync.mockImplementation(
			() =>
				new Promise<HaproxyResourceSnapshot>((resolve) => {
					resolveSave = resolve;
				}),
		);
		renderToolbar();
		fireEvent.click(screen.getByRole("button", { name: "Edit" }));
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		expect(save.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ global: { daemon: true } }));
		expect(screen.getByTestId("locked").textContent).toBe("true");
		expect(screen.getByTestId("configuration-save-overlay")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Attempt edit" }));
		expect(screen.getByTestId("daemon").textContent).toBe("true");

		resolveSave({ ...initialSnapshot, version: 2, global: { daemon: false } });
		await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("false"));
		expect(screen.getByTestId("daemon").textContent).toBe("false");
		expect(screen.getByTestId("dirty").textContent).toBe("false");
	});

	it("unlocks and preserves the draft when save fails", async () => {
		save.mutateAsync.mockRejectedValue(new Error("validation failed"));
		renderToolbar();
		fireEvent.click(screen.getByRole("button", { name: "Edit" }));
		fireEvent.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(screen.getByTestId("locked").textContent).toBe("false"));
		expect(screen.getByTestId("daemon").textContent).toBe("true");
		expect(screen.getByTestId("dirty").textContent).toBe("true");
		expect(toastError).toHaveBeenCalledOnce();
	});

	it("reports dashboard refresh failures without a success state", async () => {
		dashboard.refetch.mockResolvedValue({ isError: true, error: new Error("offline") });
		renderToolbar();
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

		expect(await screen.findByText("Dashboard refresh failed. Try again.")).toBeTruthy();
	});

	it("shows the success state only after a successful dashboard refresh", async () => {
		dashboard.refetch.mockResolvedValue({ isError: false });
		renderToolbar();
		const refresh = screen.getByRole("button", { name: "Refresh" });
		const initialClassName = refresh.className;
		fireEvent.click(refresh);

		await waitFor(() => expect(dashboard.refetch).toHaveBeenCalledOnce());
		await waitFor(() => expect(refresh.className).not.toBe(initialClassName));
		expect(screen.queryByText("Dashboard refresh failed. Try again.")).toBeNull();
	});
});
