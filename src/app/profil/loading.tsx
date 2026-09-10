import { FullscreenLoader } from "@/components/fullscreen-loader";

// Gilt fuer /profil und alle Unterseiten (gespann, routen, bewertungen,
// daten, favoriten, einstellungen) -- ProfilLayout selbst laedt keine
// eigenen Daten, daher kein eigenes loading.tsx pro Unterseite noetig.
export default function Loading() {
  return <FullscreenLoader text="Profil wird geladen…" />;
}
