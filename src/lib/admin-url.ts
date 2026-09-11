// Eigenstaendige Admin-Backend-App (admin/, siehe README dort) -- separat
// deployt, eigene Domain. Kein Geheimnis (nur die Login-Seite, der Zugriff
// selbst wird server-seitig per requireAdmin()/profiles.is_admin im
// Backend erzwungen), deshalb per NEXT_PUBLIC_ Fallback statt Pflicht-
// Secret.
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "https://admin-eight-nu-41.vercel.app";

export const ADMIN_LOGIN_URL = `${ADMIN_URL}/login`;
