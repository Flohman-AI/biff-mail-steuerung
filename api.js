// Kleiner Wrapper für authentifizierte Aufrufe der GitHub-API.
// Der Token wird nur im Authorization-Header verwendet: nie geloggt, nie in URLs,
// nie in Fehlermeldungen.
import { API_BASIS, REPO } from "./config.js?v=__VERSION__";

export class ApiFehler extends Error {
  constructor(nachricht, status = 0) {
    super(nachricht);
    this.name = "ApiFehler";
    this.status = status;
  }
}

function uhrzeit(sekunden) {
  const d = new Date(Number(sekunden) * 1000);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

// Übersetzt eine fehlgeschlagene Antwort in eine verständliche Meldung.
export function fehlerText(status, kopf = new Headers()) {
  if (status === 401) return "Token ungültig oder abgelaufen. Bitte neu anmelden.";
  if ((status === 403 || status === 429) && kopf.get("x-ratelimit-remaining") === "0") {
    const reset = kopf.get("x-ratelimit-reset");
    return "Zu viele Anfragen an GitHub." + (reset ? ` Wieder möglich ab ${uhrzeit(reset)} Uhr.` : "");
  }
  if (status === 403) return "Keine Berechtigung. Hat der Token die nötigen Rechte?";
  if (status === 404) return `Nicht gefunden. Hat der Token Zugriff auf ${REPO.name}?`;
  if (status === 409) return "Konflikt: Die Daten wurden inzwischen geändert. Bitte neu laden.";
  if (status === 422) return "GitHub hat die Anfrage abgelehnt (ungültige Angaben).";
  if (status >= 500) return "GitHub ist gerade nicht erreichbar. Bitte später erneut versuchen.";
  return `Unerwartete Antwort von GitHub (${status}).`;
}

export class GitHubApi {
  constructor(token, { fetchFn } = {}) {
    if (!token) throw new ApiFehler("Kein Token angegeben.");
    // Privat halten, damit der Token nicht versehentlich mit ausgegeben wird.
    const geheim = String(token).trim();
    this._kopf = () => ({
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${geheim}`,
      "X-GitHub-Api-Version": "2022-11-28",
    });
    this._fetch = fetchFn || ((...args) => globalThis.fetch(...args));
  }

  // pfad relativ zur API, z. B. "/repos/x/y". Gibt JSON zurück (oder null bei 204).
  async anfrage(pfad, { method = "GET", body } = {}) {
    if (!pfad.startsWith("/")) throw new ApiFehler("Ungültiger API-Pfad.");
    const optionen = { method, headers: this._kopf(), cache: "no-store" };
    if (body !== undefined) {
      optionen.headers["Content-Type"] = "application/json";
      optionen.body = JSON.stringify(body);
    }
    let antwort;
    try {
      antwort = await this._fetch(API_BASIS + pfad, optionen);
    } catch {
      throw new ApiFehler("Keine Verbindung zu GitHub. Internet prüfen.");
    }
    if (!antwort.ok) throw new ApiFehler(fehlerText(antwort.status, antwort.headers), antwort.status);
    if (antwort.status === 204) return null;
    return antwort.json();
  }

  // Pfad im Repo biff-mail-agent, z. B. repoPfad("/actions/runs").
  repoPfad(rest = "") {
    return `/repos/${encodeURIComponent(REPO.besitzer)}/${encodeURIComponent(REPO.name)}${rest}`;
  }

  // Prüft den Token: Zugriff auf das Repo muss möglich sein.
  async repoPruefen() {
    return this.anfrage(this.repoPfad());
  }
}
