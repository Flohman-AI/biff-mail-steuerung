import { test } from "node:test";
import assert from "node:assert/strict";
import {
  base64ZuText, ergebnisText, laeufeNachId, laufArtText, laufStatusText, markdownBloecke,
  naechsterGeplanterLauf, textZuBase64, zeilenDiff,
} from "../hilfen.js";
import { aufLaufWarten } from "../aktionen.js";

test("Base64 hin und zurück mit Umlauten und Gedankenstrich", () => {
  const text = "Ein Thread – ein Thema: Zahnärztin, Größe, 37,90 €\n";
  assert.equal(base64ZuText(textZuBase64(text)), text);
  // GitHub liefert Base64 mit Zeilenumbrüchen
  const mitUmbruch = textZuBase64(text).replace(/(.{20})/g, "$1\n");
  assert.equal(base64ZuText(mitUmbruch), text);
});

test("große Texte sprengen den Stack nicht", () => {
  const text = "ä".repeat(200000);
  assert.equal(base64ZuText(textZuBase64(text)), text);
});

test("Laufstatus und Art", () => {
  assert.equal(laufStatusText({ status: "completed", conclusion: "success" }), "erfolgreich");
  assert.equal(laufStatusText({ status: "completed", conclusion: "failure" }), "fehlgeschlagen");
  assert.equal(laufStatusText({ status: "in_progress" }), "läuft");
  assert.equal(laufStatusText({ status: "queued" }), "wartet");
  assert.equal(laufArtText("schedule"), "Zeitplan");
});

test("Ergebnisse nach run_id", () => {
  const karte = laeufeNachId({ laeufe: [{ run_id: "7", verarbeitet: 2, entwuerfe: 3, fehler: 1, neue_fakten: 0 }] });
  assert.equal(ergebnisText(karte.get("7")), "2 Mails · 3 Entwürfe · 1 Fehler");
  assert.equal(ergebnisText(karte.get("8")), "");
  assert.equal(laeufeNachId(null).size, 0);
});

test("nächster geplanter Lauf im Zeitfenster", () => {
  const plan = { minutenTakt: 20, stundeVonUtc: 5, stundeBisUtc: 21 };
  assert.equal(naechsterGeplanterLauf(new Date("2026-11-26T10:05:30Z"), plan).toISOString(), "2026-11-26T10:20:00.000Z");
  assert.equal(naechsterGeplanterLauf(new Date("2026-11-26T21:45:00Z"), plan).toISOString(), "2026-11-27T05:00:00.000Z");
  assert.equal(naechsterGeplanterLauf(new Date("2026-11-26T02:00:00Z"), plan).toISOString(), "2026-11-26T05:00:00.000Z");
});

test("Zeilen-Diff", () => {
  const diff = zeilenDiff("a\nb\nc", "a\nB\nc\nd");
  assert.deepEqual(diff.map((d) => `${d.art}:${d.zeile}`), ["gleich:a", "weg:b", "neu:B", "gleich:c", "neu:d"]);
});

test("Markdown-Bausteine", () => {
  const bloecke = markdownBloecke("# Fakten\n\n## Feste Regeln\n- Ein Thread\n- _(Platzhalter: x)_\nText");
  assert.deepEqual(bloecke, [
    { typ: "titel", text: "Fakten" },
    { typ: "abschnitt", text: "Feste Regeln" },
    { typ: "punkt", text: "Ein Thread" },
    { typ: "punkt", text: "(Platzhalter: x)" },
    { typ: "text", text: "Text" },
  ]);
});

test("aufLaufWarten findet den neuen Lauf und wartet bis fertig", async () => {
  const start = new Date("2026-11-26T10:00:00Z");
  const antworten = [
    { workflow_runs: [{ id: 1, created_at: "2026-11-26T09:00:00Z", status: "completed" }] }, // alter Lauf
    { workflow_runs: [{ id: 2, created_at: "2026-11-26T10:00:03Z", status: "queued" }] },
    { workflow_runs: [{ id: 2, created_at: "2026-11-26T10:00:03Z", status: "completed", conclusion: "success" }] },
  ];
  const api = { repoPfad: (p) => p, anfrage: async () => antworten.shift() };
  const gesehen = [];
  const lauf = await aufLaufWarten(api, "agent.yml", start, {
    warteFn: async () => {}, beiStatus: (l) => gesehen.push(l && l.id),
  });
  assert.equal(lauf.id, 2);
  assert.deepEqual(gesehen, [null, 2, 2]);
});

import { neueVersionVerfuegbar, versionAnzeige } from "../hilfen.js";

test("Version: Platzhalter ergibt dev, echte Version bleibt", () => {
  assert.equal(versionAnzeige("__VERSION__"), "dev");
  assert.equal(versionAnzeige(""), "dev");
  assert.equal(versionAnzeige(undefined), "dev");
  assert.equal(versionAnzeige("a1b2c3d"), "a1b2c3d");
});

