import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: { baseUrl?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const baseUrl = (body.baseUrl || "").replace(/\/+$/, "");
  const apiKey = body.apiKey || "";

  if (!baseUrl) {
    return NextResponse.json({ error: "No base URL provided." }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "No API key provided." }, { status: 400 });
  }

  const modelsUrl = `${baseUrl}/models`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 401 ? "Invalid API key for this provider." : `Provider returned HTTP ${res.status}.` },
        { status: res.status },
      );
    }

    const data = (await res.json()) as
      | { models?: Array<{ id?: string; name?: string } | string>; data?: Array<{ id?: string; name?: string } | string> }
      | Array<{ id?: string; name?: string } | string>;

    const listRaw = Array.isArray(data) ? data : (data.models ?? data.data ?? []);
    const ids = listRaw
      .map((m) => (typeof m === "string" ? m : m?.id ?? m?.name))
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const unique = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      models: unique,
      empty: unique.length === 0,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      return NextResponse.json({ error: "Request timed out. You can enter a model name manually." }, { status: 408 });
    }
    const msg = err instanceof Error ? err.message : "Network error fetching models.";
    return NextResponse.json({ error: `${msg} You can enter a model name manually.` }, { status: 502 });
  }
}
