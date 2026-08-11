import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import { ConfigurationBoundary, ConfigurationDraftProvider, useConfigurationDraft } from "@/view/context/configuration-draft.context";

const loadedSnapshot: HaproxyResourceSnapshot = {
	version: 7,
	global: { daemon: false },
	defaults: [{ name: "defaults", mode: "http" }],
	frontends: [],
	backends: [],
	summary: { frontendCount: 0, backendCount: 0, serverCount: 0 },
};

const { queryState } = vi.hoisted(() => ({
	queryState: {
		data: undefined as HaproxyResourceSnapshot | undefined,
		isPending: true,
		isLoading: true,
		isError: false,
		error: null as Error | null,
		refetch: vi.fn(),
	},
}));

vi.mock("@/view/context/auth.context", () => ({
	useAuth: () => ({ user: { expired: false } }),
}));

vi.mock("@/core/api/queries", () => ({
	useConfigQuery: () => queryState,
}));

function DraftHarness() {
	const draft = useConfigurationDraft();
	const defaultsReference = useRef(draft.snapshot.defaults);

	return (
		<>
			<div data-testid="status">{draft.hydrationStatus}</div>
			<div data-testid="daemon">{String(draft.snapshot.global.daemon)}</div>
			<div data-testid="dirty">{String(draft.hasUnsavedChanges)}</div>
			<div data-testid="locked">{String(draft.isDraftLocked)}</div>
			<div data-testid="defaults-stable">{String(defaultsReference.current === draft.snapshot.defaults)}</div>
			<button type="button" onClick={() => draft.updateSnapshot((snapshot) => void (snapshot.global.daemon = true))}>
				Enable daemon
			</button>
			<button type="button" onClick={() => draft.updateSnapshot((snapshot) => void (snapshot.global.daemon = false))}>
				Disable daemon
			</button>
			<button type="button" onClick={draft.discardSnapshotChanges}>
				Discard
			</button>
			<button type="button" onClick={draft.captureSnapshotForSave}>
				Lock
			</button>
			<button type="button" onClick={draft.abortSave}>
				Abort save
			</button>
			<button type="button" onClick={() => draft.completeSave({ ...draft.snapshot, version: 8, global: { daemon: false } })}>
				Complete save
			</button>
		</>
	);
}

function ProviderHarness({ boundary = false, providerKey }: Readonly<{ boundary?: boolean; providerKey?: string }>) {
	return (
		<ConfigurationDraftProvider key={providerKey}>
			{boundary ? (
				<ConfigurationBoundary>
					<div>Editable workspace</div>
				</ConfigurationBoundary>
			) : (
				<DraftHarness />
			)}
		</ConfigurationDraftProvider>
	);
}

beforeEach(() => {
	queryState.data = loadedSnapshot;
	queryState.isPending = false;
	queryState.isLoading = false;
	queryState.isError = false;
	queryState.error = null;
	queryState.refetch.mockReset();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("ConfigurationDraftProvider", () => {
	it("marks edits dirty immediately, reconciles exact reversions after 250ms, and preserves unchanged branches", async () => {
		vi.useFakeTimers();
		render(<ProviderHarness />);

		expect(screen.getByTestId("status").textContent).toBe("ready");
		fireEvent.click(screen.getByRole("button", { name: "Enable daemon" }));
		expect(screen.getByTestId("dirty").textContent).toBe("true");
		expect(screen.getByTestId("defaults-stable").textContent).toBe("true");

		fireEvent.click(screen.getByRole("button", { name: "Disable daemon" }));
		expect(screen.getByTestId("dirty").textContent).toBe("true");
		await act(async () => vi.advanceTimersByTime(249));
		expect(screen.getByTestId("dirty").textContent).toBe("true");
		await act(async () => vi.advanceTimersByTime(1));
		expect(screen.getByTestId("dirty").textContent).toBe("false");
	});

	it("rejects draft mutations while a save is locked and handles success or failure explicitly", () => {
		render(<ProviderHarness />);
		fireEvent.click(screen.getByRole("button", { name: "Enable daemon" }));
		fireEvent.click(screen.getByRole("button", { name: "Lock" }));

		expect(screen.getByTestId("locked").textContent).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: "Disable daemon" }));
		expect(screen.getByTestId("daemon").textContent).toBe("true");

		fireEvent.click(screen.getByRole("button", { name: "Abort save" }));
		expect(screen.getByTestId("locked").textContent).toBe("false");
		expect(screen.getByTestId("daemon").textContent).toBe("true");

		fireEvent.click(screen.getByRole("button", { name: "Lock" }));
		fireEvent.click(screen.getByRole("button", { name: "Complete save" }));
		expect(screen.getByTestId("locked").textContent).toBe("false");
		expect(screen.getByTestId("daemon").textContent).toBe("false");
		expect(screen.getByTestId("dirty").textContent).toBe("false");
	});

	it("keeps editable content behind loading and retryable error states", async () => {
		queryState.data = undefined;
		queryState.isPending = true;
		queryState.isLoading = true;
		const view = render(<ProviderHarness boundary />);
		expect(screen.queryByText("Editable workspace")).toBeNull();
		expect(screen.getByText("Loading configuration…")).toBeTruthy();

		queryState.isPending = false;
		queryState.isLoading = false;
		queryState.isError = true;
		queryState.error = new Error("secret upstream details");
		view.rerender(<ProviderHarness boundary providerKey="error" />);
		expect(screen.queryByText("Editable workspace")).toBeNull();
		expect(await screen.findByText("Unable to load the HAProxy configuration.")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(queryState.refetch).toHaveBeenCalledOnce();

		queryState.data = loadedSnapshot;
		queryState.isError = false;
		view.rerender(<ProviderHarness boundary providerKey="ready" />);
		expect(screen.getByText("Editable workspace")).toBeTruthy();
	});
});