test("Neue Version: nur bei echter, abweichender Version", () => {
  assert.equal(neueVersionVerfuegbar("a1b2c3d", "a1b2c3d"), false);
  assert.equal(neueVersionVerfuegbar("a1b2c3d", "e4f5a6b"), true);
  assert.equal(neueVersionVerfuegbar("a1b2c3d", ""), false);
  assert.equal(neueVersionVerfuegbar("__VERSION__", "e4f5a6b"), false); // lokal nie
});

import { workflowHinweis, workflowSeitenLink } from "../hilfen.js";
import { workflowPruefen, workflowStarten } from "../aktionen.js";
// Gleiche URL wie in den Modulen (mit ?v=…), sonst gäbe es zwei Klassen und instanceof schlüge fehl.
import { ApiFehler } from "../api.js?v=__VERSION__";

test("Workflow-Hinweis nur bei nicht aktivem Zustand", () => {
  assert.equal(workflowHinweis("active"), "");
  assert.equal(workflowHinweis(null), "");
  assert.match(workflowHinweis("disabled_manually"), /ausgeschaltet/);
  assert.match(workflowHinweis("disabled_inactivity", "Entwürfe"), /Entwürfe.*Inaktivität/);
  assert.match(workflowHinweis("disabled_fork"), /deaktiviert/);
  assert.equal(
    workflowSeitenLink("Flohman-AI", "biff-mail-agent", "agent.yml"),
    "https://github.com/Flohman-AI/biff-mail-agent/actions/workflows/agent.yml",
  );
});

test("Start eines ausgeschalteten Workflows (422) liefert verständliche Meldung", async () => {
  const api = {
    repoPfad: (rest) => `/repos/x/y${rest}`,
    anfrage: async () => { throw new ApiFehler("GitHub hat die Anfrage abgelehnt (ungültige Angaben).", 422); },
  };
  await assert.rejects(() => workflowStarten(api, "agent.yml"), /ausgeschaltet|lässt sich gerade nicht starten/);
  const api500 = { repoPfad: (r) => r, anfrage: async () => { throw new ApiFehler("GitHub ist gerade nicht erreichbar.", 502); } };
  await assert.rejects(() => workflowStarten(api500, "agent.yml"), /nicht erreichbar/); // andere Fehler bleiben
});

// Minimales DOM-Ersatzobjekt für workflowPruefen (nur textContent/replaceChildren/hidden).
function fakeZiel() {
  return { hidden: true, inhalt: [], replaceChildren(...k) { this.inhalt = k; } };
}

test("workflowPruefen: aktiv blockiert nicht, ausgeschaltet zeigt Hinweis", async () => {
  globalThis.document ??= { createElement: () => ({ setAttribute() {}, append() {} }) };
  const aktiv = { repoPfad: (r) => r, anfrage: async () => ({ state: "active" }) };
  const z1 = fakeZiel();
  assert.deepEqual(await workflowPruefen(aktiv, "agent.yml", "Agent", z1), { kannStarten: true, zustand: "active" });
  assert.equal(z1.hidden, true);
  const aus = { repoPfad: (r) => r, anfrage: async () => ({ state: "disabled_manually" }) };
  const z2 = fakeZiel();
  assert.deepEqual(await workflowPruefen(aus, "agent.yml", "Agent", z2), { kannStarten: false, zustand: "disabled_manually" });
  assert.equal(z2.hidden, false);
  assert.match(z2.inhalt[0], /ausgeschaltet/);
  // Fehler beim Abfragen blockiert nicht
  const kaputt = { repoPfad: (r) => r, anfrage: async () => { throw new Error("x"); } };
  assert.equal((await workflowPruefen(kaputt, "agent.yml", "Agent", fakeZiel())).kannStarten, true);
});

import {
  aufgabenParsen, aufgabenSortieren, aufgabenText, mailAnzeige, fristDeutsch, fristEinlesen, fristStatus,
} from "../hilfen.js";

const AUFGABEN = `# Offene Themen

## Vorschläge
- [ ] Zusage zum Ausflug

## Offen
- [ ] Beleg nachreichen (Frist: 2026-12-10)
- [ ] Arzttermin klären
- [ ] Rechnung prüfen (Frist: 2026-12-01)

## Erledigt
- [x] Spange nachstellen (erledigt: 2026-11-20)
`;

test("Aufgaben: Parsen mit Fristen und Erledigt-Datum", () => {
  const d = aufgabenParsen(AUFGABEN);
  assert.deepEqual(d.vorschlaege, [{ text: "Zusage zum Ausflug", frist: "", erledigt: "" }]);
  assert.equal(d.offen.length, 3);
  assert.deepEqual(d.offen[0], { text: "Beleg nachreichen", frist: "2026-12-10", erledigt: "" });
  assert.deepEqual(d.erledigt[0], { text: "Spange nachstellen", frist: "", erledigt: "2026-11-20" });
  assert.deepEqual(aufgabenParsen(""), { vorschlaege: [], offen: [], erledigt: [] });
  assert.deepEqual(aufgabenParsen(undefined).offen, []);
});

