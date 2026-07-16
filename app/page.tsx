import Link from "next/link";

export default function Home() {
  return (
    <div className="px-6 pt-14 flex flex-col gap-8">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight">🔎 Zoom Hide</h1>
        <p className="mt-3 text-white/70">
          Cache un sticker dans une photo de ta vraie vie.
          <br />
          Les autres zooment pour le retrouver.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <Link
          href="/play"
          className="rounded-2xl bg-amber-400 text-black text-center font-bold text-lg py-4 active:scale-95 transition"
        >
          🔎 Chercher une cachette
        </Link>
        <Link
          href="/create"
          className="rounded-2xl bg-violet-500 text-white text-center font-bold text-lg py-4 active:scale-95 transition"
        >
          📸 Cacher un sticker
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-2xl border border-white/20 text-center font-semibold py-3 text-white/80"
        >
          🏆 Voir le classement
        </Link>
      </div>

      <section className="rounded-2xl bg-white/5 p-5 text-sm leading-relaxed">
        <h2 className="font-bold text-base mb-3">Comment ça marche ?</h2>
        <ol className="space-y-3">
          <li>
            <b>1. Cache.</b> Prends une photo (ta chambre, ta rue…), place un
            sticker là où il se fond dans le décor. Une seule cachette active à
            la fois, valable 7 jours.
          </li>
          <li>
            <b>2. Cherche.</b> Zoome, scrute, et tape là où tu penses que le
            sticker se cache. <b>3 essais par jour</b> et par cachette.
          </li>
          <li>
            <b>3. Gagne.</b> Points de chercheur si tu trouves vite. Points de
            cacheur si personne ne trouve. Personne en 7 jours ={" "}
            <b>Cachette Parfaite 💎</b>
          </li>
        </ol>
      </section>
    </div>
  );
}
