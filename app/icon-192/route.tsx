import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const contentType = "image/png";

const SIZE = 192;

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
          borderRadius: 42,
        }}
      >
        <div style={{ display: "flex", position: "relative", width: 98, height: 98 }}>
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 0,
              left: 0,
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: "10px solid #241800",
            }}
          />
          <div
            style={{
              display: "flex",
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 36,
              height: 11,
              borderRadius: 6,
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
