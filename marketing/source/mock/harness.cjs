// Mocks Supabase (REST + RPC + Storage) for screenshots — no real backend needed.
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "out");
const meta = JSON.parse(fs.readFileSync(path.join(OUT, "meta.json"), "utf8"));
const BASE = "https://mock.supabase.co";
const url = (f) => `${BASE}/storage/v1/object/public/photos/2026-11/${f}`;
const H = 3600e3;
const NOW = Date.now();
const stats = [
  [2, 41, 2], [6, 89, 1], [9, 25, 3], [30, 70, 0], [70, 12, 0], [100, 55, 6],
  [140, 35, 2], [20, 18, 4], [90, 94, 0], [52, 0, 0], [60, 62, 3], [14, 48, 2],
];
const hides = meta.map((m, i) => {
  const [ageH, fail, finds] = stats[i];
  const total = fail === 0 && finds === 0 ? 0 : Math.round(finds / (1 - fail / 100 || 1)) + 3;
  return {
    id: `00000000-0000-4000-8000-0000000000${String(i + 10)}`,
    creator_name: m.name,
    thumbnail_url: url(`${m.id}_thumb.jpg`),
    photo_url: url(`${m.id}.jpg`),
    sticker_id: m.shape,
    sticker_color: m.color,
    created_at: new Date(NOW - ageH * H).toISOString(),
    expires_at: new Date(NOW - ageH * H + 7 * 24 * H).toISOString(),
    total_attempts: total,
    finds,
    fail_pct: total === 0 ? null : fail,
    _m: m,
  };
});
const leaderboard = [
  ["Maya", 2840, 31, 14, 2], ["Leo", 2410, 27, 11, 1], ["Sofia", 1985, 22, 9, 1],
  ["Noah", 1520, 17, 8, 0], ["Jade", 1310, 15, 6, 1], ["Alex", 1180, 13, 6, 0],
  ["Oliver", 960, 11, 4, 0], ["Chloe", 845, 9, 5, 0], ["Ethan", 720, 8, 3, 0], ["Zoe", 610, 7, 2, 0],
].map(([name, score, finds, fails_caused, perfect_hides]) => ({
  name, is_me: name === "Alex", score, finds, fails_caused, perfect_hides,
}));

async function setup(page, opts = {}) {
  const state = { attempts: opts.attemptsLeft ?? 3 };
  await page.addInitScript((o) => {
    localStorage.setItem("zh_player_id", "11111111-1111-4111-8111-111111111111");
    if (o.name !== undefined) localStorage.setItem("zh_player_name", o.name);
  }, { name: opts.name ?? "Alex" });
  await page.route(`${BASE}/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (p.startsWith("/storage/v1/object/public/photos/")) {
      const f = path.join(OUT, path.basename(p));
      return route.fulfill({ status: 200, contentType: "image/jpeg", headers: { "access-control-allow-origin": "*" }, body: fs.readFileSync(f) });
    }
    if (p === "/rest/v1/active_hides") {
      let list = hides.map(({ _m, photo_url, ...h }) => h);
      const order = u.searchParams.getAll("order").join(",");
      if (order.includes("fail_pct")) list.sort((a, b) => (b.fail_pct ?? -1) - (a.fail_pct ?? -1));
      else if (order.includes("expires_at")) list.sort((a, b) => a.expires_at.localeCompare(b.expires_at));
      else list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return json(list);
    }
    if (p.startsWith("/storage/v1/object/")) return json({ Key: p, Id: "mock" });
    let body = {};
    try { body = req.postDataJSON() ?? {}; } catch { body = {}; }
    const rpc = p.replace("/rest/v1/rpc/", "");
    const find = (id) => hides.find((h) => h.id === id) ?? hides[0];
    switch (rpc) {
      case "has_active_hide": return json(!!opts.activeHide);
      case "get_hide_statuses": return json(opts.statuses ?? { [hides[3].id]: "found", [hides[6].id]: "attempted" });
      case "get_hide_detail": {
        const h = find(body.p_hide_id);
        const found = !!opts.alreadyFound;
        return json({
          id: h.id, photo_url: h.photo_url, sticker_id: h.sticker_id, sticker_color: h.sticker_color,
          creator_name: h.creator_name, is_creator: !!opts.isCreator, expires_at: h.expires_at,
          attempts_today: 3 - state.attempts, attempts_left: state.attempts, already_found: found,
          reveal: found || opts.isCreator ? { pos_x: h._m.x, pos_y: h._m.y, size_pct: h._m.size, rotation: h._m.rot } : null,
        });
      }
      case "try_attempt": {
        const h = find(body.p_hide_id);
        const d = Math.hypot(body.p_tap_x - h._m.x, body.p_tap_y - h._m.y);
        const success = d < h._m.size * 0.9;
        state.attempts = Math.max(0, state.attempts - 1);
        return json({ success, distance: d, attempts_left: state.attempts,
          reveal: success || state.attempts === 0 ? { pos_x: h._m.x, pos_y: h._m.y, size_pct: h._m.size, rotation: h._m.rot } : null });
      }
      case "get_leaderboard": return json(opts.emptyBoard ? [] : leaderboard.filter((r) => opts.meInTop !== false || !r.is_me));
      case "get_my_rank": return json({ rank: 23, score: 340 });
      case "get_my_active_hide": {
        if (!opts.activeHide) return json(null);
        const h = hides[opts.activeHideIndex ?? 0];
        return json({ id: h.id, thumbnail_url: h.photo_url, sticker_id: h.sticker_id, sticker_color: h.sticker_color,
          visibility: opts.activeHide === "private" ? "private" : "public", code: opts.activeHide === "private" ? "482913" : null,
          expires_at: h.expires_at, total_attempts: 37, finds: 4 });
      }
      case "create_hide": return json({ id: hides[0].id, code: opts.privateCode ?? null });
      default: return json(null);
    }
  });
  await page.route("**/api/resolve-code", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: hides[1].id }) }));
}
module.exports = { setup, hides, meta };
