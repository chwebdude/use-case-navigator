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

async function mockData(page: Page, graphData?: {
  factsheets: typeof factsheets;
  dependencies: typeof dependencies;
}): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("ai-use-case-navigator-username", "Graph Tester");
  });
  await page.route("**/api/collections/**", async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/collections\/([^/]+)\/records(?:\/([^/]+))?/);
    if (!match) return route.fulfill({ json: {} });
    const collections: Record<string, { id: string }[]> = {
      factsheets: graphData?.factsheets ?? factsheets,
      dependencies: graphData?.dependencies ?? dependencies,
      factsheet_types: [factsheetType],
      app_settings: [{ id: "settings", title: "Graph tests", icon: "Cpu", statuses: [
        { id: "draft", label: "Draft", color: "#6b7280" },
      ] }],
    };
    let records = collections[match[1]] ?? [];
    if (match[1] === "factsheets" && url.searchParams.get("filter")?.includes('id = "')) {
      records = records.filter((record) => url.searchParams.get("filter")!.includes(`"${record.id}"`));
    }
    if (match[1] === "dependencies" && url.searchParams.get("filter")?.startsWith("factsheet =")) {
      records = (graphData?.dependencies ?? dependencies).filter((dependency) => url.searchParams.get("filter")!.includes(`"${dependency.factsheet}"`));
    }
    await route.fulfill({ json: match[2]
      ? records.find((record) => record.id === match[2]) ?? {}
      : { page: 1, perPage: 500, totalItems: records.length, totalPages: 1, items: records } });
  });
}

const graphNodes = (page: Page) => page.locator(".react-flow__node");
const graphEdges = (page: Page) => page.locator(".react-flow__edge");

async function clickEdge(page: Page, dependencyId: string, button: "left" | "right" = "right"): Promise<void> {
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
  await page.mouse.click(point!.x, point!.y, { button });
}

test.beforeEach(async ({ page }) => {
  await mockData(page);
});

