// Reine Hilfsfunktionen ohne DOM und ohne Netzwerk (in Node testbar).

// Base64 (wie von der GitHub-Contents-API geliefert) → Text (UTF-8).
export function base64ZuText(b64) {
  const binaer = atob(String(b64 || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binaer, (z) => z.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

// Text (UTF-8) → Base64, in Blöcken (große Dateien sprengen sonst den Stack).
export function textZuBase64(text) {
  const bytes = new TextEncoder().encode(String(text));
  let binaer = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binaer += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binaer);
}

export function zeitDeutsch(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// Status eines Workflow-Laufs in Worte fassen.
export function laufStatusText(lauf) {
  if (!lauf) return "unbekannt";
  if (lauf.status !== "completed") return lauf.status === "queued" ? "wartet" : "läuft";
  return { success: "erfolgreich", failure: "fehlgeschlagen", cancelled: "abgebrochen", skipped: "übersprungen" }[
    lauf.conclusion
  ] || lauf.conclusion || "beendet";
}

export function laufArtText(ereignis) {
  return { schedule: "Zeitplan", workflow_dispatch: "von Hand", testlauf: "Testlauf" }[ereignis] || ereignis || "–";
}

// Ergebnis-Zahlen aus laeufe.json (steuerung-cache) nach run_id.
export function laeufeNachId(laeufeJson) {
  const karte = new Map();
  for (const eintrag of (laeufeJson && laeufeJson.laeufe) || []) {
    if (eintrag && eintrag.run_id) karte.set(String(eintrag.run_id), eintrag);
  }
  return karte;
}

export function ergebnisText(eintrag) {
  if (!eintrag) return "";
  const teile = [`${eintrag.verarbeitet ?? 0} Mails`, `${eintrag.entwuerfe ?? 0} Entwürfe`];
  if (eintrag.fehler) teile.push(`${eintrag.fehler} Fehler`);
  if (eintrag.neue_fakten) teile.push(`${eintrag.neue_fakten} neue Fakten`);
  return teile.join(" · ");
}

// Nächster geplanter Lauf (ungefähr; GitHub startet oft einige Minuten später).
export function naechsterGeplanterLauf(jetzt, { minutenTakt, stundeVonUtc, stundeBisUtc }) {
  const t = new Date(jetzt.getTime());
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(Math.floor(t.getUTCMinutes() / minutenTakt) * minutenTakt + minutenTakt);
  for (let i = 0; i < 2 * 24 * (60 / minutenTakt); i++) {
    const h = t.getUTCHours();
    if (h >= stundeVonUtc && h <= stundeBisUtc) return t;
    t.setUTCMinutes(t.getUTCMinutes() + minutenTakt);
  }
  return null;
}

// Zeilenweiser Vergleich (LCS) für „Änderungen anzeigen“: [{art: "gleich"|"neu"|"weg", zeile}].
export function zeilenDiff(alt, neu) {
  const a = String(alt).replace(/\r\n/g, "\n").split("\n");
  const b = String(neu).replace(/\r\n/g, "\n").split("\n");
  const n = a.length, m = b.length;
  const l = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      l[i][j] = a[i] === b[j] ? l[i + 1][j + 1] + 1 : Math.max(l[i + 1][j], l[i][j + 1]);
    }
  }
  const aus = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { aus.push({ art: "gleich", zeile: a[i] }); i++; j++; }
    else if (l[i + 1][j] >= l[i][j + 1]) { aus.push({ art: "weg", zeile: a[i] }); i++; }
    else { aus.push({ art: "neu", zeile: b[j] }); j++; }
  }
  while (i < n) aus.push({ art: "weg", zeile: a[i++] });
  while (j < m) aus.push({ art: "neu", zeile: b[j++] });
  return aus;
}

