import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const factsheetType = { id: "type1", name: "Use Case", color: "#00aeef" };
const factsheets = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Isolated"].map((name) => ({
  id: name.toLowerCase(), name, type: "type1", status: "draft",
  description: "", expand: { type: factsheetType },
}));
const dependencies = [
  { id: "ab", factsheet: "alpha", depends_on: "beta", description: "Alpha to Beta" },
  { id: "gb", factsheet: "gamma", depends_on: "beta", description: "Gamma to Beta" },
  { id: "gd", factsheet: "gamma", depends_on: "delta", description: "Gamma to Delta" },
  { id: "dg", factsheet: "delta", depends_on: "gamma", description: "Cycle" },
  { id: "ea", factsheet: "epsilon", depends_on: "alpha", description: "Epsilon to Alpha" },
].map((dependency) => ({
  ...dependency,
  expand: { depends_on: factsheets.find((factsheet) => factsheet.id === dependency.depends_on) },
}));

async function mockData(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("ai-use-case-navigator-username", "Graph Tester");
  });
  await page.route("**/api/collections/**", async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/collections\/([^/]+)\/records(?:\/([^/]+))?/);
    if (!match) return route.fulfill({ json: {} });
    const collections: Record<string, { id: string }[]> = {
      factsheets, dependencies, factsheet_types: [factsheetType],
    };
    let records = collections[match[1]] ?? [];
    if (match[1] === "factsheets" && url.searchParams.get("filter")?.includes('id = "')) {
      records = records.filter((record) => url.searchParams.get("filter")!.includes(`"${record.id}"`));
    }
    if (match[1] === "dependencies" && url.searchParams.get("filter")?.startsWith("factsheet =")) {
      records = dependencies.filter((dependency) => url.searchParams.get("filter")!.includes(`"${dependency.factsheet}"`));
    }
    await route.fulfill({ json: match[2]
      ? records.find((record) => record.id === match[2]) ?? {}
      : { page: 1, perPage: 500, totalItems: records.length, totalPages: 1, items: records } });
  });
}

const graphNodes = (page: Page) => page.locator(".react-flow__node");
const graphEdges = (page: Page) => page.locator(".react-flow__edge");

async function clickEdge(page: Page, dependencyId: string, shift = false): Promise<void> {
  const edgePath = page.locator(`.react-flow__edge[data-id="e-${dependencyId}"] .react-flow__edge-interaction`);
  await edgePath.scrollIntoViewIfNeeded();
  const point = await edgePath.evaluate((element) => {
    const path = element as SVGPathElement;
    for (const fraction of [0.5, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9]) {
      const position = path.getPointAtLength(path.getTotalLength() * fraction);
      const screen = new DOMPoint(position.x, position.y).matrixTransform(path.getScreenCTM()!);
      if (document.elementFromPoint(screen.x, screen.y)?.closest(".react-flow__edge") === path.closest(".react-flow__edge")) {
        return { x: screen.x, y: screen.y };
      }
    }
    return null;
  });
  expect(point).not.toBeNull();
  if (shift) await page.keyboard.down("Shift");
  try {
    await page.mouse.click(point!.x, point!.y);
  } finally {
    if (shift) await page.keyboard.up("Shift");
  }
}

test.beforeEach(async ({ page }) => {
  await mockData(page);
});

