import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PLATFORM_PCT } from "@/lib/domain/logic";
import { visualRtl as r } from "@/lib/domain/bidi";

export const alt = "BOOST — קוד קופון אחד, כולם מרוויחים";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * What a shared link looks like in WhatsApp, on Instagram, anywhere.
 *
 * A platform whose whole mechanism is people sharing links had no preview
 * image at all, so every share rendered as a bare grey rectangle. This is the
 * first impression for most people who will ever hear about us.
 *
 * The font is vendored rather than fetched from Google at render time: a
 * preview that silently loses its Hebrew whenever a CDN is slow is worse than
 * no preview, and this file is the one place that cannot be checked by eye
 * after the fact.
 */
export default async function Image() {
  const rubik = await readFile(join(process.cwd(), "assets", "Rubik-Bold.ttf"));

  // The same ₪300 sale the site explains everywhere else, so the picture and
  // the product tell one story.
  const rows = [
    { label: r("הקונה חוסך"), value: r("30 ₪") },
    { label: r("המשפיען מרוויח"), value: r("21 ₪"), accent: true },
    { label: r("הפלטפורמה"), value: r("9 ₪") },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row-reverse",
          backgroundColor: "#E9DCC1",
          color: "#221D15",
          fontFamily: "Rubik",
          padding: 64,
          gap: 56,
        }}
      >
        {/* The claim */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                backgroundColor: "#F4490B",
                color: "#221D15",
                fontSize: 30,
                fontWeight: 700,
                padding: "6px 18px",
                borderRadius: 10,
                transform: "rotate(-4deg)",
              }}
            >
              BOOST
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 74, lineHeight: 1.05, letterSpacing: -1 }}>
            {r("קוד קופון אחד,")}
          </div>
          <div style={{ display: "flex", fontSize: 74, lineHeight: 1.05, letterSpacing: -1 }}>
            <span style={{ backgroundColor: "#FFC93C", padding: "0 10px" }}>{r("כולם מרוויחים")}</span>
          </div>

          <div style={{ display: "flex", fontSize: 30, marginTop: 30, color: "#5D5040", lineHeight: 1.4 }}>
            {r("העסק משלם רק על מכירות שקרו.")}
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#5D5040", lineHeight: 1.4 }}>
            {r("המשפיען מקבל עמלה. הקונה מקבל הנחה.")}
          </div>
        </div>

        {/* The label: the same split the whole site is built on */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 400,
            backgroundColor: "#FFFEF8",
            border: "3px solid #221D15",
            borderRadius: 16,
            padding: 30,
            transform: "rotate(2deg)",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 22, color: "#5D5040" }}>{r("מכירה של")}</div>
          <div style={{ display: "flex", fontSize: 58, marginTop: 2 }}>{r("300 ₪")}</div>
          <div
            style={{
              display: "flex",
              height: 3,
              backgroundColor: "#221D15",
              opacity: 0.15,
              margin: "22px 0",
            }}
          />
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 14,
                fontSize: 26,
                color: r.accent ? "#BD3605" : "#221D15",
              }}
            >
              <span style={{ display: "flex" }}>{r.label}</span>
              <span style={{ display: "flex", fontSize: 30 }}>{r.value}</span>
            </div>
          ))}
          <div style={{ display: "flex", fontSize: 19, color: "#5D5040", marginTop: 8 }}>
            {r(`דמי הפלטפורמה קבועים על ${PLATFORM_PCT}%`)}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Rubik", data: rubik, style: "normal", weight: 700 }],
    },
  );
}