test("Aufgaben: Text hin und zurück bleibt gleich (Erledigt bleibt erhalten)", () => {
  const d = aufgabenParsen(AUFGABEN);
  const text = aufgabenText(d);
  assert.deepEqual(aufgabenParsen(text), d);
  assert.ok(text.startsWith("# Offene Themen"));
  assert.ok(text.includes("- [x] Spange nachstellen (erledigt: 2026-11-20)"));
  // Leere Datei ergibt alle drei Abschnitte
  const leer = aufgabenText({ vorschlaege: [], offen: [], erledigt: [] });
  for (const titel of ["## Vorschläge", "## Offen", "## Erledigt"]) assert.ok(leer.includes(titel));
});

test("Aufgaben: Sortierung nach Frist, dann ohne Frist in Dateireihenfolge", () => {
  const sortiert = aufgabenSortieren(aufgabenParsen(AUFGABEN).offen).map((e) => e.text);
  assert.deepEqual(sortiert, ["Rechnung prüfen", "Beleg nachreichen", "Arzttermin klären"]);
});

test("Aufgaben: Fristen einlesen und bewerten", () => {
  assert.equal(fristEinlesen("01.12.2026"), "2026-12-01");
  assert.equal(fristEinlesen("2026-12-01"), "2026-12-01");
  assert.equal(fristEinlesen("  "), "");
  assert.equal(fristEinlesen("31.02.2026"), null);
  assert.equal(fristEinlesen("morgen"), null);
  assert.equal(fristDeutsch("2026-12-01"), "01.12.2026");
  const heute = new Date(2026, 11, 1);
  assert.equal(fristStatus("2026-11-30", heute), "faellig");
  assert.equal(fristStatus("2026-12-01", heute), "heute");
  assert.equal(fristStatus("2026-12-03", heute), "bald");
  assert.equal(fristStatus("2026-12-20", heute), "");
  assert.equal(fristStatus("", heute), "");
});

test("Aufgaben: Mail-Verweis wird gelesen und beim Speichern erhalten", () => {
  const roh = `# Offene Themen

## Vorschläge
- [ ] Zusage bis 01.12.2026 {Mail: <orig@example.net>, Datum: 2026-11-20}

## Offen
- [ ] Beleg (Frist: 2026-12-10) {Mail: <b@example.net>}
- [ ] Ohne Verweis

## Erledigt
- [x] Alt (erledigt: 2026-11-01) {Mail: <c@example.net>, Datum: 2026-10-30}
`;
  const d = aufgabenParsen(roh);
  assert.deepEqual(d.vorschlaege[0], {
    text: "Zusage bis 01.12.2026", frist: "", erledigt: "", mailId: "<orig@example.net>", mailDatum: "2026-11-20",
  });
  assert.equal(d.offen[0].frist, "2026-12-10");
  assert.equal(d.offen[0].mailId, "<b@example.net>");
  assert.equal(d.offen[1].mailId, undefined);
  assert.equal(d.erledigt[0].erledigt, "2026-11-01");
  const text = aufgabenText(d);
  assert.ok(text.includes("- [ ] Zusage bis 01.12.2026 {Mail: <orig@example.net>, Datum: 2026-11-20}"));
  assert.ok(text.includes("- [ ] Beleg (Frist: 2026-12-10) {Mail: <b@example.net>}"));
  assert.ok(text.includes("- [x] Alt (erledigt: 2026-11-01) {Mail: <c@example.net>, Datum: 2026-10-30}"));
  assert.deepEqual(aufgabenParsen(text), d);
});

test("Aufgaben: ungültige Mail-ID wird nicht geschrieben", () => {
  const text = aufgabenText({ vorschlaege: [], offen: [{ text: "X", frist: "", erledigt: "", mailId: "<a b>" }], erledigt: [] });
  assert.ok(text.includes("- [ ] X\n"));
  assert.ok(!text.includes("Mail:"));
});

test("Mail anzeigen: Ergebnis prüfen", () => {
  const id = "<orig@example.net>";
  assert.equal(mailAnzeige(null, id).art, "fehlt");
  assert.equal(mailAnzeige({ id: "<andere@x>", gefunden: true }, id).art, "fehlt");
  assert.equal(mailAnzeige({ id, gefunden: false }, id).art, "nicht-gefunden");
  const m = mailAnzeige({ id, gefunden: true, datum: "2026-11-20T08:00:00", rolle: "Gegenseite", betreff: "B", text: "T" }, id);
  assert.deepEqual(m, { art: "mail", kopf: "20.11.2026 · von: Gegenseite", betreff: "B", text: "T" });
});
