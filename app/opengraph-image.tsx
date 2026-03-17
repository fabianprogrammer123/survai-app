import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Compute & Cocktails — GTC Reception"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "60px 72px",
          background: "linear-gradient(145deg, #12100e 0%, #06060a 50%, #0a0a0f 100%)",
          fontFamily: "serif",
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: "absolute",
            top: "-20%",
            left: "30%",
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(201,168,124,0.08) 0%, transparent 60%)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 500,
              color: "#eeebe5",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginBottom: 24,
            }}
          >
            Compute &
            <br />
            Cocktails
          </div>

          <div
            style={{
              fontSize: 24,
              color: "#9c9ca4",
              marginBottom: 12,
            }}
          >
            GTC Reception · March 17 · Palo Alto
          </div>

          <div
            style={{
              fontSize: 20,
              color: "#c9a87c",
              marginTop: 8,
            }}
          >
            Know who&apos;s coming. Connect before you arrive.
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
