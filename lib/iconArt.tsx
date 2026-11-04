// Dessin des icônes PWA (192 / 512) : même logo que components/Logo.tsx —
// pastille jaune, loupe à l'encre, étoile rose cachée dans le verre.
export function iconArt(size: number) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffd23f",
      }}
    >
      <svg width={size * 0.78} height={size * 0.78} viewBox="6 6 36 36">
        <circle cx="21" cy="21" r="10.5" fill="#fff" stroke="#161616" strokeWidth="4.5" />
        <path d="M29 29 L37 37" stroke="#161616" strokeWidth="5.5" strokeLinecap="round" />
        <path
          d="M21 15.2 L22.6 19.4 L27 19.6 L23.6 22.4 L24.8 26.6 L21 24.2 L17.2 26.6 L18.4 22.4 L15 19.6 L19.4 19.4 Z"
          fill="#ff5f9e"
        />
      </svg>
    </div>
  );
}
