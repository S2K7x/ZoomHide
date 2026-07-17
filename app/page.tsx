import Link from "next/link";

export default function Home() {
  return (
    <div className="px-5 pt-12 flex flex-col gap-7">
      <header className="text-center flex flex-col items-center gap-3">
        <div className="grid place-items-center w-20 h-20 rounded-[1.7rem] bg-gradient-to-b from-amber-300 to-amber-500 text-4xl shadow-[0_16px_40px_-12px_rgba(246,184,30,0.6)]">
          🔎
        </div>
        <h1 className="text-4xl font-black tracking-tight zh-title">Zoom Hide</h1>
        <p className="text-white/65 text-[15px] leading-relaxed max-w-xs">
          Hide a shape in a real photo. Everyone else zooms in to find it.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Link href="/play" className="zh-btn zh-btn-primary text-center text-lg py-4">
          🔎 Find a hide
        </Link>
        <Link href="/create" className="zh-btn zh-btn-violet text-center text-lg py-4">
          📸 Hide a shape
        </Link>
        <Link href="/leaderboard" className="zh-btn zh-btn-ghost text-center py-3.5">
          🏆 See the ranking
        </Link>
      </div>

      <section className="zh-card p-5">
        <h2 className="font-black text-base mb-4">How it works</h2>
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          {[
            { n: "1", c: "from-amber-300 to-amber-500", t: "Hide", d: "Snap a photo, pick a shape and color that blends in, and place it. One active hide, 7 days." },
            { n: "2", c: "from-sky-400 to-blue-600", t: "Find", d: "Zoom, scan, and tap where the shape hides. 3 tries a day per hide." },
            { n: "3", c: "from-violet-400 to-violet-600", t: "Win", d: "Points for finding fast, or for stumping everyone. No one in 7 days = Perfect Hide 💎" },
          ].map((s) => (
            <div key={s.n} className="flex gap-3">
              <span className={`grid place-items-center shrink-0 w-8 h-8 rounded-xl bg-gradient-to-b ${s.c} text-black font-black`}>
                {s.n}
              </span>
              <p className="text-white/75">
                <b className="text-white">{s.t}.</b> {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
