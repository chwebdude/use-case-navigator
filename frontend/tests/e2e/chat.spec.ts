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
    { usernameKey: USERNAME_KEY, powerKey: POWER_KEY, sidebarKey: SIDEBAR_KEY },
  );
}

test.describe("Chat page — tool calling architecture", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.goto("/chat");
  });

  test("shows LLM not configured message when settings are missing", async ({
    page,
  }) => {
    // No LLM settings seeded — should show configuration prompt
    await expect(page.getByText("LLM Not Configured")).toBeVisible();
    await expect(page.getByText("Settings page")).toBeVisible();
  });

  test("shows empty chat state when LLM is configured", async ({ page }) => {
    // Seed LLM settings via PocketBase mock intercept or direct localStorage
    // The chat page reads settings from PocketBase, so we intercept the API call
    await page.route("**/api/collections/app_settings/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 30,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: "test_settings",
              collectionId: "app_settings",
              llm_endpoint: "https://example.com",
              llm_api_key: "test-key",
              llm_model: "gpt-4o",
              statuses: null,
            },
          ],
        }),
      });
    });

    await page.route("**/api/collections/factsheets/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 500,
          totalItems: 0,
          totalPages: 1,
          items: [],
        }),
      });
    });

    await page.reload();

    await expect(page.getByText("Start a conversation")).toBeVisible();
    await expect(page.getByPlaceholder("Ask a question about your data…")).toBeVisible();
  });

  test("shows suggestion chips on empty chat state", async ({ page }) => {
    await page.route("**/api/collections/app_settings/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 30,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: "test_settings",
              collectionId: "app_settings",
              llm_endpoint: "https://example.com",
              llm_api_key: "test-key",
              llm_model: "gpt-4o",
              statuses: null,
            },
          ],
        }),
      });
    });

    await page.route("**/api/collections/factsheets/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 500,
          totalItems: 0,
          totalPages: 1,
          items: [],
        }),
      });
    });

    await page.reload();

    await expect(
      page.getByRole("button", { name: "How many factsheets are there?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Summarize the factsheets by status" }),
    ).toBeVisible();
  });

  test("clicking a suggestion chip fills the input", async ({ page }) => {
    await page.route("**/api/collections/app_settings/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 30,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: "test_settings",
              collectionId: "app_settings",
              llm_endpoint: "https://example.com",
              llm_api_key: "test-key",
              llm_model: "gpt-4o",
              statuses: null,
            },
          ],
        }),
      });
    });

    await page.route("**/api/collections/factsheets/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 500,
          totalItems: 0,
          totalPages: 1,
          items: [],
        }),
      });
    });

    await page.reload();

    await page
      .getByRole("button", { name: "How many factsheets are there?" })
      .click();
    await expect(page.getByPlaceholder("Ask a question about your data…")).toHaveValue(
      "How many factsheets are there?",
    );
  });

  test("sends a message and shows assistant response via tool calling", async ({
    page,
  }) => {
    // Mock app_settings
    await page.route("**/api/collections/app_settings/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 30,
          totalItems: 1,
          totalPages: 1,
          items: [
            {
              id: "test_settings",
              collectionId: "app_settings",
              llm_endpoint: "https://llm.example.com",
              llm_api_key: "test-key",
              llm_model: "gpt-4o",
              statuses: null,
            },
          ],
        }),
      });
    });

    // Mock factsheets endpoint (for linkification + tool calls)
    await page.route("**/api/collections/factsheets/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1,
          perPage: 500,
          totalItems: 2,
          totalPages: 1,
          items: [
            { id: "fs1", name: "Factsheet A", type: "t1", status: "active" },
            { id: "fs2", name: "Factsheet B", type: "t1", status: "active" },
          ],
        }),
      });
    });

    // Mock all other PocketBase collections used by tool functions
    await page.route("**/api/collections/factsheet_types/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1, perPage: 200, totalItems: 1, totalPages: 1,
          items: [{ id: "t1", name: "Use Case", color: "#000" }],
        }),
      });
    });

    await page.route("**/api/collections/dependencies/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: 1, perPage: 200, totalItems: 0, totalPages: 1, items: [] }),
      });
    });

    // Mock LLM endpoint — first call requests tool, second call gives final answer
    let llmCallCount = 0;
    await page.route("**/llm.example.com/**", (route) => {
      llmCallCount++;
      if (llmCallCount === 1) {
        // First call: LLM requests get_statistics tool
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "get_statistics",
                        arguments: "{}",
                      },
                    },
                  ],
                },
              },
            ],
          }),
        });
      } else {
        // Second call: LLM gives final answer
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  role: "assistant",
                  content: "There are **2 factsheets** in the system.",
                },
              },
            ],
          }),
        });
      }
    });

    await page.reload();

    // Type and send a message
    const input = page.getByPlaceholder("Ask a question about your data…");
    await input.fill("How many factsheets are there?");
    await page.getByRole("button").filter({ hasText: "" }).last().click();

    // Should show the user message
    await expect(page.getByText("How many factsheets are there?")).toBeVisible();

    // Should show the assistant response
    await expect(
      page.getByText("There are", { exact: false }),
    ).toBeVisible({ timeout: 10000 });

    // LLM should have been called twice (once for tool call, once for final answer)
    expect(llmCallCount).toBe(2);
  });

  test("shows tool activity indicator while tools are executing", async ({
    page,
  }) => {
    await page.route("**/api/collections/app_settings/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1, perPage: 30, totalItems: 1, totalPages: 1,
          items: [
            {
              id: "test_settings",
              collectionId: "app_settings",
              llm_endpoint: "https://llm.example.com",
              llm_api_key: "test-key",
              llm_model: "gpt-4o",
              statuses: null,
            },
          ],
        }),
      });
    });

    await page.route("**/api/collections/factsheets/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1, perPage: 500, totalItems: 0, totalPages: 1, items: [],
        }),
      });
    });

    await page.route("**/api/collections/factsheet_types/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: 1, perPage: 200, totalItems: 0, totalPages: 1, items: [] }),
      });
    });

    await page.route("**/api/collections/dependencies/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: 1, perPage: 200, totalItems: 0, totalPages: 1, items: [] }),
      });
    });

    // LLM: tool call then final answer, with slow tool execution
    let llmCallCount = 0;
    await page.route("**/llm.example.com/**", async (route) => {
      llmCallCount++;
      if (llmCallCount === 1) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: { name: "get_statistics", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
          }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { role: "assistant", content: "Done." },
              },
            ],
          }),
        });
      }
    });

    await page.reload();

    const input = page.getByPlaceholder("Ask a question about your data…");
    await input.fill("Statistics please");

    // Send the message
    await page.keyboard.press("Enter");

    // The tool activity indicator text should appear at some point during the request
    // (It may flash briefly; we use a generous timeout)
    await expect(page.getByText("Counting factsheets…")).toBeVisible({ timeout: 8000 });
  });

  test("clear button resets conversation and API history", async ({ page }) => {
    await page.route("**/api/collections/app_settings/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1, perPage: 30, totalItems: 1, totalPages: 1,
          items: [
            {
              id: "test_settings",
              collectionId: "app_settings",
              llm_endpoint: "https://llm.example.com",
              llm_api_key: "test-key",
              llm_model: "gpt-4o",
              statuses: null,
            },
          ],
        }),
      });
    });

    await page.route("**/api/collections/factsheets/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1, perPage: 500, totalItems: 0, totalPages: 1, items: [],
        }),
      });
    });

    await page.route("**/api/collections/factsheet_types/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: 1, perPage: 200, totalItems: 0, totalPages: 1, items: [] }),
      });
    });

    await page.route("**/api/collections/dependencies/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: 1, perPage: 200, totalItems: 0, totalPages: 1, items: [] }),
      });
    });

    await page.route("**/llm.example.com/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { role: "assistant", content: "Hello from the assistant." },
            },
          ],
        }),
      });
    });

    await page.reload();

    // Send a message to create conversation history
    const input = page.getByPlaceholder("Ask a question about your data…");
    await input.fill("Hello");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Hello from the assistant.")).toBeVisible({
      timeout: 8000,
    });

    // Clear button should now be visible
    const clearButton = page.getByRole("button", { name: "Clear" });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Conversation should be reset
    await expect(page.getByText("Hello from the assistant.")).not.toBeVisible();
    await expect(page.getByText("Start a conversation")).toBeVisible();
    await expect(clearButton).not.toBeVisible();
  });

  test("shows error message when LLM request fails", async ({ page }) => {
    await page.route("**/api/collections/app_settings/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1, perPage: 30, totalItems: 1, totalPages: 1,
          items: [
            {
              id: "test_settings",
              collectionId: "app_settings",
              llm_endpoint: "https://llm.example.com",
              llm_api_key: "test-key",
              llm_model: "gpt-4o",
              statuses: null,
            },
          ],
        }),
      });
    });

    await page.route("**/api/collections/factsheets/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1, perPage: 500, totalItems: 0, totalPages: 1, items: [],
        }),
      });
    });

    // LLM returns an error
    await page.route("**/llm.example.com/**", (route) => {
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      });
    });

    await page.reload();

    const input = page.getByPlaceholder("Ask a question about your data…");
    await input.fill("Test question");
    await page.keyboard.press("Enter");

    // Should show error state
    await expect(
      page.getByText("LLM request failed", { exact: false }),
    ).toBeVisible({ timeout: 8000 });

    // Input should be re-enabled after error
    await expect(input).toBeEnabled();
  });

  test("displays model name and tool calls footer text", async ({ page }) => {
    await page.route("**/api/collections/app_settings/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: 1, perPage: 30, totalItems: 1, totalPages: 1,
          items: [
            {
              id: "test_settings",
              collectionId: "app_settings",
              llm_endpoint: "https://llm.example.com",
              llm_api_key: "test-key",
              llm_model: "gpt-4o-mini",
              statuses: null,
            },
          ],
        }),
      });
    });

    await page.route("**/api/collections/factsheets/records**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ page: 1, perPage: 500, totalItems: 0, totalPages: 1, items: [] }),
      });
    });

    await page.reload();

    await expect(page.getByText("gpt-4o-mini", { exact: false })).toBeVisible();
    await expect(
      page.getByText("Queries data on demand via tool calls", { exact: false }),
    ).toBeVisible();
  });
});
