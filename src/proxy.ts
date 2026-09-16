import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Login-pflichtige Bereiche (Ladepunkte-/Campingplatz-Daten, die "DNA" des
// Produkts, siehe requireUser()) -- Praefix-Match, damit z. B. auch
// /ladepunkte/[id] erfasst wird. Diese Pruefung ist Defense-in-Depth
// ZUSAETZLICH zu requireUser() in jeder betroffenen Seite selbst, nicht
// deren Ersatz -- Next.js' eigene Doku warnt, dass ein spaeterer
// Matcher-/Routing-Umbau den Proxy-Schutz stillschweigend aushebeln kann.
const PROTECTED_PREFIXES = ["/ladepunkte", "/campingplaetze", "/community", "/routenplaner"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
