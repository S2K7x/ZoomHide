// Logo « loupe » : pastille jaune, loupe à l'encre, petite étoile rose cachée
// dans le verre. Même dessin que les icônes PWA (app/icon-*), en SVG inline.
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" className={className}>
      <rect width="48" height="48" rx="14" fill="#ffd23f" />
      <circle cx="21" cy="21" r="10.5" fill="#fff" stroke="#161616" strokeWidth="4.5" />
      <path d="M29 29 L37 37" stroke="#161616" strokeWidth="5.5" strokeLinecap="round" />
      <path
        d="M21 15.2 L22.6 19.4 L27 19.6 L23.6 22.4 L24.8 26.6 L21 24.2 L17.2 26.6 L18.4 22.4 L15 19.6 L19.4 19.4 Z"
        fill="#ff5f9e"
      />
    </svg>
  );
}

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={38} />
      <span className="zh-display text-[1.45rem] leading-none">Zoom Hide</span>
    </span>
  );
}
