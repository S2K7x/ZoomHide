const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { setup, hides } = require("./harness.cjs");
const OUT = process.argv[2];
const ONLY = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const SIZES = { mobile: [390, 844], desktop: [1440, 900], tablet: [820, 1180] };
const BASE = "http://localhost:3000";

async function shoot(browser, name, size, opts, fn) {
  if (ONLY && !name.includes(ONLY)) return;
  const [w, h] = SIZES[size];
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: "reduce", hasTouch: size === "mobile" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERR", name, e.message));
  await setup(page, opts);
  await fn(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, `${name}-${size}.png`) });
  await ctx.close();
  console.log("✓", name, size);
}
const tapper = (page) => async (x, y) => {
  const b = await page.locator('img[alt="Hide"]').first().boundingBox();
  await page.mouse.click(b.x + (b.width * x) / 100, b.y + (b.height * y) / 100);
  await page.waitForTimeout(150);
};
const submit = async (page) => { await page.getByRole("button", { name: /Submit this tap/ }).click(); await page.waitForTimeout(600); };

const scenes = {
  "01-home": async (p) => { await p.goto(BASE + "/", { waitUntil: "networkidle" }); },
  "02-feed": async (p) => { await p.goto(BASE + "/play", { waitUntil: "networkidle" }); await p.waitForTimeout(800); },
  "03-game": async (p) => {
    const h = hides[0]; await p.goto(`${BASE}/play/${h.id}`, { waitUntil: "networkidle" }); await p.waitForTimeout(500);
    const tap = tapper(p); const m = h._m;
    await tap(20, 30); await submit(p); await tap(m.x - 15, m.y + 8); await submit(p); await tap(m.x + 8, m.y - 3);
  },
  "04-found": async (p) => {
    const h = hides[1]; await p.goto(`${BASE}/play/${h.id}`, { waitUntil: "networkidle" }); await p.waitForTimeout(500);
    const tap = tapper(p); const m = h._m;
    await tap(18, 22); await submit(p); await tap(m.x, m.y); await submit(p); await p.waitForTimeout(2500);
  },
  "05-out-of-tries": async (p) => {
    const h = hides[3]; await p.goto(`${BASE}/play/${h.id}`, { waitUntil: "networkidle" }); await p.waitForTimeout(500);
    const tap = tapper(p); for (const [x, y] of [[10, 10], [50, 88], [40, 55]]) { await tap(x, y); await submit(p); }
    await p.waitForTimeout(800);
  },
  "06-create": async (p) => { await p.goto(BASE + "/create", { waitUntil: "networkidle" }); },
  "07-place-shape": async (p) => {
    await p.goto(BASE + "/create", { waitUntil: "networkidle" });
    await p.setInputFiles('input[type="file"]', path.join(__dirname, "src/p42.jpg"));
    await p.waitForSelector('img[alt="Shape"]'); await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Heart" }).click();
    await p.getByRole("button", { name: "Use color #a9743f" }).click();
    const b = await p.locator('img[alt="Your photo"]').boundingBox();
    const sb = await p.locator('img[alt="Shape"]').boundingBox();
    await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await p.mouse.down();
    await p.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.74, { steps: 8 }); await p.mouse.up();
    await p.locator('input[type="range"]').nth(3).fill("10");
    await p.locator('input[type="range"]').nth(4).fill("-15");
    await p.evaluate(() => window.scrollTo(0, 0));
  },
  "08-private-ready": async (p) => {
    await p.goto(BASE + "/create", { waitUntil: "networkidle" });
    await p.setInputFiles('input[type="file"]', path.join(__dirname, "src/p42.jpg"));
    await p.waitForSelector('img[alt="Shape"]');
    await p.getByRole("button", { name: /Friends only/ }).click();
    await p.getByRole("button", { name: /Publish hide/ }).click(); await p.waitForTimeout(1500);
  },
  "09-active-hide": async (p) => { await p.goto(BASE + "/create", { waitUntil: "networkidle" }); await p.waitForTimeout(600); },
  "10-leaderboard": async (p) => { await p.goto(BASE + "/leaderboard", { waitUntil: "networkidle" }); await p.waitForTimeout(500); },
  "11-private-code": async (p) => {
    await p.goto(BASE + "/play/private", { waitUntil: "networkidle" });
    await p.getByLabel("6-digit code").pressSequentially("482913", { delay: 30 }); await p.locator("body").click({ position: { x: 5, y: 300 } });
  },
};
const sceneOpts = { "08-private-ready": { privateCode: "482913" }, "09-active-hide": { activeHide: "private", activeHideIndex: 2 } };

(async () => {
  const browser = await chromium.launch();
  for (const [name, fn] of Object.entries(scenes)) {
    for (const size of ["mobile", "desktop"]) await shoot(browser, name, size, sceneOpts[name] ?? {}, fn);
  }
  for (const name of ["01-home", "02-feed", "03-game", "10-leaderboard"]) await shoot(browser, name, "tablet", {}, scenes[name]);
  // story image produced by the app on a find (1080x1920 canvas)
  if (!ONLY || ONLY === "story") {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage(); await setup(page, {});
    await scenes["04-found"](page);
    const data = await page.evaluate(() => document.querySelector('canvas[aria-label="Story preview"]').toDataURL("image/png"));
    fs.writeFileSync(path.join(OUT, "12-story-share-image.png"), Buffer.from(data.split(",")[1], "base64"));
    await ctx.close(); console.log("✓ story");
  }
  await browser.close();
})();
