// Bereich „Offene Themen“: Checkliste zum Abhaken (#42). Die Daten liegen in
// memory/aufgaben.md (main). Gespeichert wird als Commit direkt auf main (Ausnahme für memory/,
// CLAUDE.md Abschnitt 7). Der Agent legt nur Vorschläge an; übernommen wird hier.
import { ApiFehler } from "./api.js?v=__VERSION__";
import { WORKFLOWS } from "./config.js?v=__VERSION__";
import {
  aufLaufWarten, cacheJsonLesen, dateiLesen, dateiSchreiben, element, knopf, workflowPruefen, workflowStarten,
} from "./aktionen.js?v=__VERSION__";
import {
  aufgabenParsen, aufgabenSortieren, aufgabenText, mailAnzeige, datumIso, fristDeutsch, fristEinlesen, fristStatus,
} from "./hilfen.js?v=__VERSION__";

const DATEI = "memory/aufgaben.md";

// Die geöffnete Mail liegt nur kurz im Daten-Branch; beim Schließen/Abmelden wird sie dort gelöscht.
let offeneApi = null;
let mailOffen = false;

async function mailAufraeumen() {
  const api = offeneApi;
  if (!api || !mailOffen) return;
  mailOffen = false;
  try {
    await workflowStarten(api, WORKFLOWS.mailAnzeigen, { aktion: "leeren", mail_id: "" });
  } catch { /* best effort: der Cache wird beim nächsten Lauf ohnehin ersetzt */ }
}

