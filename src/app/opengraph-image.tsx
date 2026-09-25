import { ImageResponse } from "next/og";

export const alt = "Okwan: the officer has already read your file. US visa interview practice for Ghanaians.";
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
          padding: 64,
          background: "#f3f0e8",
          color: "#14140f",
          border: "10px solid #14140f",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, letterSpacing: 3 }}>
          <span>OKWAN</span>
          <span style={{ border: "3px solid #0b7447", color: "#0b7447", padding: "4px 14px", transform: "rotate(-4deg)" }}>
            PRACTICE INTERVIEW
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 800, lineHeight: 0.95, letterSpacing: -2 }}>
          <span>THE OFFICER HAS</span>
          <span>ALREADY READ YOUR FILE.</span>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#5b584f" }}>
          US visa interview practice for Ghanaians · F-1 and B1/B2 · A different officer every time
        </div>
      </div>
    ),
    size,
  );
}
