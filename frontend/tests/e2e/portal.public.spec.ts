import { expect, test } from "@playwright/test";

const customerOrigin = "https://chat.company.example";

test.beforeEach(async ({ page }) => {
  await page.route(`${customerOrigin}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/discovery") {
      await route.fulfill({
        body: JSON.stringify({
          data: {
            discovery: {
              capabilities: { self_hosted: true },
              deployment: { status: "ready" },
              domain: "chat.company.example",
              runtime: {
                api_base_url: customerOrigin,
                app_name: "Company Chat",
                app_version: "1.0.0",
                web_base_url: customerOrigin,
                ws_base_url: "wss://chat.company.example/ws"
              },
              zone: {
                name: "Company Chat",
                registration_mode: "open",
                status: "active"
              }
            }
          }
        }),
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        status: 200
      });
      return;
    }

    await route.fulfill({
      body: "<title>Company Chat</title>",
      contentType: "text/html",
      status: 200
    });
  });
});

test("discovery hợp lệ chuyển browser tới đăng ký trên instance customer", async ({
  page
}) => {
  await page.goto("/");
  await page.getByLabel("Domain WebTUI Chat").fill("chat.company.example");
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page).toHaveURL(
    `${customerOrigin}/?auth=register&source=portal`
  );
});

test("portal không tràn ngang trên mobile", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.scrollWidth).toBe(metrics.innerWidth);
});
