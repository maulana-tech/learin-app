import { cookies } from "next/headers";

/* The student's session token, for pasting into their own MCP client (Claude
 * Code, Orca, and so on) so it can call LEARIS as them. Only the signed-in
 * student can read their own, and only by asking for it on purpose; it
 * expires with the session. */
export async function GET() {
  const token = (await cookies()).get("learis_session")?.value;
  if (!token) return Response.json({ error: "sign in first" }, { status: 401 });
  return Response.json({ token }, { headers: { "cache-control": "no-store" } });
}
