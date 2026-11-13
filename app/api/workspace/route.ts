import { cookies } from "next/headers";

import { WS_COOKIE } from "@/lib/nav";

/* Which workspace the app is showing. Kept in a cookie so server pages and the
 * proxy both send it (as X-Learis-Ws); the agent service still checks that the
 * user is a member, so a forged value shows nothing. */
export async function POST(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  const jar = await cookies();
  if (id) jar.set(WS_COOKIE, id, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  else jar.delete(WS_COOKIE);
  return Response.json({ workspace: id ?? null });
}
