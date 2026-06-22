import { expect, test, type Page } from "@playwright/test";

const USERNAME_KEY = "ai-use-case-navigator-username";
const POWER_KEY = "ai-use-case-navigator-has-power";
const SIDEBAR_KEY = "sidebar-collapsed";

async function seedSession(page: Page) {
  await page.addInitScript(
    ({
      usernameKey,
      powerKey,
      sidebarKey,
    }: {
      usernameKey: string;
      powerKey: string;
      sidebarKey: string;
    }) => {
      window.localStorage.setItem(usernameKey, "Playwright User");
      window.localStorage.setItem(powerKey, "true");
      window.localStorage.setItem(sidebarKey, "0");
    },
    {
      usernameKey: USERNAME_KEY,
      powerKey: POWER_KEY,
      sidebarKey: SIDEBAR_KEY,
    },
  );
}

test.describe("onboarding", () => {
  test("prompts for username and persists login", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
    await page.getByLabel("Your Name").fill("A");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Name must be at least 2 characters")).toBeVisible();

    await page.getByLabel("Your Name").fill("Case Owner");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome" })).toHaveCount(0);
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), USERNAME_KEY))
      .toBe("Case Owner");
  });
});

test.describe("common app scenarios", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test("keeps factsheet search in URL and on reload", async ({ page }) => {
    await page.goto("/factsheets");

    await page.getByPlaceholder("Search factsheets...").fill("alpha");
    await page.getByLabel("Verified only").check();
    await expect(page).toHaveURL(/search=alpha/);
    await expect(page).toHaveURL(/verifiedOnly=true/);

    await page.reload();
    await expect(page.getByPlaceholder("Search factsheets...")).toHaveValue("alpha");
    await expect(page.getByLabel("Verified only")).toBeChecked();
  });

  test("persists dependencies display preferences in URL", async ({ page }) => {
    await page.goto("/dependencies");

    await page.getByRole("button", { name: "More filters" }).click();
    await page.getByRole("button", { name: "Comments" }).click();
    await page.getByRole("button", { name: "Hide", exact: true }).click();

    await expect(page).toHaveURL(/showComments=false/);
    await expect(page).toHaveURL(/unrelatedDisplayMode=hide/);

    await page.reload();
    await expect(page).toHaveURL(/showComments=false/);
    await expect(page).toHaveURL(/unrelatedDisplayMode=hide/);
  });

  test("keeps matrix query state in print link", async ({ page }) => {
    await page.goto("/matrix");

    await page.getByPlaceholder("Search factsheets...").fill("landscape");
    await expect(page).toHaveURL(/search=landscape/);
    await expect(page.getByRole("link", { name: "Print View" })).toHaveAttribute(
      "href",
      /search=landscape/,
    );
  });

  test("stores spider axis mode in URL", async ({ page }) => {
    await page.goto("/spider");

    await page.getByRole("button", { name: "Properties" }).click();
    await expect(page).toHaveURL(/axisMode=properties/);

    await page.reload();
    await expect(page).toHaveURL(/axisMode=properties/);
  });

  test("stores scatter axis mode in URL", async ({ page }) => {
    await page.goto("/scatter");

    await page.getByRole("button", { name: "Metrics" }).click();
    await expect(page).toHaveURL(/axisMode=metrics/);

    await page.reload();
    await expect(page).toHaveURL(/axisMode=metrics/);
  });

  test("restores impact analysis calculation mode and depth from URL", async ({
    page,
  }) => {
    await page.goto("/impact?calculationMode=custom&customDepth=4");

    await expect(page).toHaveURL(/calculationMode=custom/);
    await expect(page).toHaveURL(/customDepth=4/);
    await expect(page.getByRole("spinbutton")).toHaveValue("4");
  });

  test("opens chat in a usable state", async ({ page }) => {
    await page.goto("/chat");

    const unconfiguredHeading = page.getByRole("heading", {
      name: "LLM Not Configured",
    });
    if ((await unconfiguredHeading.count()) > 0) {
      await expect(unconfiguredHeading).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Settings page" }),
      ).toHaveAttribute("href", "/settings");
      return;
    }

    await expect(
      page.getByRole("heading", { name: "Talk to the Data" }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Ask a question about your data…"),
    ).toBeVisible();
  });
});
