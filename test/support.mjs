import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const AMBIENT = /^(INPUT_|URNERYS_|ACTIONS_ID_TOKEN_|GITHUB_ENV$|GITHUB_REPOSITORY$|BUILDID$)/;

/*
 * Replace the environment variables the actions read by `env` for the duration
 * of the test, so that the tests behave the same inside and outside of a
 * GitHub Actions job. Also provides an empty file for GITHUB_ENV, which
 * `readGithubEnv` returns the content of.
 */
export function setupEnv(t, env = {}) {
  const saved = { ...process.env };

  for (const key of Object.keys(process.env)) {
    if (AMBIENT.test(key)) {
      delete process.env[key];
    }
  }

  const dir = mkdtempSync(join(tmpdir(), "urnerys-action-test-"));
  const githubEnv = join(dir, "env");
  writeFileSync(githubEnv, "");

  Object.assign(process.env, { GITHUB_ENV: githubEnv }, env);

  t.after(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, saved);
    rmSync(dir, { recursive: true, force: true });
  });

  return () => readFileSync(githubEnv, "utf8");
}

/*
 * Replace `fetch` for the duration of the test. The handler receives the URL
 * and request init and returns `{ status?, body? }`, where body is an object
 * which is sent as JSON. Returns the list of requests made.
 */
export function stubFetch(t, handler) {
  const calls = [];

  t.mock.method(globalThis, "fetch", async (url, init = {}) => {
    calls.push({ url: String(url), ...init });
    const { status = 200, body } = await handler(String(url), init);
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  });

  return calls;
}

/* Capture what is written with console.log, one entry per call. */
export function captureLog(t) {
  const log = t.mock.method(console, "log", () => {});
  return () => log.mock.calls.map((call) => call.arguments.join(" "));
}
