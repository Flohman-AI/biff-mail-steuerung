// Bereich „Gedächtnis“: memory/fakten_und_vereinbarungen.md ansehen und bearbeiten (#29).
// Gespeichert wird als Commit direkt auf main (Ausnahme für memory/, CLAUDE.md Abschnitt 7).
import { ApiFehler } from "./api.js?v=__VERSION__";
import { dateiLesen, dateiSchreiben, element, knopf } from "./aktionen.js?v=__VERSION__";
import { markdownBloecke, zeilenDiff } from "./hilfen.js?v=__VERSION__";

const FAKTEN = "memory/fakten_und_vereinbarungen.md";
const HISTORIE = "memory/historie_zusammenfassung.md";

function darstellung(text) {
  const box = element("div");
  for (const block of markdownBloecke(text)) {
    const klasse = { titel: "md-titel", abschnitt: "md-abschnitt", punkt: "md-punkt", text: "" }[block.typ];
    box.append(element("div", { text: block.text, klasse }));
  }
  if (!box.childElementCount) box.append(element("p", { text: "(leer)", klasse: "leise" }));
  return box;
}

export function starten(api, bereich) {
  bereich.replaceChildren();
  let stand = null; // { text, sha } beim Laden
  const status = element("p", { klasse: "status", attribute: { role: "status", "aria-live": "polite" } });
  const ansicht = element("div");
  const editor = element("textarea", { attribute: { "aria-label": "Fakten und Vereinbarungen bearbeiten", spellcheck: "true" } });
  const diffBox = element("div", { klasse: "diff" });
  const bearbeiten = element("div", { attribute: { hidden: "" } }, [
    editor,
    knopf("Änderungen anzeigen", () => diffZeigen(), "knopf knopf-zweitrangig"),
    diffBox,
    knopf("Speichern", () => speichern()),
    knopf("Abbrechen", () => modus(false), "knopf knopf-leise"),
  ]);
  const bearbeitenKnopf = knopf("Bearbeiten", () => modus(true), "knopf knopf-zweitrangig");
  const historie = element("details", {}, [element("summary", { text: "Historie (Zusammenfassung) anzeigen" })]);

  function modus(bearbeitenAn) {
    bearbeiten.hidden = !bearbeitenAn;
    ansicht.hidden = bearbeitenAn;
    bearbeitenKnopf.hidden = bearbeitenAn;
    diffBox.replaceChildren();
    if (bearbeitenAn && stand) editor.value = stand.text;
    if (!bearbeitenAn) status.textContent = "";
  }

  function diffZeigen() {
    if (!stand) return;
    const zeilen = zeilenDiff(stand.text, editor.value).filter((z) => z.art !== "gleich");
    diffBox.replaceChildren(...(zeilen.length
      ? zeilen.map((z) => element("div", { text: `${z.art === "neu" ? "+ " : "− "}${z.zeile}`, klasse: `diff-${z.art}` }))
      : [element("p", { text: "Keine Änderungen.", klasse: "leise" })]));
  }

  async function laden() {
    status.textContent = "Wird geladen …";
    try {
      const [fakten, hist] = await Promise.all([dateiLesen(api, FAKTEN), dateiLesen(api, HISTORIE)]);
      stand = fakten || { text: "", sha: undefined };
      ansicht.replaceChildren(darstellung(stand.text));
      historie.replaceChildren(historie.firstChild, darstellung(hist ? hist.text : ""));
      status.textContent = fakten ? "" : "Die Datei gibt es in main noch nicht.";
    } catch (fehler) {
      status.textContent = fehler.message;
    }
  }

  async function speichern() {
    if (!stand) return;
    if (editor.value === stand.text) {
      status.textContent = "Keine Änderungen zu speichern.";
      return;
    }
    diffZeigen();
    if (!confirm("Änderungen am Gedächtnis speichern? Der Agent nutzt sie ab dem nächsten Lauf.")) return;
    for (const b of bearbeiten.querySelectorAll("button")) b.disabled = true;
    status.textContent = "Wird gespeichert …";
    try {
      const text = editor.value.endsWith("\n") ? editor.value : editor.value + "\n";
      await dateiSchreiben(api, FAKTEN, text, stand.sha, "memory: über Steuerseite bearbeitet");
      modus(false);
      await laden();
      status.textContent = "Gespeichert.";
    } catch (fehler) {
      status.textContent = fehler instanceof ApiFehler && (fehler.status === 409 || fehler.status === 422)
        ? "Nicht gespeichert: Die Datei wurde inzwischen geändert (z. B. vom Agent). Deine Änderungen stehen noch im Feld – bitte kopieren, „Abbrechen“, neu laden und erneut einfügen."
        : fehler.message;
    } finally {
      for (const b of bearbeiten.querySelectorAll("button")) b.disabled = false;
    }
  }

  bereich.append(
    element("div", { klasse: "zeile" }, [
      element("h2", { text: "Gedächtnis" }),
      knopf("Neu laden", () => { modus(false); laden(); }, "knopf knopf-leise"),
    ]),
    element("p", { klasse: "leise", text: "Fakten und Vereinbarungen, die der Agent bei jeder Antwort berücksichtigt." }),
    status,
    ansicht,
    bearbeitenKnopf,
    bearbeiten,
    historie,
  );
  laden();
}

export function stoppen() {}
