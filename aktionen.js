// Bausteine für die Bereiche: Workflows starten und abwarten, Dateien lesen/schreiben.
import { ApiFehler } from "./api.js?v=__VERSION__";
import { CACHE_BRANCH, HAUPT_BRANCH } from "./config.js?v=__VERSION__";
import { base64ZuText, textZuBase64 } from "./hilfen.js?v=__VERSION__";

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

// Startet einen Workflow (workflow_dispatch) und gibt den Startzeitpunkt zurück.
export async function workflowStarten(api, datei, inputs = {}, ref = HAUPT_BRANCH) {
  const start = new Date();
  await api.anfrage(api.repoPfad(`/actions/workflows/${encodeURIComponent(datei)}/dispatches`), {
    method: "POST",
    body: { ref, inputs },
  });
  return start;
}

export async function letzteLaeufe(api, datei, anzahl = 10, ereignis = "") {
  const filter = ereignis ? `&event=${encodeURIComponent(ereignis)}` : "";
  const daten = await api.anfrage(
    api.repoPfad(`/actions/workflows/${encodeURIComponent(datei)}/runs?per_page=${anzahl}${filter}`),
  );
  return (daten && daten.workflow_runs) || [];
}

// Wartet auf den Lauf, der nach `start` per Hand gestartet wurde, bis er fertig ist.
// beiStatus(lauf | null, sekunden) wird bei jeder Abfrage aufgerufen.
export async function aufLaufWarten(api, datei, start, { beiStatus = () => {}, takt = 4000, maxMs = 15 * 60000, warteFn = warte } = {}) {
  const grenze = start.getTime() - 10000; // Uhren können leicht abweichen
  const begonnen = Date.now();
  let lauf = null;
  while (Date.now() - begonnen < maxMs) {
    await warteFn(takt);
    const laeufe = await letzteLaeufe(api, datei, 5, "workflow_dispatch");
    const kandidat = lauf
      ? laeufe.find((l) => l.id === lauf.id)
      : laeufe.find((l) => new Date(l.created_at).getTime() >= grenze);
    if (kandidat) lauf = kandidat;
    beiStatus(lauf, Math.round((Date.now() - begonnen) / 1000));
    if (lauf && lauf.status === "completed") return lauf;
  }
  throw new ApiFehler("Der Lauf dauert ungewöhnlich lange. Bitte später neu laden.");
}

// Datei aus dem privaten Repo lesen: { text, sha } oder null, wenn es sie (noch) nicht gibt.
export async function dateiLesen(api, pfad, ref = HAUPT_BRANCH) {
  try {
    const daten = await api.anfrage(
      api.repoPfad(`/contents/${pfad.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`),
    );
    return { text: base64ZuText(daten.content), sha: daten.sha };
  } catch (fehler) {
    if (fehler instanceof ApiFehler && fehler.status === 404) return null;
    throw fehler;
  }
}

export async function cacheJsonLesen(api, name) {
  const datei = await dateiLesen(api, name, CACHE_BRANCH);
  if (!datei) return null;
  try {
    return JSON.parse(datei.text);
  } catch {
    return null;
  }
}

// Datei schreiben (Commit). sha = Stand beim Laden; hat sich die Datei inzwischen geändert,
// lehnt GitHub ab (409) – dann wird nichts überschrieben.
export async function dateiSchreiben(api, pfad, text, sha, nachricht, branch = HAUPT_BRANCH) {
  return api.anfrage(api.repoPfad(`/contents/${pfad.split("/").map(encodeURIComponent).join("/")}`), {
    method: "PUT",
    body: { message: nachricht, content: textZuBase64(text), sha, branch },
  });
}

// Kleine DOM-Helfer (nur textContent, nie innerHTML).
export function element(tag, { text, klasse, attribute } = {}, kinder = []) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (klasse) el.className = klasse;
  for (const [k, v] of Object.entries(attribute || {})) el.setAttribute(k, v);
  for (const kind of kinder) if (kind) el.append(kind);
  return el;
}

export function knopf(text, beiKlick, klasse = "knopf") {
  const b = element("button", { text, klasse, attribute: { type: "button" } });
  b.addEventListener("click", beiKlick);
  return b;
}
