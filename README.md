# biff-mail-steuerung

Mobile Steuerseite für den (privaten) biff-mail-agent:
**https://flohman-ai.github.io/biff-mail-steuerung/**

Die Seite ist öffentlich erreichbar, **enthält aber keine Daten**. Erst nach der Anmeldung
mit deinem eigenen GitHub-Token holt sie Daten live über die GitHub-API aus dem privaten
Repo `biff-mail-agent`. Ohne Token sieht niemand etwas.

## Token erstellen (einmalig)

1. GitHub öffnen → Profilbild → **Settings** → ganz unten **Developer settings**.
2. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. **Token name:** z. B. `biff-mail-steuerung Handy`.
4. **Expiration:** z. B. 90 Tage (danach einfach einen neuen erstellen).
5. **Resource owner:** `Flohman-AI`.
6. **Repository access:** *Only select repositories* → nur **`biff-mail-agent`**.
7. **Permissions → Repository permissions:**
   - **Actions:** Read and write (Agent starten, Status, Zeitplan)
   - **Contents:** Read and write (Gedächtnis ansehen und bearbeiten)
   - **Metadata:** Read-only (wird automatisch gesetzt)
8. **Generate token** und den Token (`github_pat_…`) sofort kopieren.
9. Steuerseite öffnen, Token einfügen, **Anmelden**.

„Auf diesem Gerät angemeldet bleiben“ speichert den Token nur im Browser dieses Geräts
(localStorage). Ohne Haken gilt er nur, bis der Tab geschlossen wird.

## Sicherheit

- Der Token hat **Schreibrechte**: nur auf eigenen Geräten verwenden.
- Bei Verlust des Handys oder Verdacht: Token sofort unter *Settings → Developer settings →
  Fine-grained tokens* **widerrufen** (Revoke).
- **Abmelden** löscht den Token aus dem Browser.
- Die Seite lädt keine fremden Skripte, Schriften oder Tracker (Content-Security-Policy) und
  spricht nur mit `api.github.com`.
- In dieses Repo gehören keine Mails, Fakten, Adressen oder Tokens.

## Entwicklung

Statisch, ohne Build: `index.html`, `style.css`, `config.js`, `api.js`, `app.js`.
Tests: `npm test` (Node 22+). Änderungen erst auf `develop`, dann Pull Request nach `main`
(GitHub Pages veröffentlicht `main`).
