// Bereich „Zeitplan“: automatischen Lauf (agent.yml) an- und ausschalten (#28).
import { ApiFehler } from "./api.js?v=__VERSION__";
import { WORKFLOWS, ZEITPLAN } from "./config.js?v=__VERSION__";
import { element, knopf, letzteLaeufe } from "./aktionen.js?v=__VERSION__";
import { laufStatusText, naechsterGeplanterLauf, zeitDeutsch } from "./hilfen.js?v=__VERSION__";

function uhrzeit(datum) {
  return datum.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function zeitfensterText() {
  // Stunden des UTC-Zeitfensters in lokale Zeit umrechnen (Sommer-/Winterzeit automatisch).
  const heute = new Date();
  const von = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate(), ZEITPLAN.stundeVonUtc, 0));
  const bis = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate(), ZEITPLAN.stundeBisUtc, 60 - ZEITPLAN.minutenTakt));
  return `alle ${ZEITPLAN.minutenTakt} Minuten von ${uhrzeit(von)} bis ${uhrzeit(bis)} Uhr`;
}

export function starten(api, bereich) {
  bereich.replaceChildren();
  const zustand = element("p", { klasse: "status", attribute: { role: "status", "aria-live": "polite" } });
  const details = element("div", { klasse: "leise" });
  const schalter = knopf("…", () => umschalten());
  let aktiv = null;

  async function laden() {
    schalter.disabled = true;
    try {
      const pfad = api.repoPfad(`/actions/workflows/${encodeURIComponent(WORKFLOWS.agent)}`);
      const [workflow, laeufe] = await Promise.all([api.anfrage(pfad), letzteLaeufe(api, WORKFLOWS.agent, 1, "schedule")]);
      aktiv = workflow.state === "active";
      zustand.textContent = aktiv ? "Automatischer Lauf: AN" : "Automatischer Lauf: AUS";
      schalter.textContent = aktiv ? "Automatischen Lauf ausschalten" : "Automatischen Lauf einschalten";
      schalter.className = aktiv ? "knopf knopf-zweitrangig" : "knopf";
      const letzter = laeufe[0];
      const naechster = aktiv ? naechsterGeplanterLauf(new Date(), ZEITPLAN) : null;
      details.replaceChildren(
        element("p", { text: `Zeitplan: ${zeitfensterText()}.` }),
        element("p", {
          text: naechster
            ? `Nächster Lauf: ca. ${zeitDeutsch(naechster.toISOString())} (GitHub startet oft einige Minuten später).`
            : "Nächster Lauf: keiner, solange ausgeschaltet.",
        }),
        element("p", {
          text: letzter
            ? `Letzter geplanter Lauf: ${zeitDeutsch(letzter.created_at)} – ${laufStatusText(letzter)}.`
            : "Letzter geplanter Lauf: noch keiner.",
        }),
      );
      schalter.disabled = false;
    } catch (fehler) {
      zustand.textContent = fehler instanceof ApiFehler && fehler.status === 404
        ? "Der Workflow „Agent“ ist noch nicht in main (Ticket #14)."
        : fehler.message;
      details.replaceChildren();
    }
  }

  async function umschalten() {
    if (aktiv === null) return;
    if (aktiv && !confirm("Automatischen Lauf ausschalten? Neue Mails werden dann erst verarbeitet, wenn du ihn wieder einschaltest oder den Agent von Hand startest.")) return;
    schalter.disabled = true;
    try {
      const aktion = aktiv ? "disable" : "enable";
      await api.anfrage(api.repoPfad(`/actions/workflows/${encodeURIComponent(WORKFLOWS.agent)}/${aktion}`), { method: "PUT" });
    } catch (fehler) {
      zustand.textContent = fehler.message;
    }
    await laden();
  }

  bereich.append(element("h2", { text: "Zeitplan" }), zustand, schalter, details);
  laden();
}

export function stoppen() {}
