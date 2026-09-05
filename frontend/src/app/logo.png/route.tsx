import { ImageResponse } from "next/og";

// A raster copy of app/icon.svg, served at /logo.png.
//
// This exists purely for Organization schema: Google's structured data
// guidelines require the `logo` property to be a raster format, so the SVG in
// app/icon.svg cannot be referenced there. Generating it from the same
// gradient and geometry keeps the two from drifting apart.
export const runtime = "edge";

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
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          // icon.svg uses rx=14 on a 64px square; the same 21.9% ratio at 512.
          borderRadius: "112px",
        }}
      >
        {/* Satori has only partial SVG support, so the mark is drawn with
            positioned divs: two diverging lanes and a dashed centre line. */}
        <div
          style={{
            position: "relative",
            width: "320px",
            height: "300px",
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "34px",
              top: "0px",
              width: "38px",
              height: "300px",
              background: "white",
              borderRadius: "19px",
              transform: "rotate(11deg)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "34px",
              top: "0px",
              width: "38px",
              height: "300px",
              background: "white",
              borderRadius: "19px",
              transform: "rotate(-11deg)",
            }}
          />
          {[0, 108, 216].map((top) => (
            <div
              key={top}
              style={{
                position: "absolute",
                left: "141px",
                top: `${top + 14}px`,
                width: "38px",
                height: "58px",
                background: "white",
                borderRadius: "19px",
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