// Einfache Markdown-Darstellung als Bausteine (ohne HTML-Ausgabe): [{typ, text}].
export function markdownBloecke(text) {
  const bloecke = [];
  for (const roh of String(text || "").replace(/\r\n/g, "\n").split("\n")) {
    const zeile = roh.trimEnd();
    if (!zeile.trim()) continue;
    let m;
    if ((m = /^#\s+(.*)$/.exec(zeile))) bloecke.push({ typ: "titel", text: m[1] });
    else if ((m = /^#{2,}\s+(.*)$/.exec(zeile))) bloecke.push({ typ: "abschnitt", text: m[1] });
    else if ((m = /^\s*[-*]\s+(.*)$/.exec(zeile))) bloecke.push({ typ: "punkt", text: m[1].replace(/^_\((.*)\)_$/, "($1)") });
    else bloecke.push({ typ: "text", text: zeile });
  }
  return bloecke;
}

// --- Version (#36) -----------------------------------------------------------------------

// Zeigt die Version an; ein nicht ersetzter Platzhalter („__…__“) ergibt „dev“.
export function versionAnzeige(version) {
  const v = String(version || "").trim();
  return !v || /^__\w+__$/.test(v) ? "dev" : v;
}

// True, wenn auf GitHub Pages eine andere Version liegt als die geladene. Lokal („dev“) nie.
export function neueVersionVerfuegbar(aktuell, veroeffentlicht) {
  const a = versionAnzeige(aktuell);
  const v = String(veroeffentlicht || "").trim();
  return a !== "dev" && v !== "" && v !== a;
}

// --- Workflow-Zustand (#43) ------------------------------------------------------------

// Hinweistext, wenn ein Workflow nicht gestartet werden kann; leer, wenn er aktiv ist.
export function workflowHinweis(zustand, name = "Agent") {
  if (!zustand || zustand === "active") return "";
  if (zustand === "disabled_manually") return `Der Workflow „${name}“ ist ausgeschaltet.`;
  if (zustand === "disabled_inactivity") return `Der Workflow „${name}“ wurde wegen Inaktivität deaktiviert.`;
  return `Der Workflow „${name}“ ist deaktiviert.`;
}

// Link zur Workflow-Seite bei GitHub (dort lässt er sich wieder einschalten).
export function workflowSeitenLink(besitzer, repo, datei) {
  return `https://github.com/${encodeURIComponent(besitzer)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(datei)}`;
}

// --- Offene Themen (Checkliste, #42) ---------------------------------------------------------

export const AUFGABEN_KOPF =
  "# Offene Themen\n\n" +
  "Checkliste für die Steuerseite. Der Agent schlägt nur unter „Vorschläge“ etwas vor; " +
  "übernommen wird es erst auf der Steuerseite. Dieses Format bitte nicht von Hand umbauen:\n" +
  "`- [ ] Text (Frist: JJJJ-MM-TT)`, erledigt: `- [x] Text (erledigt: JJJJ-MM-TT)`.\n";

const ABSCHNITTE = { "vorschläge": "vorschlaege", offen: "offen", erledigt: "erledigt" };
const FRIST_ENDE = /\s*\(Frist:\s*(\d{4}-\d{2}-\d{2})\)\s*$/;
// Verweis auf die Quellmail (#47): {Mail: <Message-ID>, Datum: JJJJ-MM-TT} am Zeilenende.
const MAIL_ENDE = /\s*\{Mail:\s*(<[^<>{}\s"\\,]{1,200}>)(?:,\s*Datum:\s*(\d{4}-\d{2}-\d{2}))?\s*\}\s*$/;
const ERLEDIGT_ENDE = /\s*\(erledigt:\s*(\d{4}-\d{2}-\d{2})\)\s*$/;

// memory/aufgaben.md → { vorschlaege, offen, erledigt }, je [{ text, frist, erledigt }].
export function aufgabenParsen(text) {
  const daten = { vorschlaege: [], offen: [], erledigt: [] };
  let abschnitt = null;
  for (const roh of String(text || "").replace(/\r\n/g, "\n").split("\n")) {
    const ueberschrift = /^##\s+(.*?)\s*$/.exec(roh);
    if (ueberschrift) {
      abschnitt = ABSCHNITTE[ueberschrift[1].toLowerCase()] || null;
      continue;
    }
    const zeile = /^\s*[-*]\s*\[([ xX])\]\s*(.*?)\s*$/.exec(roh);
    if (!zeile || !abschnitt) continue;
    let rest = zeile[2];
    let frist = "";
    let erledigt = "";
    let mail = null;
    const m = MAIL_ENDE.exec(rest);
    if (m) { mail = { mailId: m[1], mailDatum: m[2] || "" }; rest = rest.replace(MAIL_ENDE, ""); }
    const e = ERLEDIGT_ENDE.exec(rest);
    if (e) { erledigt = e[1]; rest = rest.replace(ERLEDIGT_ENDE, ""); }
    const f = FRIST_ENDE.exec(rest);
    if (f) { frist = f[1]; rest = rest.replace(FRIST_ENDE, ""); }
    if (rest.trim()) daten[abschnitt].push({ text: rest.trim(), frist, erledigt, ...(mail || {}) });
  }
  return daten;
}

function mailVerweis(eintrag) {
  if (!eintrag.mailId || !MAIL_ENDE.test(` {Mail: ${eintrag.mailId}}`)) return "";
  return ` {Mail: ${eintrag.mailId}${eintrag.mailDatum ? `, Datum: ${eintrag.mailDatum}` : ""}}`;
}

function aufgabenZeile(eintrag, erledigt) {
  const text = String(eintrag.text).replace(/\s+/g, " ").trim();
  if (erledigt) return `- [x] ${text}${eintrag.erledigt ? ` (erledigt: ${eintrag.erledigt})` : ""}${mailVerweis(eintrag)}`;
  return `- [ ] ${text}${eintrag.frist ? ` (Frist: ${eintrag.frist})` : ""}${mailVerweis(eintrag)}`;
}

// Inhalt von mail.json (Cache) → Anzeige. Prüft, dass es die angeforderte Mail ist.
export function mailAnzeige(daten, mailId) {
  if (!daten || typeof daten !== "object" || daten.id !== mailId) return { art: "fehlt" };
  if (!daten.gefunden) return { art: "nicht-gefunden" };
  const teile = [];
  if (daten.datum) teile.push(fristDeutsch(String(daten.datum).slice(0, 10)));
  if (daten.rolle) teile.push(`von: ${daten.rolle}`);
  return { art: "mail", kopf: teile.join(" · "), betreff: String(daten.betreff || ""), text: String(daten.text || "") };
}

export function aufgabenText(daten) {
  const teil = (titel, liste, erledigt) => [`## ${titel}`, ...liste.map((e) => aufgabenZeile(e, erledigt)), ""];
  return [
    AUFGABEN_KOPF,
    ...teil("Vorschläge", daten.vorschlaege, false),
    ...teil("Offen", daten.offen, false),
    ...teil("Erledigt", daten.erledigt, true),
  ].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// Offene Einträge: mit Frist zuerst (früheste oben), danach ohne Frist; sonst Reihenfolge der Datei.
export function aufgabenSortieren(liste) {
  return liste
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.frist && b.e.frist && a.e.frist !== b.e.frist) return a.e.frist < b.e.frist ? -1 : 1;
      if (!!a.e.frist !== !!b.e.frist) return a.e.frist ? -1 : 1;
      return a.i - b.i;
    })
    .map(({ e }) => e);
}

export function datumIso(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function gueltigesDatum(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00`);
  return !Number.isNaN(d.getTime()) && datumIso(d) === text;
}

export function fristDeutsch(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

// Eingabe „01.12.2026“ oder „2026-12-01“ → ISO; leer → ""; ungültig → null.
export function fristEinlesen(eingabe) {
  const t = String(eingabe || "").trim();
  if (!t) return "";
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  const iso = de ? `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}` : t;
  return gueltigesDatum(iso) ? iso : null;
}

// „faellig“ (überfällig), „heute“, „bald“ (innerhalb von 3 Tagen) oder "".
export function fristStatus(frist, heute = new Date()) {
  if (!gueltigesDatum(frist || "")) return "";
  const h = datumIso(heute);
  if (frist < h) return "faellig";
  if (frist === h) return "heute";
  const grenze = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + 3);
  return frist <= datumIso(grenze) ? "bald" : "";
}