test("menu interactions do not rerun graph layout with 150 factsheets", async ({ page }, testInfo) => {
  const extraFactsheets = Array.from({ length: 144 }, (_, index) => ({
    ...factsheets[0], id: `extra${index}`, name: `Extra factsheet ${index}`,
  }));
  const extraDependencies = extraFactsheets.slice(10).map((factsheet, index) => ({
    ...dependencies[0], id: `extraedge${index}`, factsheet: factsheet.id,
    depends_on: extraFactsheets[index].id,
  }));
  await mockData(page, {
    factsheets: [...factsheets, ...extraFactsheets],
    dependencies: [...dependencies, ...extraDependencies],
  });
  await page.route(/\/src\/components\/visualizations\/DependencyGraph\.tsx(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    expect(source).toContain("dagre.layout(dagreGraph)");
    await route.fulfill({ response, body: source.replace("dagre.layout(dagreGraph)",
      "(window.__graphLayoutCalls = (window.__graphLayoutCalls || 0) + 1, dagre.layout(dagreGraph))") });
  });
  const initialResponses = ["factsheets", "dependencies", "factsheet_types", "app_settings",
    "property_definitions", "property_options", "factsheet_properties"].map((collection) =>
    page.waitForResponse((response) => response.url().includes(`/collections/${collection}/records`)));
  await page.goto("/dependencies");
  await Promise.all(initialResponses);
  await expect(graphNodes(page)).toHaveCount(150);
  await expect(page.locator(".react-flow").locator("..").locator("..")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const layoutCalls = (): Promise<number> => page.evaluate(() =>
    (window as Window & { __graphLayoutCalls: number }).__graphLayoutCalls);
  await expect.poll(layoutCalls).toBeGreaterThan(0);
  const before = await layoutCalls();
  await clickEdge(page, "ab");
  await expect(page.getByRole("menu", { name: "Dependency actions" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("large-graph-context-menu.png") });
  expect(await layoutCalls()).toBe(before);
  await page.keyboard.press("Escape");
  expect(await layoutCalls()).toBe(before);
  await clickEdge(page, "ab");
  await page.getByRole("menuitem", { name: "Hide dependency", exact: true }).click();
  await expect(graphEdges(page)).toHaveCount(138);
  expect(await layoutCalls()).toBe(before);
  await page.getByRole("button", { name: "Restore all hidden dependencies" }).click();
  await expect(graphEdges(page)).toHaveCount(139);
  expect(await layoutCalls()).toBe(before);
  const gamma = graphNodes(page).filter({ hasText: "Gamma" });
  await gamma.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Hide factsheet", exact: true }).click();
  await expect(graphNodes(page)).toHaveCount(149);
  expect(await layoutCalls()).toBe(before);
  await page.getByRole("button", { name: "Restore all hidden items", exact: true }).click();
  await expect(graphNodes(page)).toHaveCount(150);
  expect(await layoutCalls()).toBe(before);
  const node = graphNodes(page).first();
  await node.scrollIntoViewIfNeeded();
  const bounds = await node.boundingBox();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 + 30, bounds!.y + bounds!.height / 2 + 20, { steps: 10 });
  await page.mouse.up();
  expect(await layoutCalls()).toBe(before);
  console.log(`150-node graph: ${before} initial layouts, zero additional layouts for menu/hide/restore/drag.`);
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
    await expect(page.getByRole("menu", { name: "Dependency actions" })).toBeVisible();
    await expect(graphEdges(page)).toHaveCount(5);
    await page.getByRole("menuitem", { name: "Hide dependency", exact: true }).click();
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
    await clickEdge(page, "ab");
    await page.getByRole("menuitem", { name: "Hide dependency", exact: true }).click();
    await expect(graphEdges(page)).toHaveCount(4);
    await page.getByRole("button", { name: "Restore all hidden dependencies" }).click();
    await clickEdge(page, "ab");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Dependency actions" })).toHaveCount(0);
    await expect(graphEdges(page)).toHaveCount(5);
    if (path === "/dependencies") {
      await clickEdge(page, "ab");
      await page.getByRole("menuitem", { name: "Edit dependency", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Edit Dependency" })).toBeVisible();
    }
    expect(mutations).toEqual([]);
  });

  test(`right-click factsheet menu offers focus and connected views: ${path}`, async ({ page }) => {
    await page.goto(path === "/dependencies" ? `${path}?unrelatedDisplayMode=hide` : path);
    const alpha = graphNodes(page).filter({ hasText: "Alpha" });
    await alpha.click({ button: "right" });
    await expect(page.getByRole("menu", { name: "Factsheet actions" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Connected factsheets", exact: true }).click();
    await expect(graphNodes(page)).toHaveCount(5);
    await expect(page.getByLabel("Graph relations")).toHaveValue("connected");
    await alpha.click({ button: "right" });
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Add connected factsheets", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Focus factsheet", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Connected factsheets", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "Factsheet actions" })).toHaveCount(0);
    if (path === "/dependencies") {
      await clickEdge(page, "ab", "left");
      await expect(page.getByRole("heading", { name: "Edit Dependency" })).toBeVisible();
    }
  });

  test(`hides a single factsheet and its edges without deleting or exporting it: ${path}`, async ({ page }) => {
    const mutations: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/collections/") && request.method() !== "GET") mutations.push(request.method());
    });
    await page.goto(path);
    await page.getByLabel("Graph relations").selectOption("connected");
    const gamma = graphNodes(page).filter({ hasText: "Gamma" });
    await gamma.click({ button: "right" });
    await expect(gamma).toBeVisible();
    await page.getByRole("menuitem", { name: "Hide factsheet", exact: true }).click();
    await expect(gamma).toHaveCount(0);
    await expect(graphEdges(page)).toHaveCount(2);
    await expect(graphNodes(page).filter({ hasText: "Delta" })).toBeVisible();
    if (path === "/dependencies") {
      await page.getByRole("button", { name: "More filters" }).click();
      await page.getByRole("button", { name: "Auto Align" }).click();
      await expect(gamma).toHaveCount(0);
      await page.getByRole("button", { name: "Export Graph" }).click();
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export SVG", exact: true }).click();
    const svg = await readFile((await (await downloadPromise).path())!, "utf8");
    expect(svg).not.toContain("Gamma");
    expect(svg).toContain("Delta");
    await page.getByRole("button", { name: "Restore all hidden items", exact: true }).click();
    await expect(gamma).toBeVisible();
    await expect(graphEdges(page)).toHaveCount(5);
    expect(mutations).toEqual([]);
  });

  test(`adds connected factsheets without replacing the current view: ${path}`, async ({ page }) => {
    await page.goto(path === "/dependencies" ? `${path}?unrelatedDisplayMode=hide` : path);
    if (path === "/dependencies") {
      await graphNodes(page).filter({ hasText: "Isolated" }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Hide factsheet", exact: true }).click();
      await expect(graphNodes(page).filter({ hasText: "Isolated" })).toHaveCount(0);
      await page.getByLabel("Graph factsheet").selectOption("alpha");
      await page.getByLabel("Graph relations").selectOption("direct");
      await expect(graphNodes(page)).toHaveCount(3);
    } else {
      await page.getByLabel("Graph relations").selectOption("direct");
      await expect(graphNodes(page)).toHaveCount(3);
      await graphNodes(page).filter({ hasText: "Beta" }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Hide factsheet", exact: true }).click();
      await expect(graphNodes(page).filter({ hasText: "Beta" })).toHaveCount(0);
    }

    await graphNodes(page).filter({ hasText: "Alpha" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add connected factsheets", exact: true }).click();
    await expect(graphNodes(page)).toHaveCount(3);
    await expect(page.getByLabel("Graph relations")).toHaveValue("direct");
    await expect(graphNodes(page).filter({ hasText: "Isolated" })).toHaveCount(0);
    await expect(graphNodes(page).filter({ hasText: "Beta" })).toBeVisible();
    await expect(graphNodes(page).filter({ hasText: "Epsilon" })).toBeVisible();
    await expect(graphNodes(page).filter({ hasText: "Gamma" })).toHaveCount(0);
    await expect(graphNodes(page).filter({ hasText: "Delta" })).toHaveCount(0);

    await graphNodes(page).filter({ hasText: "Beta" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Hide factsheet", exact: true }).click();
    await expect(graphNodes(page).filter({ hasText: "Beta" })).toHaveCount(0);
    await page.getByRole("button", { name: "Restore all hidden items", exact: true }).click();
    await expect(graphNodes(page).filter({ hasText: "Beta" })).toBeVisible();
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