import { cookies } from "next/headers";

// Bridge to the agent service. The browser never calls it directly, and the
// session token is attached here, never from the page side.
import { UPSTREAM } from "@/app/upstream";

async function forward(req: Request, path: string[], method: "GET" | "POST") {
  const jar = await cookies();
  const token = jar.get("learis_session")?.value;
  const headers: Record<string, string> = { "content-type": "application/json" };
  const accept = req.headers.get("accept");
  if (accept) headers.accept = accept;
  // The browser's session cookie, or, for an MCP client outside the browser,
  // the bearer token it was given on the Agent team page.
  const bearer = req.headers.get("authorization");
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (bearer?.startsWith("Bearer ")) headers.Authorization = bearer;
  // The student's own AI settings ride along for this one request. They are
  // kept in the browser, passed through, and never stored or logged here.
  const aiSettings = req.headers.get("x-learis-ai");
  if (aiSettings) headers["x-learis-ai"] = aiSettings;
  // The workspace the user is looking at; the service checks membership.
  const ws = jar.get("learis_ws")?.value;
  if (ws) headers["x-learis-ws"] = ws;
  // The query string is part of the request: a GET's inputs travel there.
  const { search } = new URL(req.url);

  try {
    const r = await fetch(`${UPSTREAM}/${path.join("/")}${search}`, {
      method,
      headers,
      body: method === "POST" ? await req.text() : undefined,
      cache: "no-store",
    });

    const contentType = r.headers.get("content-type") || "application/json";
    if (contentType.includes("text/event-stream") && r.body) {
      return new Response(r.body, {
        status: r.status,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          "x-accel-buffering": "no",
          connection: "keep-alive",
        },
      });
    }

    // Bytes, not text, so a file answer is never corrupted by decoding.
    const disposition = r.headers.get("content-disposition");
    return new Response(await r.arrayBuffer(), {
      status: r.status,
      headers: {
        "content-type": contentType,
        ...(disposition ? { "content-disposition": disposition, "cache-control": "no-store" } : {}),
      },
    });
  } catch {
    return Response.json(
      { error: `the agent service is not responding at ${UPSTREAM}. Run: cd learis/agent && python3 api.py` },
      { status: 503 },
    );
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path, "GET");
}
export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await params).path, "POST");
}
