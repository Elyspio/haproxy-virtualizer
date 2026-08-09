import { expect, type Page } from "@playwright/test";

/** A backend of the development `haproxy.cfg` that already has a server, so TLS settings are meaningful. */
export const backendUnderTest = "kube";

/**
 * Signs in through Keycloak. The realm ships an `admin`/`admin` user and the SPA is a public client, so the browser
 * walks the same authorization-code redirect a real user does.
 */
export async function signIn(page: Page) {
	await page.goto("/");

	const signInButton = page.getByRole("button", { name: "Sign In" });
	const workspaceLink = page.getByRole("button", { name: "Backends" });

	await expect(signInButton.or(workspaceLink).first()).toBeVisible();

	if (await workspaceLink.isVisible()) {
		return;
	}

	await signInButton.click();

	await page.getByLabel("Username or email").fill("admin");
	await page.getByLabel("Password", { exact: true }).fill("admin");
	await page.getByRole("button", { name: "Sign In" }).click();

	await expect(workspaceLink).toBeVisible();
}

/**
 * The API only starts reading HAProxy once its container is up, so the very first configuration query of a cold stack
 * can come back empty. Reloading until the backend appears keeps that startup race out of the assertions.
 *
 * The backend is then picked from the list rather than through the query string: while the configuration is still
 * loading the workspace drops an unknown selection from the URL and falls back to the first backend, which would
 * silently point the whole test at the wrong section.
 */
export async function openBackend(page: Page, backendName = backendUnderTest) {
	await expect(async () => {
		await page.goto("/workspace?section=backend");
		await page.getByTestId(`backend-item-${backendName}`).click({ timeout: 10_000 });
		await expect(page.getByLabel("Backend name")).toHaveValue(backendName, { timeout: 10_000 });
	}).toPass({ timeout: 120_000 });

	await expect(configPreview(page)).toContainText(`backend ${backendName}`);
}

/**
 * Picks an option in a MUI select identified by its `data-testid`. Several selects render a description under the
 * label, which lands in the accessible name, so the option is matched on its leading label rather than exactly.
 */
export async function selectOption(page: Page, testId: string, optionLabel: string) {
	await page.getByTestId(testId).getByRole("combobox").click();
	await page.getByRole("option", { name: new RegExp(`^${optionLabel.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
}

/**
 * Saves and waits for the API to answer, rather than for an animation. A rejected save fails the assertion here instead
 * of surfacing later as a confusing state mismatch.
 */
export async function save(page: Page) {
	const saved = page.waitForResponse((response) => response.url().includes("/api/config") && response.request().method() === "PUT");

	await page.getByRole("button", { name: "Save" }).click();

	const response = await saved;
	expect(response.status(), await response.text()).toBe(200);
}

export function configPreview(page: Page) {
	return page.getByTestId("config-preview");
}
