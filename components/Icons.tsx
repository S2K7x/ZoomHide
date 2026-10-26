// Icônes trait (24×24, stroke = currentColor) — remplacent les emojis dans
// la navigation et les boutons ronds, pour un rendu net et cohérent.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 22, children, ...rest }: P) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
  </Base>
);

export const SearchIcon = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Base>
);

export const CameraIcon = (p: P) => (
  <Base {...p}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </Base>
);

export const TrophyIcon = (p: P) => (
  <Base {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
    <path d="M12 13v4M8.5 20h7M10 17h4" />
  </Base>
);

export const LockIcon = (p: P) => (
  <Base {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Base>
);

export const RefreshIcon = (p: P) => (
  <Base {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4.5v4h-4" />
  </Base>
);

export const BackIcon = (p: P) => (
  <Base {...p}>
    <path d="M15 5 8 12l7 7" />
  </Base>
);

export const ArrowIcon = (p: P) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const ShareIcon = (p: P) => (
  <Base {...p}>
    <path d="M12 4v11M7.5 8.5 12 4l4.5 4.5" />
    <path d="M5 13.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4.5" />
  </Base>
);

export const FlagIcon = (p: P) => (
  <Base {...p}>
    <path d="M6 20V4.5M6 5h10l-2 3.5 2 3.5H6" />
  </Base>
);

export const ClockIcon = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="13" r="7" />
    <path d="M12 9.5V13l2 1.5M10 3h4" />
  </Base>
);

export const PlayIcon = (p: P) => (
  <Base {...p}>
    <path d="M7 5.5v13l11-6.5z" fill="currentColor" />
  </Base>
);
