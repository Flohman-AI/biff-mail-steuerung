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
