// Feste Einstellungen der Steuerseite. Keine Daten, keine Tokens.
export const REPO = Object.freeze({ besitzer: "Flohman-AI", name: "biff-mail-agent" });
export const API_BASIS = "https://api.github.com";
export const SPEICHER_SCHLUESSEL = "biff-steuerung-token";

// Workflows im Repo biff-mail-agent und der Daten-Branch für Status/Entwürfe.
export const WORKFLOWS = Object.freeze({
  agent: "agent.yml",
  entwuerfe: "entwuerfe.yml",
});
export const HAUPT_BRANCH = "main";
export const CACHE_BRANCH = "steuerung-cache";

// Zeitplan aus agent.yml: alle 20 Minuten, 05–21 Uhr UTC.
export const ZEITPLAN = Object.freeze({ minutenTakt: 20, stundeVonUtc: 5, stundeBisUtc: 21 });

// Wird beim Veröffentlichen (Workflow deploy.yml) durch den Kurz-Hash des Commits ersetzt.
// Lokal bleibt der Platzhalter stehen; die Seite zeigt dann „dev“.
export const VERSION = "__VERSION__";
