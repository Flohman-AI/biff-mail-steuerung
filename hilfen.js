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
