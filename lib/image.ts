// Compression 100% client via <canvas> : photo max 1080px de large (JPEG q0.78)
// + thumbnail 300px pour le feed. Aucune lib externe, aucune métadonnée EXIF
// conservée (le re-encodage canvas supprime tout, y compris la géolocalisation).

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = url;
    });
    return img;
  } finally {
    // l'objet URL est révoqué par l'appelant une fois le canvas dessiné
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compression échouée"))),
      "image/jpeg",
      quality
    );
  });
}

function resize(img: HTMLImageElement, maxWidth: number): HTMLCanvasElement {
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function compressImage(file: File): Promise<{
  photo: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
}> {
  const img = await loadImage(file);
  const main = resize(img, 1080);
  const thumb = resize(img, 300);
  URL.revokeObjectURL(img.src);
  const [photo, thumbnail] = await Promise.all([
    toBlob(main, 0.78),
    toBlob(thumb, 0.7),
  ]);
  return { photo, thumbnail, width: main.width, height: main.height };
}

function loadSrc(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image illisible"));
    img.src = src;
  });
}

// Incruste le sticker DANS la photo (canvas) pour qu'il soit visible par le
// chercheur — le défi devient de le camoufler via forme/couleur, pas de le
// rendre introuvable. La position reste dans les pixels : elle n'est jamais
// envoyée en clair au client, donc le calcul du succès reste côté serveur.
export async function compositeSticker(
  photo: Blob,
  stickerUrl: string,
  opts: { posX: number; posY: number; sizePct: number; rotation: number },
  quality = 0.82
): Promise<Blob> {
  const url = URL.createObjectURL(photo);
  const [base, sticker] = await Promise.all([loadSrc(url), loadSrc(stickerUrl)]);
  URL.revokeObjectURL(url);

  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(base, 0, 0);

  const w = (opts.sizePct / 100) * canvas.width; // sticker carré, % de la largeur
  const x = (opts.posX / 100) * canvas.width;
  const y = (opts.posY / 100) * canvas.height;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((opts.rotation * Math.PI) / 180);
  ctx.drawImage(sticker, -w / 2, -w / 2, w, w);
  ctx.restore();

  return toBlob(canvas, quality);
}
