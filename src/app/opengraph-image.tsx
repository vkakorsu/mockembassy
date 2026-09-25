import { ImageResponse } from "next/og";

export const alt = "Okwan: rehearse your US visa interview until it's yours";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(70% 70% at 80% 20%, rgba(224,165,38,0.35), transparent 60%), #0c1320",
          color: "#f5efe3",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, border: "4px solid #f5efe3", display: "flex" }} />
          Okwan
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.02, letterSpacing: -2 }}>
          <span>Two and a half minutes.</span>
          <span style={{ color: "#e0a526" }}>Rehearse them until they&apos;re yours.</span>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "rgba(245,239,227,0.65)" }}>
          US visa interview practice for Ghanaians · F-1 and B1/B2 · Pay with MoMo
        </div>
      </div>
    ),
    size,
  );
}
