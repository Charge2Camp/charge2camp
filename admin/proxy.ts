import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Anders als die Haupt-App (dort sind nur einzelne Praefixe login-
// pflichtig) ist in der Admin-App praktisch ALLES admin-pflichtig -- daher
// eine Allow-Liste oeffentlicher Pfade statt einer Block-Liste. Das
// is_admin-Flag selbst wird hier bewusst NICHT geprueft (kein DB-
// Roundtrip bei jedem Request auf der Edge-Runtime) -- das bleibt
// Aufgabe von requireAdmin() im (dashboard)-Layout (Redirect zu
// /kein-zugriff). Dieser Proxy ist Defense-in-Depth ZUSAETZLICH zu
// requireAdmin() in jeder geschuetzten Seite/Server Action, nicht deren
// Ersatz -- Next.js' eigene Doku warnt, dass ein spaeterer Matcher-/
// Routing-Umbau den Proxy-Schutz stillschweigend aushebeln kann.
const PUBLIC_PATHS = ["/login", "/kein-zugriff"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (!isPublic && !user) {
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
