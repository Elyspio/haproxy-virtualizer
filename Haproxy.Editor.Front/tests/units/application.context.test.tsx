import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApplicationProvider } from "@/view/context/application.context";
import { useConfigurationDraft } from "@/view/context/configuration-draft.context";

Object.defineProperty(window, "localStorage", {
	configurable: true,
	value: { getItem: vi.fn(() => null), setItem: vi.fn() },
});

const { loadedSnapshot } = vi.hoisted(() => ({
	loadedSnapshot: {
		version: 7,
		global: { daemon: false },
		defaults: [],
		frontends: [],
		backends: [],
		summary: { frontendCount: 0, backendCount: 0, serverCount: 0 },
	},
}));

vi.mock("@/view/context/auth.context", () => ({
	useAuth: () => ({ user: { expired: false } }),
}));

vi.mock("@/core/api/queries", () => ({
	useConfigQuery: () => ({
		data: loadedSnapshot,
		isPending: false,
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	}),
}));

function ContextHarness() {
	const { snapshot, updateSnapshot, completeSave, discardSnapshotChanges, hasUnsavedChanges } = useConfigurationDraft();

	return (
		<>
			<div data-testid="daemon">{String(snapshot.global.daemon)}</div>
			<div data-testid="dirty">{String(hasUnsavedChanges)}</div>
			<button type="button" onClick={() => updateSnapshot((draft) => void (draft.global.daemon = true))}>
				Edit
			</button>
			<button type="button" onClick={discardSnapshotChanges}>
				Discard
			</button>
			<button type="button" onClick={() => completeSave(snapshot)}>
				Accept
			</button>
		</>
	);
}

describe("ApplicationProvider configuration draft", () => {
	it("restores the saved baseline and accepts a successful save as the new baseline", async () => {
		const user = userEvent.setup();
		render(
			<ApplicationProvider>
				<ContextHarness />
			</ApplicationProvider>,
		);

		expect((await screen.findByTestId("dirty")).textContent).toBe("false");
		await user.click(screen.getByRole("button", { name: "Edit" }));
		expect(screen.getByTestId("daemon").textContent).toBe("true");
		expect(screen.getByTestId("dirty").textContent).toBe("true");

		await user.click(screen.getByRole("button", { name: "Discard" }));
		expect(screen.getByTestId("daemon").textContent).toBe("false");
		expect(screen.getByTestId("dirty").textContent).toBe("false");

		await user.click(screen.getByRole("button", { name: "Edit" }));
		await user.click(screen.getByRole("button", { name: "Accept" }));
		expect(screen.getByTestId("daemon").textContent).toBe("true");
		expect(screen.getByTestId("dirty").textContent).toBe("false");
	});
});
