import { createRequire } from "module"; const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "fs";
const dir = new URL(".", import.meta.url).pathname;
const meta = JSON.parse(fs.readFileSync(dir + "out/meta.json"));
const h = meta.find((m) => m.id === "p163");
const b = await chromium.launch(); const p = await b.newPage();
const b64 = fs.readFileSync(dir + "src/hi163.jpg").toString("base64");
const out = await p.evaluate(async ({ b64, h }) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
  const img = await load("data:image/jpeg;base64," + b64);
  const W = img.naturalWidth, H = img.naturalHeight; const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512"><polygon points="32,4 39,24 60,24 43,37 49,58 32,45 15,58 21,37 4,24 25,24" fill="${h.color}"/></svg>`;
  const st = await load("data:image/svg+xml," + encodeURIComponent(svg));
  const w = (h.size / 100) * W; ctx.save(); ctx.translate(h.x / 100 * W, h.y / 100 * H); ctx.rotate(h.rot * Math.PI / 180); ctx.drawImage(st, -w / 2, -w / 2, w, w); ctx.restore();
  return cv.toDataURL("image/jpeg", 0.9);
}, { b64, h });
fs.writeFileSync(dir + "../studio/img/hook163.jpg", Buffer.from(out.split(",")[1], "base64"));
await b.close(); console.log("ok");
