// Squelette de chargement de l'écran de jeu (/play/[hideId] et
// /play/private/[token]), à la place du « Loading… » en texte brut.
// Reprend la structure réelle de HideGame (barre du haut, cadre photo, zone
// de contrôles) pour que rien ne saute quand les données arrivent. Le cadre
// photo est identique à celui de ZoomPanViewer (même ratio 1:1 par défaut,
// même maxHeight, même état de chargement) : la transition squelette → photo
// se fait sans clignotement.
export default function GameSkeleton({ label = "Loading hide" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className="zh-page !px-0 md:!px-8 lg:!px-10 flex flex-col gap-4 pt-5 md:pt-8 lg:gap-6"
    >
      <div className="px-4 md:px-0 flex items-center justify-between lg:hidden">
        <div className="w-11 h-11 rounded-full zh-skeleton" />
        <div className="h-11 w-44 rounded-full zh-skeleton" />
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-full zh-skeleton" />
          <div className="h-2.5 w-12 rounded zh-skeleton" />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-8 lg:items-start">
        <div className="px-4 md:px-0">
          <div
            style={{ aspectRatio: 1, maxHeight: "var(--zh-photo-max)" }}
            className="relative w-full overflow-hidden bg-neutral-900 rounded-[2rem] ring-[5px] ring-white"
          >
            <div className="absolute inset-0 grid place-items-center zh-skeleton">
              <span className="text-3xl opacity-30">🔎</span>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-0 pb-6 flex flex-col gap-4">
          <div className="hidden lg:flex flex-col gap-4">
            <div className="h-9 w-40 rounded-full zh-skeleton" />
            <div className="h-28 w-full rounded-[1.75rem] zh-skeleton" />
          </div>
          <div className="zh-card p-4 flex flex-col gap-3">
            <div className="h-2.5 w-full rounded-full zh-skeleton" />
            <div className="h-3 w-48 mx-auto rounded zh-skeleton" />
            <div className="h-14 w-full rounded-full zh-skeleton" />
          </div>
        </div>
      </div>
    </div>
  );
}
