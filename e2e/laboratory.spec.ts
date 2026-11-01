import { test, expect } from "@playwright/test";
test("editorial shell, fonts, experiment form, every room and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const family of [
    "Playfair Display",
    "Libre Baskerville",
    "Instrument Serif",
  ])
    expect(
      await page.evaluate((f) => document.fonts.check(`16px "${f}"`), family),
    ).toBe(true);
  await page.getByRole("button", { name: "Begin a New Experiment" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Local AI / Qwen3.5 4B" }),
  ).toHaveAttribute("disabled", "");
  await page.getByRole("button", { name: "Close experiment form" }).click();
  await page.goto("/#personas");
  await page
    .getByRole("textbox", { name: "The First-Timer goal" })
    .fill("Verify a first purchase using visible controls.");
  await page
    .getByRole("button", { name: "Use this persona", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("textbox", { name: "Investigation objective" }),
  ).toHaveValue(/Verify a first purchase using visible controls/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  for (const [route, title] of [
    ["registry", "Product Registry"],
    ["studio", "Experiment Studio"],
    ["personas", "Persona Theatre"],
    ["evidence", "The Evidence Room"],
    ["compare", "Compare Realities"],
    ["atlas", "The Collision Atlas"],
    ["risk", "Risk Atelier"],
    ["journal", "Findings Journal"],
    ["services", "Local, by Design"],
  ]) {
    await page.goto("/#" + route);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
