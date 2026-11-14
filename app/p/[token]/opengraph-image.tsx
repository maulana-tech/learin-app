import { ImageResponse } from "next/og";

import { publicLink, type PublicPage } from "@/app/lib";

/* The card a chat app shows when the link is pasted: the title, the proof, the name. */

export const alt = "A page shared from LEARIS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const p = await publicLink<PublicPage>("page", (await params).token, false);
  const title = p?.title ?? "This link was turned off";
  const quote = p?.sources[0]?.quote;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "#111", color: "#fff", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 30, letterSpacing: -0.5, opacity: 0.85 }}>learis</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: title.length > 60 ? 52 : 64, lineHeight: 1.1, fontWeight: 600, letterSpacing: -1.5 }}>
            {title.slice(0, 110)}
          </div>
          {quote && (
            <div style={{ display: "flex", marginTop: 28, fontSize: 26, lineHeight: 1.35, color: "rgba(255,255,255,0.7)",
              borderLeft: "4px solid #34d399", paddingLeft: 20 }}>
              “{quote.slice(0, 140)}{quote.length > 140 ? "…" : ""}”
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "rgba(255,255,255,0.65)" }}>
          <div style={{ display: "flex" }}>{p ? `${p.checks.sources} source quote(s) · every claim checked` : ""}</div>
          <div style={{ display: "flex" }}>{p ? `Shared by ${p.shared_by}` : ""}</div>
        </div>
      </div>
    ),
    size,
  );
}
