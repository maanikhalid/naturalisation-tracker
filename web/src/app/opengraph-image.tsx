import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt =
  "UK Naturalisation Tracker — community Form AN processing timelines";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "#1d70b8",
          color: "#ffffff",
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: 1.1,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div style={{ marginBottom: 16 }}>UK Naturalisation Tracker</div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 400,
            opacity: 0.95,
            maxWidth: 900,
          }}
        >
          Community-reported Form AN timelines — not an official Home Office
          service.
        </div>
      </div>
    ),
    { ...size }
  );
}
