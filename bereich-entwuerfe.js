// Bereich „Entwürfe“: ansehen, von Claude überarbeiten lassen (Vorschau), ersetzen (#30).
// Jede Aktion startet den Workflow „Entwürfe“ in biff-mail-agent (ca. 30–60 s); die Ergebnisse
// liegen danach im Daten-Branch steuerung-cache (entwuerfe.json, vorschlag.json).
import { WORKFLOWS } from "./config.js";
import { aufLaufWarten, cacheJsonLesen, element, knopf, workflowStarten } from "./aktionen.js";
import { laufStatusText, zeitDeutsch } from "./hilfen.js";

export function starten(api, bereich) {
  bereich.replaceChildren();
  let liste = [];
  let gewaehlt = null;
  let beschaeftigt = false;

  const status = element("p", { klasse: "status", attribute: { role: "status", "aria-live": "polite" } });
  const stand = element("p", { klasse: "leise" });
  const listenBox = element("div");
  const titel = element("h3");
  const hinweis = element("p", { klasse: "hinweis-box", attribute: { hidden: "" } });
  const editor = element("textarea", { attribute: { "aria-label": "Entwurfstext", spellcheck: "true" } });
  const anweisung = element("input", {
    attribute: { id: "entwurf-anweisung", type: "text", placeholder: "z. B. „kürzer“, „Frist 15.12. nennen“", "aria-label": "Anweisung an Claude", maxlength: "2000" },
  });
  const detail = element("div", { attribute: { hidden: "" } }, [
    knopf("← Zur Liste", () => zurListe(), "knopf knopf-leise"),
    titel,
    hinweis,
    editor,
    knopf("Text speichern (Entwurf ersetzen)", () => speichern()),
    element("label", { text: "Von Claude überarbeiten lassen", attribute: { for: "entwurf-anweisung" } }),
    anweisung,
    knopf("Vorschlag holen", () => vorschlagHolen(), "knopf knopf-zweitrangig"),
  ]);
  const uebersicht = element("div", {}, [
    knopf("Entwürfe laden", () => aktion("auflisten")),
    stand,
    listenBox,
    knopf("Entwurfstexte aus dem Zwischenspeicher entfernen", () => leeren(), "knopf knopf-leise"),
  ]);

  function sperren(an) {
    beschaeftigt = an;
    for (const b of bereich.querySelectorAll("button")) b.disabled = an;
  }

  // Startet den Workflow und wartet auf das Ende. Gibt true zurück, wenn erfolgreich.
  async function aktion(name, inputs = {}) {
    if (beschaeftigt) return false;
    sperren(true);
    status.textContent = "Wird gestartet … (ca. 30–60 Sekunden)";
    try {
      const start = await workflowStarten(api, WORKFLOWS.entwuerfe, { aktion: name, ...inputs });
      const lauf = await aufLaufWarten(api, WORKFLOWS.entwuerfe, start, {
        beiStatus: (l, s) => { status.textContent = `${l ? laufStatusText(l) : "Wird gestartet"} … ${s} s`; },
      });
      if (lauf.conclusion !== "success") {
        status.textContent = "Fehlgeschlagen. Details im Log des Workflows „Entwürfe“ (ohne Inhalte).";
        return false;
      }
      if (name === "auflisten" || name === "ersetzen" || name === "leeren") await listeLaden();
      status.textContent = { auflisten: "Aktualisiert.", ersetzen: "Gespeichert.", leeren: "Entfernt.", vorschlag: "Vorschlag da." }[name];
      return true;
    } catch (fehler) {
      status.textContent = fehler.message;
      return false;
    } finally {
      sperren(false);
    }
  }

  async function listeLaden() {
    const daten = await cacheJsonLesen(api, "entwuerfe.json");
    liste = (daten && daten.entwuerfe) || [];
    stand.textContent = daten ? `Stand: ${zeitDeutsch(daten.zeit)} – ${liste.length} Entwürfe` : "Noch nicht geladen.";
    listenBox.replaceChildren(...liste.map((e) => {
      const b = element("button", { klasse: "listen-knopf", attribute: { type: "button" } }, [
        element("div", { text: e.betreff || "(ohne Betreff)" }),
        element("div", { klasse: "leise", text: `${zeitDeutsch(e.datum)}${e.im_thread ? " · Antwort im Thread" : " · neuer Thread"}` }),
      ]);
      b.addEventListener("click", () => oeffnen(e));
      return b;
    }));
  }

  function oeffnen(e) {
    gewaehlt = e;
    titel.textContent = e.betreff || "(ohne Betreff)";
    editor.value = e.text || "";
    anweisung.value = "";
    hinweis.hidden = true;
    uebersicht.hidden = true;
    detail.hidden = false;
    status.textContent = "";
  }

  function zurListe() {
    gewaehlt = null;
    detail.hidden = true;
    uebersicht.hidden = false;
  }

  async function vorschlagHolen() {
    const text = anweisung.value.trim();
    if (!gewaehlt || !text) {
      status.textContent = "Bitte eine Anweisung eingeben.";
      return;
    }
    if (await aktion("vorschlag", { entwurf_id: gewaehlt.id, anweisung: text })) {
      const v = await cacheJsonLesen(api, "vorschlag.json");
      if (!v || v.id !== gewaehlt.id) {
        status.textContent = "Kein passender Vorschlag gefunden. Bitte erneut versuchen.";
        return;
      }
      editor.value = v.text;
      hinweis.textContent = "Vorschlag von Claude – bitte prüfen, bei Bedarf anpassen und dann speichern. Noch ist nichts ersetzt.";
      hinweis.hidden = false;
    }
  }

  async function speichern() {
    if (!gewaehlt || !editor.value.trim()) return;
    if (!confirm("Entwurf im Postfach durch diesen Text ersetzen?")) return;
    if (await aktion("ersetzen", { entwurf_id: gewaehlt.id, neuer_text: editor.value })) zurListe();
  }

  async function leeren() {
    if (confirm("Entwurfstexte aus dem Zwischenspeicher (Branch steuerung-cache) entfernen? Die Entwürfe im Postfach bleiben.")) {
      await aktion("leeren");
    }
  }

  bereich.append(
    element("h2", { text: "Entwürfe" }),
    element("p", { klasse: "leise", text: "Antwortentwürfe des Agents. Jede Aktion dauert etwa 30–60 Sekunden." }),
    status,
    uebersicht,
    detail,
  );
  listeLaden().catch((fehler) => { status.textContent = fehler.message; });
}

export function stoppen() {}