test("connected view follows direction changes and cycles, with finer relation modes", async ({ page }, testInfo) => {
  await page.goto("/dependencies?unrelatedDisplayMode=hide");
  await expect(graphNodes(page)).toHaveCount(6);
  await page.getByLabel("Graph factsheet").selectOption("alpha");
  await expect(graphNodes(page)).toHaveCount(3);
  await page.getByLabel("Graph relations").selectOption("connected");
  await expect(graphNodes(page)).toHaveCount(5);
  await expect(graphNodes(page).filter({ hasText: "Gamma" })).toBeVisible();
  await expect(graphNodes(page).filter({ hasText: "Isolated" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("connected-desktop.png") });
  await page.getByLabel("Graph relations").selectOption("upstream");
  await expect(graphNodes(page)).toHaveCount(2);
  await expect(graphNodes(page).filter({ hasText: "Epsilon" })).toBeVisible();
  await page.getByLabel("Graph relations").selectOption("downstream");
  await expect(graphNodes(page)).toHaveCount(2);
  await expect(graphNodes(page).filter({ hasText: "Beta" })).toBeVisible();
  await page.getByLabel("Graph relations").selectOption("direct");
  await expect(graphNodes(page)).toHaveCount(3);
  await page.getByLabel("Graph factsheet").selectOption("");
  await expect(graphNodes(page)).toHaveCount(6);
});

for (const path of ["/dependencies", "/factsheets/alpha"]) {
  test(`hides and restores edges without mutations and exports only the visible graph: ${path}`, async ({ page }) => {
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/collections/") && request.method() !== "GET") {
        mutations.push(request.method());
      }
    });
    await page.goto(path);
    if (path === "/dependencies") {
      await page.getByLabel("Graph factsheet").selectOption("alpha");
    }
    await page.getByLabel("Graph relations").selectOption("connected");
    await expect(graphNodes(page)).toHaveCount(5);
    await expect(graphEdges(page)).toHaveCount(5);
    await clickEdge(page, "ab");
    await expect(page.getByRole("toolbar", { name: "Selected dependencies" })).toBeVisible();
    await page.getByRole("button", { name: "Hide selected dependencies" }).click();
    await expect(graphEdges(page)).toHaveCount(4);
    await expect(graphNodes(page)).toHaveCount(5);
    if (path === "/dependencies") {
      await page.getByRole("button", { name: "More filters" }).click();
      await page.getByRole("button", { name: "Auto Align" }).click();
      await expect(graphEdges(page)).toHaveCount(4);
      await page.getByRole("button", { name: "Export Graph" }).click();
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export SVG", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("dependency-graph.svg");
    const svg = await readFile((await download.path())!, "utf8");
    expect(svg).toContain("Gamma");
    expect(svg).not.toContain("Isolated");
    expect(await page.evaluate((content) => new DOMParser()
      .parseFromString(content, "image/svg+xml")
      .querySelectorAll("path[marker-end]").length, svg)).toBe(4);
    await page.getByRole("button", { name: "Restore all hidden dependencies" }).click();
    await expect(graphEdges(page)).toHaveCount(5);
    await page.locator('.react-flow__edge[data-id="e-ab"] .react-flow__edge-interaction').dispatchEvent("contextmenu");
    await expect(graphEdges(page)).toHaveCount(4);
    await page.getByRole("button", { name: "Restore all hidden dependencies" }).click();
    await clickEdge(page, "ab");
    await clickEdge(page, "gb", true);
    await expect(page.locator(".react-flow__edge.selected")).toHaveCount(2);
    await page.getByRole("button", { name: "Hide selected dependencies" }).click();
    await expect(graphEdges(page)).toHaveCount(3);
    await page.getByRole("button", { name: "Restore all hidden dependencies" }).click();
    await clickEdge(page, "ab");
    await page.getByRole("button", { name: "Clear dependency selection" }).click();
    await expect(page.getByRole("toolbar", { name: "Selected dependencies" })).toHaveCount(0);
    await expect(graphEdges(page)).toHaveCount(5);
    if (path === "/dependencies") {
      await clickEdge(page, "ab");
      await page.getByRole("button", { name: "Edit dependency", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Edit Dependency" })).toBeVisible();
    }
    expect(mutations).toEqual([]);
  });
}

test("factsheet exports PNG and keeps graph controls usable on mobile", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("sidebar-collapsed", "1"));
  await page.goto("/factsheets/alpha");
  await page.getByLabel("Graph relations").selectOption("connected");
  await expect(graphNodes(page)).toHaveCount(5);
  await page.getByLabel("Graph relations").scrollIntoViewIfNeeded();
  await page.locator(".react-flow").locator("..").locator("..").screenshot({
    path: testInfo.outputPath("factsheet-mobile.png"),
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG", exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("dependency-graph.png");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});