import Link from "next/link";
import Mascot, { Sparkle, type MascotShape, type Mood } from "@/components/Mascot";
import PlayerChip from "@/components/PlayerChip";
import { ArrowIcon, LockIcon, TrophyIcon } from "@/components/Icons";

type Mode = {
  href: string;
  title: [string, string];
  tag: string;
  cta: string;
  bg: string;
  body: string;
  shape: MascotShape;
  mood: Mood;
};

const MODES: Mode[] = [
  {
    href: "/play",
    title: ["Find a", "Hide"],
    tag: "3 tries a day",
    cta: "Play game",
    bg: "var(--orange)",
    body: "var(--pink)",
    shape: "cat",
    mood: "wow",
  },
  {
    href: "/create",
    title: ["Hide a", "Shape"],
    tag: "Live for 7 days",
    cta: "Start hiding",
    bg: "var(--sky)",
    body: "var(--purple)",
    shape: "blob",
    mood: "smirk",
  },
];

const STEPS = [
  {
    n: "1",
    bg: "bg-yellow",
    t: "Hide",
    d: "Snap a photo, pick a shape and color that blends in, and place it.",
  },
  {
    n: "2",
    bg: "bg-pink",
    t: "Find",
    d: "Zoom, scan, and tap where the shape hides. 3 tries a day per hide.",
  },
  {
    n: "3",
    bg: "bg-lime",
    t: "Win",
    d: "Points for finding fast, or for stumping everyone. Nobody in 7 days = Perfect Hide 💎",
  },
];

export default function Home() {
  return (
    <div className="px-5 pt-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PlayerChip />
        <div className="flex gap-2">
          <Link href="/play/private" aria-label="Play a private hide with a code" className="zh-icon-btn">
            <LockIcon size={20} />
          </Link>
          <Link href="/leaderboard" aria-label="See the ranking" className="zh-icon-btn">
            <TrophyIcon size={20} />
          </Link>
        </div>
      </div>

      <header className="flex flex-col gap-3">
        <h1 className="zh-display text-[3.4rem]">
          Zoom in.
          <br />
          Find it.
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--muted)] max-w-xs">
          Hide a shape in a real photo. Everyone else zooms in to find it.
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {MODES.map((m, i) => (
          <Link
            key={m.href}
            href={m.href}
            className={`zh-tile zh-card-interactive block h-[19rem] ${i % 2 ? "rotate-[0.6deg]" : "-rotate-[0.6deg]"}`}
            style={{ background: m.bg }}
          >
            <Sparkle size={20} className="zh-twinkle absolute top-5 left-5 text-white" />
            <Sparkle size={14} className="zh-twinkle absolute top-24 right-6 text-white [animation-delay:1.2s]" />
            <div className="absolute top-6 inset-x-0 flex flex-col items-center gap-2.5">
              <span className="zh-bubble zh-display text-[2.3rem] text-center px-6 pt-2 pb-2.5">
                {m.title[0]}
                <br />
                {m.title[1]}
              </span>
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="zh-dot" /> {m.tag}
              </span>
            </div>
            <Mascot
              shape={m.shape}
              mood={m.mood}
              color={m.body}
              size={190}
              className="zh-float absolute -bottom-10 -right-6"
            />
            <span className="zh-btn zh-btn-primary absolute bottom-5 left-5 px-6 py-3.5">
              {m.cta} <ArrowIcon size={18} />
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/leaderboard"
        className="zh-tile zh-card-interactive flex items-center gap-4 bg-ink text-white p-5"
      >
        <Mascot shape="bean" mood="happy" color="var(--yellow)" size={64} />
        <div className="flex-1">
          <p className="zh-display text-2xl">See the ranking</p>
          <p className="text-sm text-white/60">Top hiders & seekers this week</p>
        </div>
        <span className="grid place-items-center w-10 h-10 rounded-full bg-teal">
          <ArrowIcon size={18} />
        </span>
      </Link>

      <section className="zh-card p-5">
        <h2 className="zh-display text-2xl mb-4">How it works</h2>
        <ol className="flex flex-col gap-3 text-sm leading-relaxed">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3 items-start">
              <span
                aria-hidden="true"
                className={`grid place-items-center shrink-0 w-9 h-9 rounded-full ${s.bg} zh-display text-lg`}
              >
                {s.n}
              </span>
              <p className="text-[var(--muted)] pt-1.5">
                <b className="text-ink">{s.t}.</b> {s.d}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
