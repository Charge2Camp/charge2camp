---
name: mobile-check
description: Mobile-Smoke-Test der Charge2Camp-Kernseiten bei 375px im Browser-Pane (Konsole, Tap-Ziele, Eingabegroesse, Safe-Area, Horizontal-Scroll) gegen CLAUDE.md Prinzip 8
disable-model-invocation: true
argument-hint: [pfad ...]
---

# Mobile-Check (Prinzip 8: mobile-first, Touch, App-Store-tauglich)

Prueft laufende Seiten, ersetzt keinen Test auf echten iOS-/Android-Geraeten (siehe
`project_ecamper_ios_homescreen_gap`: ein 11px-Gap im iOS-WKWebView ist bekannt und akzeptiert).
Argumente = Pfade (z. B. `/routenplaner`); ohne Argument die Standardliste unten.

## 1. Vorbereiten
1. `preview_start` mit `{name: "Charge2Camp dev server"}` (nie Bash fuer den Dev-Server).
2. `resize_window` mit `preset: "mobile"` (375x812). Am Ende **immer** `preset: "desktop"` zuruecksetzen.
3. Nach dem Resize die Seite neu laden (Mobile-UA-Gates laufen beim Laden).

## 2. Seiten
- **Oeffentlich:** `/`, `/login`, `/register`, `/legende`, `/datenschutz`, `/impressum`
- **Login-pflichtig** (`src/proxy.ts`: `/ladepunkte`, `/campingplaetze`, `/community`, `/routenplaner`, `/profil`):
  nur pruefen, wenn der User im Browser-Pane bereits eingeloggt ist. Landet die Seite auf `/login?redirect=...`,
  als "uebersprungen (nicht eingeloggt)" melden. **Keine Zugangsdaten eingeben oder erfinden** - den User bitten,
  sich selbst im Pane anzumelden, und dann erneut starten.

## 3. Pro Seite pruefen (per `javascript_tool`, nur lesend; Layout nie per JS "reparieren")
```js
(() => {
  const vw = document.documentElement.clientWidth;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  const small = [...document.querySelectorAll('a[href],button,[role="button"],input:not([type=hidden]),select,textarea,summary,[role="tab"]')]
    .filter(visible).map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width < 44 || r.height < 44)
    .map(({ el, r }) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.name || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  const smallInputs = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea")]
    .filter(visible).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
    .map((el) => `${el.tagName.toLowerCase()}[name=${el.name}] ${getComputedStyle(el).fontSize}`);
  const overflowX = document.documentElement.scrollWidth - vw;
  return { vw, overflowX, smallTapTargets: small.slice(0, 25), smallTapTargetCount: small.length, smallInputs };
})()
```
- `overflowX > 0` = horizontaler Scroll (Fehler).
- Tap-Ziele < 44px: Inline-Textlinks in Fliesstext sind ok, alleinstehende Buttons/Icons nicht.
- Eingaben mit `font-size < 16px` loesen iOS-Auto-Zoom aus (Fehler).
- Konsole: `read_console_messages` mit `onlyErrors: true`; Netzwerk: `read_network_requests` auf 4xx/5xx.
- Safe-Area: Header/Bottom-Tab-Bar/Vollbild-Dialoge im Quelltext auf `env(safe-area-inset-*)` pruefen
  (`grep -rn "safe-area" src/components src/app`), nicht im Desktop-Pane messbar.
- Hover-Abhaengigkeit: kritische Aktionen, die nur ueber `hover:`/`title` erreichbar sind (Grep im betroffenen Code).
- 1 Screenshot pro Seite (`computer` `screenshot`, `scale: 0.5`) als Nachweis.

## 4. Bericht
Tabelle: Seite | Overflow | kleine Tap-Ziele | kleine Inputs | Konsolenfehler | Ergebnis.
Danach Befunde mit Selektor/Komponente und konkretem Fix (Token/Klasse, z. B. `min-h-11`, `text-base`).
Ausdruecklich nennen, was **nicht** geprueft wurde (nicht eingeloggt, Safe-Area nur per Code, kein echtes Geraet).
Befunde nur melden, nicht ungefragt beheben.
