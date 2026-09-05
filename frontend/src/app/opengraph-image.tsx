import { ImageResponse } from "next/og";

// Generated at build time rather than shipped as a binary asset, so the card
// never drifts from the brand palette in globals.css. Next serves this at
// /opengraph-image and wires the <meta> tags up automatically — the twitter
// card picks it up too, since summary_large_image falls back to the OG image.
export const runtime = "edge";
export const alt = "MockLane — webhook testing, mock APIs and email sandboxes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0f172a",
          backgroundImage:
            "radial-gradient(circle at 20% 0%, #312e81 0%, transparent 55%), radial-gradient(circle at 90% 100%, #4c1d95 0%, transparent 45%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 700, color: "#e2e8f0" }}>
            MockLane
          </div>
        </div>

        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            color: "white",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: "900px",
          }}
        >
          Webhooks, mock APIs, and email — in one place
        </div>

        <div
          style={{
            marginTop: "32px",
            fontSize: 32,
            color: "#94a3b8",
            maxWidth: "880px",
            lineHeight: 1.4,
          }}
        >
          Capture what providers actually send you, stand up the API that
          doesn&apos;t exist yet, and catch every test email.
        </div>
      </div>
    ),
    size,
  );
}
