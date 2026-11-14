import { NextResponse, type NextRequest } from "next/server";

/* The root is two pages: the app for someone signed in, the landing page for everyone else.
 * Without a session cookie, "/" shows /welcome while the address bar keeps "/". An expired
 * session still has a cookie: the app layout sends that person to /welcome itself. */
export function proxy(request: NextRequest) {
  if (!request.cookies.get("learis_session")?.value) {
    return NextResponse.rewrite(new URL("/welcome", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
