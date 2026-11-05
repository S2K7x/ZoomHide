// node render.cjs page.html out.png width height [scale] [transparent]
const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const [html, out, w, h, scale = "1", transparent = "0"] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
  await p.goto("file://" + path.resolve(html) + (process.argv[8] ? "#" + process.argv[8] : ""), { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out, omitBackground: transparent === "1" });
  await b.close();
})();
