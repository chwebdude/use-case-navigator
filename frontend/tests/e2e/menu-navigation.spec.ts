import { expect, test } from "@playwright/test";

const menuItems: Array<{ label: string; path: string }> = [
  { label: "Dashboard", path: "/" },
  { label: "Factsheets", path: "/factsheets" },
  { label: "Dependencies", path: "/dependencies" },
  { label: "Matrix View", path: "/matrix" },
  { label: "Spider Diagram", path: "/spider" },
  { label: "Scatter Plot", path: "/scatter" },
  { label: "Impact Analysis", path: "/impact" },
  { label: "Chat", path: "/chat" },
  { label: "Settings", path: "/settings" },
];

const USERNAME_KEY = "ai-use-case-navigator-username";
const POWER_KEY = "ai-use-case-navigator-has-power";
const SIDEBAR_KEY = "sidebar-collapsed";
const MAX_NAVIGATION_MS = 150;

test.beforeEach(async ({ page }) => {
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

  await page.goto("/");
});

test("opens all pages through sidebar menu clicks", async ({ page }) => {
  const sidebar = page.locator("aside");

  for (const item of menuItems) {
    const menuLink = sidebar.getByRole("link", {
      name: item.label,
      exact: true,
    });

    const elapsedMs = await page.evaluate(
      ({ label, targetPath, maxNavigationMs }) =>
        new Promise<number>((resolve, reject) => {
          const links = Array.from(
            document.querySelectorAll<HTMLAnchorElement>("aside a"),
          );
          const menuLink = links.find(
            (link) => link.textContent?.trim() === label,
          );
          if (!menuLink) {
            reject(new Error(`Menu link "${label}" not found`));
            return;
          }

          const startedAt = performance.now();
          menuLink.click();

          const checkPathSwitch = () => {
            const elapsedMs = performance.now() - startedAt;
            if (window.location.pathname === targetPath) {
              if (elapsedMs <= maxNavigationMs) {
                resolve(elapsedMs);
              } else {
                reject(
                  new Error(
                    `Navigation to ${targetPath} took ${elapsedMs.toFixed(1)}ms, expected <= ${maxNavigationMs}ms`,
                  ),
                );
              }
              return;
            }

            if (elapsedMs > maxNavigationMs) {
              reject(
                new Error(
                  `Navigation to ${targetPath} did not complete within ${maxNavigationMs}ms`,
                ),
              );
              return;
            }

            requestAnimationFrame(checkPathSwitch);
          };

          checkPathSwitch();
        }),
      {
        label: item.label,
        targetPath: item.path,
        maxNavigationMs: MAX_NAVIGATION_MS,
      },
    );

    expect(elapsedMs).toBeLessThanOrEqual(MAX_NAVIGATION_MS);
    await expect(menuLink).toHaveAttribute("aria-current", "page");
  }
});
