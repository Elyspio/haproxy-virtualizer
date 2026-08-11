import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { AuthCallback } from "@pages/AuthCallback";

const { completeSigninCallback, signIn } = vi.hoisted(() => ({
	completeSigninCallback: vi.fn(),
	signIn: vi.fn(),
}));

vi.mock("@/view/context/auth.context", () => ({
	useAuth: () => ({ completeSigninCallback, signIn }),
}));

afterEach(() => {
	cleanup();
	completeSigninCallback.mockReset();
	signIn.mockReset();
});

describe("AuthCallback", () => {
	it("completes and navigates once when React Strict Mode replays effects", async () => {
		completeSigninCallback.mockResolvedValue(undefined);
		render(
			<StrictMode>
				<MemoryRouter initialEntries={["/oauth/callback"]}>
					<Routes>
						<Route path="/oauth/callback" element={<AuthCallback />} />
						<Route path="/" element={<div>Dashboard</div>} />
					</Routes>
				</MemoryRouter>
			</StrictMode>,
		);

		expect(await screen.findByText("Dashboard")).toBeTruthy();
		expect(completeSigninCallback).toHaveBeenCalledOnce();
	});

	it("shows a safe recovery action when the OIDC callback fails", async () => {
		completeSigninCallback.mockRejectedValue(new Error("secret identity-provider response"));
		const user = userEvent.setup();
		render(
			<MemoryRouter initialEntries={["/oauth/callback"]}>
				<Routes>
					<Route path="/oauth/callback" element={<AuthCallback />} />
					<Route path="/" element={<div>Dashboard</div>} />
				</Routes>
			</MemoryRouter>,
		);

		expect(await screen.findByText("Authentication failed")).toBeTruthy();
		expect(screen.queryByText("secret identity-provider response")).toBeNull();
		expect(screen.queryByText("Dashboard")).toBeNull();
		await user.click(screen.getByRole("button", { name: "Try signing in again" }));
		expect(signIn).toHaveBeenCalledOnce();
	});
});
