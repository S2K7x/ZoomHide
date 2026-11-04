import { createRequire } from "module"; const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "fs";
import path from "path";
const dir = path.dirname(new URL(import.meta.url).pathname);
const HIDES = [
  { id: "p163", shape: "star", x: 74, y: 31, size: 8, rot: 12, name: "Maya" },
  { id: "p211", shape: "ring", x: 63, y: 58, size: 8, rot: 0, name: "Leo" },
  { id: "p42", shape: "heart", x: 28, y: 76, size: 8, rot: -15, name: "Sofia" },
  { id: "p490", shape: "dot", x: 81, y: 31, size: 6.5, rot: 0, name: "Noah" },
  { id: "p36", shape: "hexagon", x: 45, y: 74, size: 7, rot: 8, name: "Jade" },
  { id: "p514", shape: "rectangle", x: 26, y: 17, size: 8, rot: 0, name: "Oliver" },
  { id: "p76", shape: "triangle", x: 22, y: 42, size: 9, rot: 6, name: "Chloe" },
  { id: "p292", shape: "dot", x: 54, y: 86, size: 6, rot: 0, name: "Ethan" },
  { id: "p535", shape: "diamond", x: 28, y: 72, size: 8, rot: 0, name: "Zoe" },
  { id: "p366", shape: "square", x: 71, y: 64, size: 6.5, rot: 4, name: "Lucas" },
  { id: "p57", shape: "plus", x: 86, y: 52, size: 7, rot: 0, name: "Emma" },
  { id: "p0", shape: "diamond", x: 22, y: 63, size: 6.5, rot: 0, name: "Mia" },
];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");
const meta = [];
for (const h of HIDES) {
  const b64 = fs.readFileSync(`${dir}/src/${h.id}.jpg`).toString("base64");
  const res = await page.evaluate(async ({ b64, h }) => {
    function shapeBody(id, color) {
      const f = `fill="${color}"`;
      switch (id) {
        case "square": return `<rect x="6" y="6" width="52" height="52" rx="6" ${f}/>`;
        case "rectangle": return `<rect x="4" y="20" width="56" height="24" rx="4" ${f}/>`;
        case "triangle": return `<polygon points="32,7 58,56 6,56" ${f}/>`;
        case "star": return `<polygon points="32,4 39,24 60,24 43,37 49,58 32,45 15,58 21,37 4,24 25,24" ${f}/>`;
        case "heart": return `<path d="M32 56 C8 40 4 24 14 14 C22 7 30 12 32 18 C34 12 42 7 50 14 C60 24 56 40 32 56 Z" ${f}/>`;
        case "diamond": return `<polygon points="32,4 58,32 32,60 6,32" ${f}/>`;
        case "hexagon": return `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" ${f}/>`;
        case "plus": return `<path d="M24 6 h16 v18 h18 v16 h-18 v18 h-16 v-18 h-18 v-16 h18 z" ${f}/>`;
        case "ring": return `<circle cx="32" cy="32" r="24" fill="none" stroke="${color}" stroke-width="11"/>`;
        default: return `<circle cx="32" cy="32" r="28" ${f}/>`;
      }
    }
    const load = (src) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; });
    const img = await load("data:image/jpeg;base64," + b64);
    const W = img.naturalWidth, H = img.naturalHeight;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
    const w = (h.size / 100) * W, cx = (h.x / 100) * W, cy = (h.y / 100) * H;
    const d = ctx.getImageData(Math.round(cx - w / 2), Math.round(cy - w / 2), Math.round(w), Math.round(w)).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    r /= n; g /= n; b /= n;
    // léger décalage pour rester visible à l'œil attentif
    const lum = (r + g + b) / 3; const k = lum > 128 ? 0.86 : 1.22;
    const c = [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
    const color = "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
    const st = await load("data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${shapeBody(h.shape, color)}</svg>`));
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((h.rot * Math.PI) / 180); ctx.drawImage(st, -w / 2, -w / 2, w, w); ctx.restore();
    const full = cv.toDataURL("image/jpeg", 0.88);
    const t = document.createElement("canvas"); t.width = 400; t.height = Math.round(400 * H / W);
    t.getContext("2d").drawImage(cv, 0, 0, t.width, t.height);
    return { full, thumb: t.toDataURL("image/jpeg", 0.85), color };
  }, { b64, h });
  fs.writeFileSync(`${dir}/out/${h.id}.jpg`, Buffer.from(res.full.split(",")[1], "base64"));
  fs.writeFileSync(`${dir}/out/${h.id}_thumb.jpg`, Buffer.from(res.thumb.split(",")[1], "base64"));
  meta.push({ ...h, color: res.color });
}
fs.writeFileSync(`${dir}/out/meta.json`, JSON.stringify(meta, null, 2));
await browser.close();
console.log(meta.map((m) => `${m.id} ${m.color}`).join("\n"));
