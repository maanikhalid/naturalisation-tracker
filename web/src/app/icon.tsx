import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = { width: 512, height: 512 };

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d70b8",
          color: "#ffffff",
          fontSize: 280,
          fontWeight: 700,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        AN
      </div>
    ),
    { ...size }
  );
}
