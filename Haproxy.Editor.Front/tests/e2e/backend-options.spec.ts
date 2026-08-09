import { expect, test } from "@playwright/test";
import { backendUnderTest, configPreview, openBackend, save, selectOption, signIn } from "./workspace";

/**
 * Drives the real stack: the browser edits a backend, the API writes through the HAProxy Data Plane API, and each
 * assertion after a reload proves the setting survived the round trip to HAProxy itself.
 *
 * The specs share one HAProxy configuration and build on each other, so they run in file order with a single worker.
 */
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
	await signIn(page);
	await openBackend(page);
});

test("sends TLS to a self-signed upstream through default-server and a server override", async ({ page }) => {
	await selectOption(page, "default-server-ssl", "Enabled");
	await selectOption(page, "default-server-verify", "None (accept self-signed)");
	await selectOption(page, "server-ssl-0", "Enabled");
	await selectOption(page, "server-verify-0", "None (accept self-signed)");

	await expect(configPreview(page)).toContainText("default-server ssl verify none");
	await expect(configPreview(page)).toContainText("ssl verify none");

	await save(page);

	// A reload re-reads the configuration from HAProxy, so passing here means HAProxy accepted and kept the settings.
	await page.reload();
	await openBackend(page);

	await expect(page.getByTestId("default-server-ssl").getByRole("combobox")).toHaveText("Enabled");
	await expect(page.getByTestId("default-server-verify").getByRole("combobox")).toHaveText("None (accept self-signed)");
	await expect(page.getByTestId("server-ssl-0").getByRole("combobox")).toHaveText("Enabled");
	await expect(configPreview(page)).toContainText("default-server ssl verify none");
});

test("writes an advanced backend option the editor does not model", async ({ page }) => {
	await page.getByTestId("advanced-backend-field").fill("retries");
	// Each option shows the field name and its type, so the accessible name is "retries number".
	await page.getByRole("option", { name: /^retries\b/ }).click();
	await page.getByTestId("advanced-backend-add").click();

	await page.getByTestId("advanced-backend-value-retries").fill("5");
	await expect(configPreview(page)).toContainText("retries 5");

	await save(page);

	await page.reload();
	await openBackend(page);

	await expect(page.getByTestId("advanced-backend-value-retries")).toHaveValue("5");
});

test("keeps unmodelled configuration when a modelled field changes", async ({ page }) => {
	await expect(page.getByTestId("advanced-backend-value-retries")).toHaveValue("5");

	// Editing only the balance algorithm used to rewrite the whole backend section and drop everything else.
	await selectOption(page, "backend-balance", "Least Connections");
	await save(page);

	await page.reload();
	await openBackend(page);

	await expect(page.getByTestId("backend-balance").getByRole("combobox")).toContainText("Least Connections");

	await expect(page.getByTestId("advanced-backend-value-retries")).toHaveValue("5");
});

test("refuses an advanced field that would run commands inside the container", async ({ page }) => {
	await page.getByTestId("advanced-backend-field").fill("external_check_command");

	// Denied fields are not offered at all, and the API rejects them even if a client sends one.
	await expect(page.getByRole("option", { name: /^external_check_command\b/ })).toHaveCount(0);

	const rejected = await page.evaluate(async (backendName) => {
		const config = window["haproxy-editor"] as unknown as { config: { endpoints: { apiUrl: string } } };
		const token = Object.keys(window.localStorage)
			.filter((key) => key.startsWith("oidc.user:"))
			.map((key) => JSON.parse(window.localStorage.getItem(key)!).access_token as string)[0];

		const snapshot = await (await fetch(`${config.config.endpoints.apiUrl}/config`, { headers: { Authorization: `Bearer ${token}` } })).json();
		const backend = snapshot.backends.find((item: { name: string }) => item.name === backendName);
		backend.extra = JSON.stringify({ external_check_command: "/bin/sh" });

		const response = await fetch(`${config.config.endpoints.apiUrl}/config`, {
			method: "PUT",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: JSON.stringify(snapshot),
		});

		return { status: response.status, body: await response.text() };
	}, backendUnderTest);

	expect(rejected.status).toBe(400);
	expect(rejected.body).toContain("external_check_command");
});

test("switches backends, cancels inline edits and blocks deletion while referenced", async ({ page }) => {
	await page.keyboard.press("Control+K");
	await expect(page.getByTestId(`backend-item-${backendUnderTest}`)).toBeVisible();
	await page.getByTestId(`backend-item-${backendUnderTest}`).click();
	await expect(page).toHaveURL(new RegExp(`backend=${backendUnderTest}`));

	const address = page.getByLabel("Server 1 address");
	const originalAddress = await address.inputValue();
	await address.fill("10.0.0.42");
	await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Cancel changes" }).click();
	await expect(address).toHaveValue(originalAddress);
	await expect(page.getByText("All changes saved", { exact: true })).toBeVisible();

	await page.getByRole("button", { name: "Delete", exact: true }).click();
	await expect(page.getByText(new RegExp(`Cannot delete ${backendUnderTest}`))).toBeVisible();
});
