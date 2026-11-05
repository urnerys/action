import assert from "node:assert/strict";
import { test } from "node:test";

import { exportVariable, getInput, mask, run } from "../lib/actions.mjs";
import { projectName, request, resolveHost } from "../lib/urnerys.mjs";
import { captureLog, setupEnv, stubFetch } from "./support.mjs";

test("getInput reads INPUT_ variables and keeps hyphens", (t) => {
  setupEnv(t, { INPUT_HOST: "  a.example  ", "INPUT_SOME-THING": "x" });

  assert.equal(getInput("host"), "a.example");
  assert.equal(getInput("some-thing"), "x");
  assert.equal(getInput("missing"), "");
});

test("exportVariable appends to GITHUB_ENV", (t) => {
  const readEnv = setupEnv(t);

  exportVariable("A", "1");
  exportVariable("B", "2");

  assert.equal(readEnv(), "A=1\nB=2\n");
});

test("exportVariable and mask reject values with a newline or no value", (t) => {
  const readEnv = setupEnv(t);
  captureLog(t);

  assert.throws(() => exportVariable("A", "x\nB=y"), /single-line/);
  assert.throws(() => exportVariable("A", ""), /single-line/);
  assert.throws(() => mask("x\ny"), /single-line/);
  assert.throws(() => mask(""), /single-line/);
  assert.equal(readEnv(), "");
});

test("exportVariable requires GITHUB_ENV", (t) => {
  setupEnv(t);
  delete process.env.GITHUB_ENV;

  assert.throws(() => exportVariable("A", "1"), /GITHUB_ENV/);
});

test("run does not run an entry point which was not started directly", async (t) => {
  setupEnv(t);
  let called = false;

  await run(
    () => {
      called = true;
    },
    "file:///somewhere/else.mjs",
  );

  assert.equal(called, false);
});

test("resolveHost prefers the input over the environment", (t) => {
  setupEnv(t, { INPUT_HOST: "input.example", URNERYS_HOST: "env.example" });

  assert.equal(resolveHost(), "input.example");
});

test("resolveHost falls back to URNERYS_HOST", (t) => {
  setupEnv(t, { URNERYS_HOST: "env.example" });

  assert.equal(resolveHost(), "env.example");
});

test("resolveHost has no default", (t) => {
  setupEnv(t);

  assert.throws(() => resolveHost(), /URNERYS_HOST/);
});

test("resolveHost rejects a scheme or path", (t) => {
  setupEnv(t, { INPUT_HOST: "https://a.example" });

  assert.throws(() => resolveHost(), /without scheme or path/);
});

test("projectName is the repository name without the owner", (t) => {
  setupEnv(t, { GITHUB_REPOSITORY: "owner/name" });

  assert.equal(projectName(), "name");
});

test("projectName requires GITHUB_REPOSITORY", (t) => {
  setupEnv(t);

  assert.throws(() => projectName(), /GITHUB_REPOSITORY/);
});

test("request sends JSON with a bearer token and parses the response", async (t) => {
  const calls = stubFetch(t, () => ({ body: { ok: true } }));

  const result = await request("POST", "https://a.example/x", { token: "tok", json: { a: 1 } });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.Authorization, "Bearer tok");
  assert.equal(calls[0].headers["Content-Type"], "application/json");
  assert.equal(calls[0].body, '{"a":1}');
});

test("request sends a form body", async (t) => {
  const calls = stubFetch(t, () => ({ body: {} }));

  await request("POST", "https://a.example/x", { form: { a: "1 2", b: "&" } });

  assert.ok(calls[0].body instanceof URLSearchParams);
  assert.equal(calls[0].body.toString(), "a=1+2&b=%26");
});

test("request returns undefined for an empty response", async (t) => {
  stubFetch(t, () => ({ status: 204 }));

  assert.equal(await request("PUT", "https://a.example/x"), undefined);
});

test("request fails with the status and body, without the query of the URL", async (t) => {
  stubFetch(t, () => ({ status: 403, body: { error: "denied" } }));

  await assert.rejects(
    request("GET", "https://a.example/x?secret=1"),
    (error) => {
      assert.match(error.message, /GET \/x failed with status 403: \{"error":"denied"\}/);
      assert.doesNotMatch(error.message, /secret/);
      return true;
    },
  );
});

test("the entry points fail the step with an error annotation when started directly", async () => {
  const { spawnSync } = await import("node:child_process");

  for (const [entry, message] of [
    ["login/index.mjs", /No Urnerys host/],
    ["finalize/index.mjs", /URNERYS_TOKEN is not set/],
  ]) {
    const file = new URL(`../${entry}`, import.meta.url).pathname;
    const res = spawnSync(process.execPath, [file], { env: { PATH: process.env.PATH }, encoding: "utf8" });

    assert.equal(res.status, 1, entry);
    assert.match(res.stdout, /^::error::/, entry);
    assert.match(res.stdout, message, entry);
  }
});
