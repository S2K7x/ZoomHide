import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zoom Hide",
    short_name: "Zoom Hide",
    description:
      "Hide a shape in a photo from your real life. Your friends zoom in to find it.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1024",
    theme_color: "#0a1024",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