export function starten(api, bereich) {
  bereich.replaceChildren();
  offeneApi = api;
  let stand = { text: "", sha: undefined };
  let beschaeftigt = false;

  const status = element("p", { klasse: "status", attribute: { role: "status", "aria-live": "polite" } });
  const vorschlagBox = element("div");
  const listeBox = element("ul", { klasse: "liste" });
  const erledigtBox = element("ul", { klasse: "liste" });
  const erledigtZaehler = element("summary", { text: "Erledigt" });
  const erledigt = element("details", {}, [erledigtZaehler, erledigtBox]);
  const mailHinweis = element("p", { klasse: "leise", attribute: { hidden: "" } });
  const mailKopf = element("p", { klasse: "leise" });
  const mailBetreff = element("h3");
  const mailText = element("pre", { klasse: "mail-text" });
  const mailBox = element("section", { klasse: "eintrag", attribute: { hidden: "", "aria-label": "Mail" } }, [
    mailBetreff, mailKopf, mailText,
    knopf("Schließen", () => mailSchliessen(), "knopf knopf-leise"),
  ]);
  const neuText = element("input", {
    attribute: { id: "aufgabe-text", type: "text", placeholder: "Neues Thema, z. B. „Beleg nachreichen“", "aria-label": "Neues Thema", maxlength: "300" },
  });
  const neuFrist = element("input", {
    attribute: { id: "aufgabe-frist", type: "date", "aria-label": "Frist (optional)" },
  });

  function sperren(an) {
    beschaeftigt = an;
    for (const b of bereich.querySelectorAll("button")) b.disabled = an;
  }

  async function laden() {
    status.textContent = "Wird geladen …";
    try {
      const datei = await dateiLesen(api, DATEI);
      stand = datei || { text: "", sha: undefined };
      zeigen();
      status.textContent = "";
    } catch (fehler) {
      status.textContent = fehler.message;
    }
  }

  // Ändert die Daten und speichert. mutator(daten) verändert die Listen; false = nichts zu tun.
  async function aendern(mutator, erfolg) {
    if (beschaeftigt) return;
    const daten = aufgabenParsen(stand.text);
    if (mutator(daten) === false) return;
    sperren(true);
    status.textContent = "Wird gespeichert …";
    try {
      await dateiSchreiben(api, DATEI, aufgabenText(daten), stand.sha, "memory: Offene Themen über Steuerseite geändert");
      await laden();
      status.textContent = erfolg;
    } catch (fehler) {
      const konflikt = fehler instanceof ApiFehler && (fehler.status === 409 || fehler.status === 422);
      await laden();
      status.textContent = konflikt
        ? "Nicht gespeichert: Die Liste wurde inzwischen geändert (z. B. vom Agent). Sie wurde neu geladen – bitte noch einmal versuchen."
        : fehler.message;
    } finally {
      sperren(false);
    }
  }

  function mailSchliessen() {
    mailBox.hidden = true;
    mailText.textContent = "";
    mailAufraeumen();
  }

  async function mailZeigen(e) {
    if (beschaeftigt) return;
    sperren(true);
    mailBox.hidden = true;
    status.textContent = "Mail wird geholt … (ca. 30–60 Sekunden)";
    try {
      const pruefung = await workflowPruefen(api, WORKFLOWS.mailAnzeigen, "Mail anzeigen", mailHinweis);
      if (!pruefung.kannStarten) { status.textContent = ""; return; }
      mailOffen = true;
      const start = await workflowStarten(api, WORKFLOWS.mailAnzeigen, { aktion: "anzeigen", mail_id: e.mailId });
      const lauf = await aufLaufWarten(api, WORKFLOWS.mailAnzeigen, start, {
        beiStatus: (l, s) => { status.textContent = `Mail wird geholt … ${s} s`; },
      });
      if (lauf.conclusion !== "success") {
        status.textContent = "Fehlgeschlagen. Details im Log des Workflows „Mail anzeigen“ (ohne Inhalte).";
        return;
      }
      const ergebnis = mailAnzeige(await cacheJsonLesen(api, "mail.json"), e.mailId);
      if (ergebnis.art === "mail") {
        mailBetreff.textContent = ergebnis.betreff || "(ohne Betreff)";
        mailKopf.textContent = ergebnis.kopf;
        mailText.textContent = ergebnis.text;
        mailBox.hidden = false;
        status.textContent = "";
      } else {
        status.textContent = ergebnis.art === "nicht-gefunden"
          ? "Die Mail wurde im Postfach nicht gefunden."
          : "Die Mail konnte nicht gelesen werden. Bitte noch einmal versuchen.";
      }
    } catch (fehler) {
      status.textContent = fehler.message;
    } finally {
      sperren(false);
    }
  }

  const mailKnopf = (e) => (e.mailId ? knopf("Mail anzeigen", () => mailZeigen(e), "knopf knopf-leise") : null);

  function fristMarke(frist) {
    if (!frist) return null;
    const art = fristStatus(frist);
    const text = { faellig: "überfällig · ", heute: "heute · ", bald: "bald · " }[art] || "";
    return element("span", { text: `Frist ${text}${fristDeutsch(frist)}`, klasse: `marke${art ? ` frist-${art}` : ""}` });
  }

  function zeigen() {
    const daten = aufgabenParsen(stand.text);

    vorschlagBox.replaceChildren();
    if (daten.vorschlaege.length) {
      vorschlagBox.append(
        element("h3", { text: "Vorschläge vom Agenten" }),
        element("p", { klasse: "leise", text: "Wird erst übernommen, wenn du es bestätigst." }),
        element("ul", { klasse: "liste" }, daten.vorschlaege.map((v) => element("li", { klasse: "eintrag" }, [
          element("div", { text: v.text }),
          element("div", { klasse: "zeile" }, [
            mailKnopf(v),
            knopf("Übernehmen", () => aendern((d) => {
              const i = d.vorschlaege.findIndex((x) => x.text === v.text);
              if (i < 0) return false;
              d.offen.push(d.vorschlaege.splice(i, 1)[0]);
            }, "Übernommen.")),
            knopf("Verwerfen", () => aendern((d) => {
              const i = d.vorschlaege.findIndex((x) => x.text === v.text);
              if (i < 0) return false;
              d.vorschlaege.splice(i, 1);
            }, "Verworfen."), "knopf knopf-leise"),
          ]),
        ]))),
      );
    }

    const offen = aufgabenSortieren(daten.offen);
    listeBox.replaceChildren(...(offen.length
      ? offen.map((e) => element("li", { klasse: "eintrag aufgabe" }, [
        element("div", { klasse: "aufgabe-kopf" }, [
          knopf("☐", () => aendern((d) => {
            const i = d.offen.findIndex((x) => x.text === e.text && x.frist === e.frist);
            if (i < 0) return false;
            const [eintrag] = d.offen.splice(i, 1);
            d.erledigt.unshift({ ...eintrag, frist: "", erledigt: datumIso() });
          }, "Als erledigt markiert."), "knopf haken-knopf"),
          element("span", { text: e.text, klasse: "aufgabe-text" }),
        ]),
        fristMarke(e.frist),
        element("div", { klasse: "zeile" }, [
          mailKnopf(e),
          knopf("Ändern", () => bearbeiten(e), "knopf knopf-leise"),
          knopf("Löschen", () => {
            if (!confirm(`„${e.text}“ löschen?`)) return;
            aendern((d) => {
              const i = d.offen.findIndex((x) => x.text === e.text && x.frist === e.frist);
              if (i < 0) return false;
              d.offen.splice(i, 1);
            }, "Gelöscht.");
          }, "knopf knopf-leise"),
        ]),
      ]))
      : [element("li", { text: "Nichts offen.", klasse: "leise" })]));

    erledigtZaehler.textContent = `Erledigt (${daten.erledigt.length})`;
    erledigtBox.replaceChildren(...daten.erledigt.map((e) => element("li", { klasse: "eintrag" }, [
      element("div", { text: e.text, klasse: "erledigt-text" }),
      element("div", { klasse: "leise", text: e.erledigt ? `Erledigt am ${fristDeutsch(e.erledigt)}` : "Erledigt" }),
      knopf("Wieder öffnen", () => aendern((d) => {
        const i = d.erledigt.findIndex((x) => x.text === e.text && x.erledigt === e.erledigt);
        if (i < 0) return false;
        const [eintrag] = d.erledigt.splice(i, 1);
        d.offen.push({ ...eintrag, frist: "", erledigt: "" });
      }, "Wieder geöffnet."), "knopf knopf-leise"),
    ])));
  }

  function bearbeiten(e) {
    const text = prompt("Thema ändern:", e.text);
    if (text === null) return;
    const neu = text.replace(/\s+/g, " ").trim();
    if (!neu) { status.textContent = "Der Text darf nicht leer sein."; return; }
    const eingabe = prompt("Frist (TT.MM.JJJJ, leer = keine):", fristDeutsch(e.frist));
    if (eingabe === null) return;
    const frist = fristEinlesen(eingabe);
    if (frist === null) { status.textContent = "Die Frist ist ungültig. Bitte TT.MM.JJJJ eingeben."; return; }
    aendern((d) => {
      const i = d.offen.findIndex((x) => x.text === e.text && x.frist === e.frist);
      if (i < 0) return false;
      d.offen[i] = { ...d.offen[i], text: neu, frist, erledigt: "" };
    }, "Geändert.");
  }

  function hinzufuegen() {
    const text = neuText.value.replace(/\s+/g, " ").trim();
    if (!text) { status.textContent = "Bitte ein Thema eingeben."; return; }
    const frist = fristEinlesen(neuFrist.value);
    if (frist === null) { status.textContent = "Die Frist ist ungültig."; return; }
    aendern((d) => { d.offen.push({ text, frist, erledigt: "" }); }, "Hinzugefügt.").then(() => {
      if (!status.textContent.startsWith("Nicht") ) { neuText.value = ""; neuFrist.value = ""; }
    });
  }

  bereich.append(
    element("div", { klasse: "zeile" }, [
      element("h2", { text: "Offene Themen" }),
      knopf("Neu laden", () => laden(), "knopf knopf-leise"),
    ]),
    element("p", { klasse: "leise", text: "Abhaken, was erledigt ist. Änderungen werden sofort gespeichert." }),
    status,
    mailHinweis,
    mailBox,
    vorschlagBox,
    element("h3", { text: "Offen" }),
    listeBox,
    element("label", { text: "Neues Thema", attribute: { for: "aufgabe-text" } }),
    neuText,
    element("label", { text: "Frist (optional)", attribute: { for: "aufgabe-frist" } }),
    neuFrist,
    knopf("Hinzufügen", () => hinzufuegen(), "knopf knopf-zweitrangig"),
    erledigt,
  );
  laden();
}

export function stoppen() {
  mailAufraeumen();
}
