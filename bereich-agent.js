// Bereich „Agent“: jetzt ausführen, Testlauf ohne Filter, letzte Läufe mit Ergebnis (#27).
import { ApiFehler } from "./api.js?v=__VERSION__";
import { WORKFLOWS } from "./config.js?v=__VERSION__";
import { aufLaufWarten, cacheJsonLesen, element, knopf, letzteLaeufe, workflowStarten } from "./aktionen.js?v=__VERSION__";
import { ergebnisText, laeufeNachId, laufArtText, laufStatusText, zeitDeutsch } from "./hilfen.js?v=__VERSION__";

let timer = null;
let aktiv = false;

export function starten(api, bereich) {
  aktiv = true;
  bereich.replaceChildren();
  const status = element("p", { klasse: "status", attribute: { role: "status", "aria-live": "polite" } });
  const liste = element("ul", { klasse: "liste" });

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
      laden();
    }
  }

  bereich.append(
    element("h2", { text: "Agent starten & Status" }),
    knopf("Agent jetzt ausführen", () => ausfuehren(false)),
    knopf("Testlauf ohne Absenderfilter", () => ausfuehren(true), "knopf knopf-zweitrangig"),
    status,
    element("div", { klasse: "zeile" }, [
      element("h3", { text: "Letzte Läufe" }),
      knopf("Aktualisieren", () => laden(), "knopf knopf-leise"),
    ]),
    liste,
  );
  laden();
}

export function stoppen() {
  aktiv = false;
  clearTimeout(timer);
}
