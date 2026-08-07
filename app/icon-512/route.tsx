import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const contentType = "image/png";

const SIZE = 512;

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #ffe07a 0%, #f6b81e 100%)",
          borderRadius: 112,
        }}
      >
        <div style={{ display: "flex", position: "relative", width: 260, height: 260 }}>
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              width: 190,
              height: 190,
              borderRadius: "50%",
              border: "26px solid #241800",
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: 6,
              right: 6,
              width: 96,
              height: 30,
              borderRadius: 15,
              background: "#241800",
              transform: "rotate(45deg)",
              transformOrigin: "right center",
            }}
          />
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE }
  );
}
