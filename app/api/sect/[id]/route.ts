import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params; // <-- key change
  const id = String(rawId ?? "").replace(/[^\d]/g, "");

  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const url = `https://www.projectaon.org/en/xhtml/lw/01fftd/sect${id}.htm`;

  const upstream = await fetch(url, {
    headers: { "User-Agent": "LW-POC/1.0 (+vercel)" },
    cache: "force-cache",
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Upstream fetch failed", status: upstream.status },
      { status: 502 }
    );
  }

  const html = await upstream.text();

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
