import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import { ConfigurationDraftProvider, useConfigurationDraft } from "@/view/context/configuration-draft.context";
import { ThemeModeProvider, useThemeMode } from "@/view/context/theme-mode.context";

const snapshot: HaproxyResourceSnapshot = {
	version: 1,
	global: { daemon: false },
	defaults: [],
	frontends: [],
	backends: [],
	summary: { frontendCount: 0, backendCount: 0, serverCount: 0 },
};

Object.defineProperty(window, "localStorage", {
	configurable: true,
	value: { getItem: vi.fn(() => "dark"), setItem: vi.fn() },
});

vi.mock("@/view/context/auth.context", () => ({
	useAuth: () => ({ user: { expired: false } }),
}));

vi.mock("@/core/api/queries", () => ({
	useConfigQuery: () => ({ data: snapshot, isPending: false, isLoading: false, isError: false, refetch: vi.fn() }),
}));

const themeRender = vi.fn();

function ThemeOnlyConsumer() {
	const { themeMode } = useThemeMode();
	themeRender(themeMode);
	return <div data-testid="theme">{themeMode}</div>;
}

function DraftConsumer() {
	const { updateSnapshot } = useConfigurationDraft();
	return (
		<button type="button" onClick={() => updateSnapshot((draft) => void (draft.global.daemon = true))}>
			Edit configuration
		</button>
	);
}

afterEach(() => {
	cleanup();
	themeRender.mockClear();
});

describe("focused application contexts", () => {
	it("does not rerender theme-only consumers when configuration changes", () => {
		render(
			<ThemeModeProvider>
				<ConfigurationDraftProvider>
					<ThemeOnlyConsumer />
					<DraftConsumer />
				</ConfigurationDraftProvider>
			</ThemeModeProvider>,
		);

		expect(themeRender).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByRole("button", { name: "Edit configuration" }));
		expect(themeRender).toHaveBeenCalledTimes(1);
	});
});
