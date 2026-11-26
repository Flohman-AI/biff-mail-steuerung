// Tests für api.js: node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiFehler, GitHubApi, fehlerText } from "../api.js";

const TOKEN = "github_pat_TESTTOKEN123";

function antwort(status, daten = {}, kopf = {}) {
  return { ok: status >= 200 && status < 300, status, headers: new Headers(kopf), json: async () => daten };
}

test("repoPruefen ruft das richtige Repo mit Bearer-Token auf", async () => {
  const aufrufe = [];
  const api = new GitHubApi(TOKEN, {
    fetchFn: async (url, optionen) => { aufrufe.push({ url, optionen }); return antwort(200, { full_name: "Flohman-AI/biff-mail-agent" }); },
  });
  const repo = await api.repoPruefen();
  assert.equal(repo.full_name, "Flohman-AI/biff-mail-agent");
  assert.equal(aufrufe[0].url, "https://api.github.com/repos/Flohman-AI/biff-mail-agent");
  assert.equal(aufrufe[0].optionen.headers.Authorization, `Bearer ${TOKEN}`);
  assert.ok(!aufrufe[0].url.includes(TOKEN));
});

for (const [status, kopf, erwartet] of [
  [401, {}, /ungültig oder abgelaufen/],
  [403, {}, /Keine Berechtigung/],
  [403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1767225600" }, /Zu viele Anfragen/],
  [404, {}, /Zugriff auf biff-mail-agent/],
  [409, {}, /Konflikt/],
  [502, {}, /nicht erreichbar/],
]) {
  test(`Fehler ${status} wird verständlich übersetzt, ohne Token`, async () => {
    const api = new GitHubApi(TOKEN, { fetchFn: async () => antwort(status, {}, kopf) });
    await assert.rejects(api.repoPruefen(), (fehler) => {
      assert.ok(fehler instanceof ApiFehler);
      assert.equal(fehler.status, status);
      assert.match(fehler.message, erwartet);
      assert.ok(!fehler.message.includes(TOKEN));
      return true;
    });
  });
}

test("Netzwerkfehler ergibt verständliche Meldung", async () => {
  const api = new GitHubApi(TOKEN, { fetchFn: async () => { throw new TypeError(`fetch failed ${TOKEN}`); } });
  await assert.rejects(api.repoPruefen(), (fehler) => {
    assert.match(fehler.message, /Keine Verbindung/);
    assert.ok(!fehler.message.includes(TOKEN));
    return true;
  });
});

test("POST sendet JSON, 204 ergibt null", async () => {
  let gesendet;
  const api = new GitHubApi(TOKEN, { fetchFn: async (url, o) => { gesendet = o; return antwort(204); } });
  const ergebnis = await api.anfrage(api.repoPfad("/actions/workflows/x.yml/dispatches"), { method: "POST", body: { ref: "main" } });
  assert.equal(ergebnis, null);
  assert.equal(gesendet.body, JSON.stringify({ ref: "main" }));
  assert.equal(gesendet.headers["Content-Type"], "application/json");
});

test("ohne Token und mit ungültigem Pfad: Fehler", async () => {
  assert.throws(() => new GitHubApi(""), ApiFehler);
  const api = new GitHubApi(TOKEN, { fetchFn: async () => antwort(200) });
  await assert.rejects(api.anfrage("https://evil.example/"), ApiFehler);
});

test("fehlerText kennt unbekannte Status", () => {
  assert.match(fehlerText(418), /418/);
});
