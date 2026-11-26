// Ablauf der Steuerseite: Anmeldung, Abmeldung, Bereiche umschalten.
// Inhalte werden nur per textContent gesetzt (nie innerHTML), damit nichts eingeschleust wird.
import { SPEICHER_SCHLUESSEL, VERSION } from "./config.js?v=__VERSION__";
import { neueVersionVerfuegbar, versionAnzeige } from "./hilfen.js?v=__VERSION__";
import { ApiFehler, GitHubApi } from "./api.js?v=__VERSION__";
import * as bereichAgent from "./bereich-agent.js?v=__VERSION__";
import * as bereichZeitplan from "./bereich-zeitplan.js?v=__VERSION__";
import * as bereichGedaechtnis from "./bereich-gedaechtnis.js?v=__VERSION__";
import * as bereichEntwuerfe from "./bereich-entwuerfe.js?v=__VERSION__";
import * as bereichAufgaben from "./bereich-aufgaben.js?v=__VERSION__";

const el = (id) => document.getElementById(id);

// Aktuelle API-Instanz nach erfolgreicher Anmeldung.
export let api = null;

// Bereiche: Element-ID → Modul mit starten(api, element) und stoppen().
const BEREICHE = {
  "bereich-agent": bereichAgent,
  "bereich-zeitplan": bereichZeitplan,
  "bereich-gedaechtnis": bereichGedaechtnis,
  "bereich-entwuerfe": bereichEntwuerfe,
  "bereich-aufgaben": bereichAufgaben,
};

function bereicheStarten() {
  for (const [id, modul] of Object.entries(BEREICHE)) modul.starten(api, el(id));
}

function bereicheStoppen() {
  for (const [id, modul] of Object.entries(BEREICHE)) {
    modul.stoppen();
    el(id).replaceChildren(); // geladene Daten nach dem Abmelden nicht stehen lassen
  }
}

function tokenLesen() {
  return localStorage.getItem(SPEICHER_SCHLUESSEL) || sessionStorage.getItem(SPEICHER_SCHLUESSEL) || "";
}

function tokenSpeichern(token, merken) {
  tokenLoeschen();
  (merken ? localStorage : sessionStorage).setItem(SPEICHER_SCHLUESSEL, token);
}

function tokenLoeschen() {
  localStorage.removeItem(SPEICHER_SCHLUESSEL);
  sessionStorage.removeItem(SPEICHER_SCHLUESSEL);
}

function meldung(text) {
  const feld = el("anmelde-meldung");
  feld.textContent = text || "";
  feld.hidden = !text;
}

function anmeldungZeigen(text = "") {
  if (api) bereicheStoppen();
  api = null;
  el("app").hidden = true;
  el("abmelden").hidden = true;
  el("anmeldung").hidden = false;
  el("token").value = "";
  meldung(text);
}

function appZeigen(repo) {
  el("anmeldung").hidden = true;
  el("app").hidden = false;
  el("abmelden").hidden = false;
  el("repo-info").textContent = `Verbunden mit ${repo.full_name}${repo.private ? " (privat)" : ""}.`;
  meldung("");
}

async function anmelden(token, merken, { still = false } = {}) {
  const knopf = el("anmelde-formular").querySelector("button[type=submit]");
  knopf.disabled = true;
  try {
    const neueApi = new GitHubApi(token);
    const repo = await neueApi.repoPruefen();
    if (!still) tokenSpeichern(token, merken);
    api = neueApi;
    appZeigen(repo);
    bereicheStarten();
  } catch (fehler) {
    if (fehler instanceof ApiFehler && (fehler.status === 401 || fehler.status === 404)) tokenLoeschen();
    anmeldungZeigen(fehler instanceof ApiFehler ? fehler.message : "Anmeldung fehlgeschlagen.");
  } finally {
    knopf.disabled = false;
  }
}

function bereichZeigen(ziel) {
  for (const knopf of document.querySelectorAll(".reiter-knopf")) {
    const aktiv = knopf.dataset.ziel === ziel;
    if (aktiv) knopf.setAttribute("aria-current", "page");
    else knopf.removeAttribute("aria-current");
  }
  for (const bereich of document.querySelectorAll(".bereich")) {
    bereich.hidden = bereich.id !== ziel;
  }
}

// Prüft, ob nach dem Laden eine neuere Version veröffentlicht wurde (version.json, #36).
async function versionPruefen() {
  if (versionAnzeige(VERSION) === "dev") return;
  try {
    const antwort = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!antwort.ok) return;
    const daten = await antwort.json();
    el("neue-version").hidden = !neueVersionVerfuegbar(VERSION, daten && daten.version);
  } catch {
    // Keine Verbindung oder keine version.json: kein Hinweis, nichts kaputt machen.
  }
}

function start() {
  el("version").textContent = versionAnzeige(VERSION);
  el("neu-laden").addEventListener("click", () => {
    // Mit neuem Parameter laden, damit auch index.html nicht aus dem Cache kommt.
    location.href = `${location.pathname}?neu=${Date.now()}`;
  });
  versionPruefen();
  setInterval(versionPruefen, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) versionPruefen();
  });

  el("anmelde-formular").addEventListener("submit", (ereignis) => {
    ereignis.preventDefault();
    const token = el("token").value.trim();
    if (!token) {
      meldung("Bitte einen Token eingeben.");
      return;
    }
    anmelden(token, el("merken").checked);
  });

  el("abmelden").addEventListener("click", () => {
    tokenLoeschen();
    anmeldungZeigen("Abgemeldet.");
  });

  for (const knopf of document.querySelectorAll(".reiter-knopf")) {
    knopf.addEventListener("click", () => bereichZeigen(knopf.dataset.ziel));
  }

  const gespeichert = tokenLesen();
  if (gespeichert) anmelden(gespeichert, true, { still: true });
}

start();
