import Link from "next/link";

export default function Home() {
  return (
    <div className="px-6 pt-14 flex flex-col gap-8">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight">🔎 Zoom Hide</h1>
        <p className="mt-3 text-white/70">
          Hide a shape in a photo from your real life.
          <br />
          Everyone else zooms in to find it.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          href="/play"
          className="rounded-2xl bg-amber-400 text-black text-center font-bold text-lg py-4 active:scale-95 transition"
        >
          🔎 Find a hide
        </Link>
        <Link
          href="/create"
          className="rounded-2xl bg-violet-500 text-white text-center font-bold text-lg py-4 active:scale-95 transition"
        >
          📸 Hide a shape
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-2xl border border-white/20 text-center font-semibold py-3 text-white/80"
        >
          🏆 See the ranking
        </Link>
      </div>

      <section className="rounded-2xl bg-white/5 p-5 text-sm leading-relaxed">
        <h2 className="font-bold text-base mb-3">How it works</h2>
        <ol className="space-y-3">
          <li>
            <b>1. Hide.</b> Take a photo (your room, your street…), pick a shape
            and color that blend into the scene, and place it. One active hide at
            a time, valid for 7 days.
          </li>
          <li>
            <b>2. Find.</b> Zoom, scan, and tap where you think the shape is
            hidden. <b>3 tries a day</b> per hide.
          </li>
          <li>
            <b>3. Win.</b> Seeker points if you find it fast. Hider points if no
            one finds it. No one in 7 days = <b>Perfect Hide 💎</b>
          </li>
        </ol>
      </section>
    </div>
  );
}
