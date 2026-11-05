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

const FEATURES = ["📸 Real photos", "🔎 Pinch & zoom", "🏆 Weekly ranks"];

export default function Home() {
  return (
    <div className="zh-page pt-6 md:pt-10 lg:pt-14 flex flex-col gap-6 md:gap-8 lg:gap-10">
      {/* Mobile uniquement : sur tablette/desktop, profil et raccourcis vivent dans l'en-tête */}
      <div className="flex items-center justify-between md:hidden">
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

      <section className="flex flex-col gap-6 md:gap-8 lg:grid lg:grid-cols-12 lg:items-center lg:gap-10">
        <header className="flex flex-col gap-3 md:gap-5 lg:col-span-5">
          <span className="hidden md:inline-flex w-fit items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold shadow-[inset_0_0_0_1.5px_var(--line)]">
            <span className="zh-dot !shadow-none" /> A hide-and-seek game for your photos
          </span>
          <h1 className="zh-display text-[3.4rem] md:text-[4.6rem] lg:text-[5.4rem]">
            Zoom in.
            <br />
            Find it.
          </h1>
          <p className="text-[15px] md:text-lg leading-relaxed text-[var(--muted)] max-w-xs md:max-w-md">
            Hide a shape in a real photo. Everyone else zooms in to find it.
          </p>
          <ul className="hidden md:flex flex-wrap gap-2 pt-1" aria-label="Highlights">
            {FEATURES.map((f) => (
              <li key={f} className="zh-chip text-[13px] !font-semibold !px-3">
                {f}
              </li>
            ))}
          </ul>
        </header>

        <div className="grid gap-5 md:grid-cols-2 lg:col-span-7">
          {MODES.map((m, i) => (
            <Link
              key={m.href}
              href={m.href}
              className={`zh-tile zh-card-interactive block h-[19rem] md:h-[21rem] lg:h-[23rem] ${i % 2 ? "rotate-[0.6deg] lg:translate-y-6" : "-rotate-[0.6deg]"}`}
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
                className="zh-float absolute -bottom-10 -right-6 lg:w-[165px] lg:h-[165px] lg:-right-7"
              />
              <span className="zh-btn zh-btn-primary absolute bottom-5 left-5 z-10 px-6 py-3.5">
                {m.cta} <ArrowIcon size={18} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12 lg:gap-5 lg:mt-6">
        <Link
          href="/leaderboard"
          className="zh-tile zh-card-interactive flex items-center gap-4 bg-ink text-white p-5 lg:col-span-4 lg:flex-col lg:items-start lg:justify-between lg:p-7"
        >
          <Mascot shape="bean" mood="happy" color="var(--yellow)" size={64} className="lg:w-24 lg:h-24" />
          <div className="flex-1 lg:flex-none">
            <p className="zh-display text-2xl lg:text-3xl">See the ranking</p>
            <p className="text-sm text-white/60">Top hiders & seekers this week</p>
          </div>
          <span className="grid place-items-center w-10 h-10 rounded-full bg-teal lg:absolute lg:top-7 lg:right-7 lg:w-12 lg:h-12">
            <ArrowIcon size={18} />
          </span>
        </Link>

        <section className="zh-card p-5 md:p-7 lg:col-span-8">
          <h2 className="zh-display text-2xl md:text-3xl mb-4 md:mb-6">How it works</h2>
          <ol className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-6 text-sm leading-relaxed">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3 items-start md:flex-col">
                <span
                  aria-hidden="true"
                  className={`grid place-items-center shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-full ${s.bg} zh-display text-lg md:text-xl`}
                >
                  {s.n}
                </span>
                <p className="text-[var(--muted)] pt-1.5 md:pt-0">
                  <b className="text-ink md:block md:text-base md:mb-1">{s.t}.</b> {s.d}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
