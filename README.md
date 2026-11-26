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

## Offene Themen (Checkliste)

Reiter „Offene Themen“: Themen und Fristen abhaken, hinzufügen, ändern und löschen. Die Daten liegen
in `memory/aufgaben.md` im Repo `biff-mail-agent` (Commit direkt auf `main`, wie beim Gedächtnis).
Der Agent legt neue Fristen nur als **Vorschlag** an; übernommen wird er erst hier. Erledigtes
bleibt mit Datum im eingeklappten Abschnitt „Erledigt“. In die Datei gehören nur kurze Stichpunkte,
keine Mails oder Adressen. Der Token braucht dafür wie beim Gedächtnis „Contents: Read and write“.

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
Tests: `npm test` (Node 22+). Änderungen erst auf `develop`, dann Pull Request nach `main`.

## Veröffentlichung und Versionierung

GitHub Pages liefert Dateien mit `Cache-Control: max-age=600`. Damit der Browser nach einem Update
keine Mischung aus neuen und alten Dateien lädt, tragen alle Dateien und Modul-Imports den
Parameter `?v=__VERSION__`. Der Workflow `deploy.yml` ersetzt den Platzhalter bei jedem Push auf
`main` im Build-Verzeichnis durch den Kurz-Hash des Commits (im Repo bleibt der Platzhalter
stehen), schreibt eine `version.json` und veröffentlicht die Seite.

- **Einmalig einstellen:** Repo-Einstellungen → Pages → Quelle auf **„GitHub Actions“** setzen
  (statt „Deploy from branch“).
- **Lokal und Tests:** Ohne Ersetzung funktioniert alles; die Seite zeigt unten „dev“.
- **Neue Version:** Liegt nach dem Laden eine neuere Version vor, erscheint oben „Neue Version
  verfügbar“ mit Knopf zum Neuladen. Unten steht immer die geladene Version.
- Neue Imports immer als `from "./datei.js?v=__VERSION__"` schreiben, sonst lädt der Browser ein
  Modul doppelt.
