import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

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
          background:
            "linear-gradient(135deg, rgb(82,116,79) 0%, rgb(163,134,93) 100%)",
          color: "white",
          fontSize: 220,
          fontWeight: 700,
          letterSpacing: "0.12em",
        }}
      >
        M
      </div>
    ),
    size,
  );
}
