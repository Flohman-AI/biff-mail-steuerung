// Bereich „Agent“: jetzt ausführen, Testlauf ohne Filter, letzte Läufe mit Ergebnis (#27).
import { ApiFehler } from "./api.js?v=__VERSION__";
import { WORKFLOWS } from "./config.js?v=__VERSION__";
import { aufLaufWarten, cacheJsonLesen, element, knopf, letzteLaeufe, workflowPruefen, workflowStarten } from "./aktionen.js?v=__VERSION__";
import { ergebnisText, laeufeNachId, laufArtText, laufStatusText, zeitDeutsch } from "./hilfen.js?v=__VERSION__";

let timer = null;
let aktiv = false;

export function starten(api, bereich) {
  aktiv = true;
  bereich.replaceChildren();
  const status = element("p", { klasse: "status", attribute: { role: "status", "aria-live": "polite" } });
  const liste = element("ul", { klasse: "liste" });
  const zustand = element("p", { klasse: "hinweis-box", attribute: { role: "status", hidden: "" } });
  const zeitplan = element("p", { klasse: "leise" });
  const startKnoepfe = [];

  async function zustandPruefen() {
    const { kannStarten, zustand: stand } = await workflowPruefen(api, WORKFLOWS.agent, "Agent", zustand);
    zeitplan.textContent = stand ? `Zeitplan: ${stand === "active" ? "an" : "aus"}` : "";
    for (const b of startKnoepfe) b.disabled = !kannStarten;
    return kannStarten;
  }

  async function laden() {
    clearTimeout(timer);
    try {
      const [laeufe, cache] = await Promise.all([
        letzteLaeufe(api, WORKFLOWS.agent, 10),
        cacheJsonLesen(api, "laeufe.json"),
      ]);
      zeigen(laeufe, laeufeNachId(cache));
      if (aktiv && laeufe.some((l) => l.status !== "completed")) timer = setTimeout(laden, 15000);
    } catch (fehler) {
      liste.replaceChildren();
      status.textContent = fehler instanceof ApiFehler && fehler.status === 404
        ? "Der Workflow „Agent“ ist noch nicht in main (Ticket #14)."
        : fehler.message;
    }
  }

  function zeigen(laeufe, ergebnisse) {
    if (!laeufe.length) {
      liste.replaceChildren(element("li", { text: "Noch keine Läufe.", klasse: "leise" }));
      return;
    }
    liste.replaceChildren(...laeufe.map((lauf) => {
      const statusText = laufStatusText(lauf);
      const zahlen = ergebnisText(ergebnisse.get(String(lauf.id)));
      const link = element("a", { text: "Log", attribute: { href: lauf.html_url, target: "_blank", rel: "noopener noreferrer" } });
      return element("li", { klasse: "eintrag" }, [
        element("div", { klasse: "eintrag-kopf" }, [
          element("span", { text: zeitDeutsch(lauf.created_at) }),
          element("span", { text: statusText, klasse: `marke marke-${lauf.conclusion || lauf.status}` }),
        ]),
        element("div", { klasse: "leise", text: `${laufArtText(lauf.event)}${zahlen ? " · " + zahlen : ""}` }),
        link,
      ]);
    }));
  }

  async function ausfuehren(ohneFilter) {
    if (ohneFilter && !confirm("Testlauf OHNE Absenderfilter: Alle Mails in ai_queue werden verarbeitet. Fortfahren?")) return;
    if (!(await zustandPruefen())) return;
    for (const b of bereich.querySelectorAll("button")) b.disabled = true;
    try {
      const start = await workflowStarten(api, WORKFLOWS.agent, { ohne_filter: ohneFilter ? "true" : "false" });
      status.textContent = "Gestartet …";
      const lauf = await aufLaufWarten(api, WORKFLOWS.agent, start, {
        beiStatus: (l, s) => {
          status.textContent = `${l ? laufStatusText(l) : "Wird gestartet"} … ${s} s`;
          if (l) laden();
        },
      });
      status.textContent = `Lauf ${laufStatusText(lauf)}.`;
    } catch (fehler) {
      status.textContent = fehler.message;
    } finally {
      for (const b of bereich.querySelectorAll("button")) b.disabled = false;
      zustandPruefen();
      laden();
    }
  }

  const jetzt = knopf("Agent jetzt ausführen", () => ausfuehren(false));
  const test = knopf("Testlauf ohne Absenderfilter", () => ausfuehren(true), "knopf knopf-zweitrangig");
  startKnoepfe.push(jetzt, test);

  bereich.append(
    element("h2", { text: "Agent starten & Status" }),
    zeitplan,
    zustand,
    jetzt,
    test,
    status,
    element("div", { klasse: "zeile" }, [
      element("h3", { text: "Letzte Läufe" }),
      knopf("Aktualisieren", () => laden(), "knopf knopf-leise"),
    ]),
    liste,
  );
  zustandPruefen();
  laden();
}

export function stoppen() {
  aktiv = false;
  clearTimeout(timer);
}
