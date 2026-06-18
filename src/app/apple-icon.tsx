import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgb(244,239,232)",
          color: "rgb(82,116,79)",
          fontSize: 220,
          fontWeight: 700,
          border: "24px solid rgb(82,116,79)",
          borderRadius: 96,
          letterSpacing: "0.12em",
        }}
      >
        M
      </div>
    ),
    size,
  );
}
