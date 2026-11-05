const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { setup, hides } = require("./harness.cjs");
const OUT = process.argv[2];
const BASE = "http://localhost:3000";
(async () => {
  const browser = await chromium.launch();
  const meta = {};
  const mk = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce", hasTouch: true });
    const page = await ctx.newPage(); await setup(page, opts); return { ctx, page };
  };
  // placement, shape hidden
  {
    const { ctx, page } = await mk();
    await page.goto(BASE + "/create", { waitUntil: "networkidle" });
    await page.setInputFiles('input[type="file"]', path.join(__dirname, "src/p42.jpg"));
    await page.waitForSelector('img[alt="Shape"]'); await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Heart" }).click();
    await page.getByRole("button", { name: "Use color #a9743f" }).click();
    await page.locator('input[type="range"]').nth(3).fill("10");
    await page.locator('input[type="range"]').nth(4).fill("-15");
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    meta.place = { photo: await page.locator('img[alt="Your photo"]').boundingBox(), color: await page.locator('img[alt="Shape"]').evaluate((e) => decodeURIComponent(e.src).match(/fill="(#[0-9a-f]+)"/)[1]) };
    await page.locator('img[alt="Shape"]').evaluate((e) => (e.style.opacity = "0"));
    await page.screenshot({ path: path.join(OUT, "place.png") });
    await ctx.close();
  }
  // game clean + after taps
  {
    const { ctx, page } = await mk();
    const h = hides[0];
    await page.goto(`${BASE}/play/${h.id}`, { waitUntil: "networkidle" }); await page.waitForTimeout(600);
    meta.game = { photo: await page.locator('img[alt="Hide"]').boundingBox(), target: h._m };
    await page.screenshot({ path: path.join(OUT, "game-clean.png") });
    const b = meta.game.photo;
    const tap = async (x, y) => { await page.mouse.click(b.x + b.width * x / 100, b.y + b.height * y / 100); await page.waitForTimeout(150); };
    const submit = async () => { await page.getByRole("button", { name: /Submit this tap/ }).click(); await page.waitForTimeout(600); };
    await tap(20, 30); await submit();
    await page.screenshot({ path: path.join(OUT, "game-cold.png") });
    await tap(h._m.x - 15, h._m.y + 8); await submit();
    await page.screenshot({ path: path.join(OUT, "game-hot.png") });
    await tap(h._m.x, h._m.y); await submit(); await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "game-found-top.png") });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
  await browser.close();
  console.log(JSON.stringify(meta));
})();
