import assert from "node:assert/strict";
import { test } from "node:test";

import { main } from "../finalize/index.mjs";
import { captureLog, setupEnv, stubFetch } from "./support.mjs";

const ENV = {
  URNERYS_TOKEN: "access-secret",
  URNERYS_HOST: "urnerys.example",
  GITHUB_REPOSITORY: "owner/some-project",
  BUILDID: "build-1",
  INPUT_MODE: "check",
  INPUT_BASELINE: "production",
};

test("check creates a check against the baseline", async (t) => {
  setupEnv(t, ENV);
  captureLog(t);
  const calls = stubFetch(t, () => ({ body: { state: "pending" } }));

  await main();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "https://urnerys.example/api/v1/projects/some-project/builds/build-1/checks");
  assert.equal(calls[0].headers.Authorization, "Bearer access-secret");
  assert.deepEqual(JSON.parse(calls[0].body), { check: { baseline: "production" } });
});

test("promote moves the baseline to the build", async (t) => {
  setupEnv(t, { ...ENV, INPUT_MODE: "promote" });
  captureLog(t);
  const calls = stubFetch(t, () => ({ body: {} }));

  await main();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, "https://urnerys.example/api/v1/projects/some-project/baselines/production");
  assert.deepEqual(JSON.parse(calls[0].body), { baseline: { build: "build-1" } });
});

test("inputs take precedence and are encoded in the path", async (t) => {
  setupEnv(t, {
    ...ENV,
    INPUT_HOST: "other.example",
    INPUT_PROJECT: "my project",
    INPUT_BUILD: "a/b",
    INPUT_BASELINE: "release",
  });
  captureLog(t);
  const calls = stubFetch(t, () => ({ body: {} }));

  await main();

  assert.equal(calls[0].url, "https://other.example/api/v1/projects/my%20project/builds/a%2Fb/checks");
  assert.deepEqual(JSON.parse(calls[0].body), { check: { baseline: "release" } });
});

test("requires the token of the login action", async (t) => {
  setupEnv(t, ENV);
  delete process.env.URNERYS_TOKEN;
  const calls = stubFetch(t, () => ({ body: {} }));

  await assert.rejects(main(), /Run the login action/);
  assert.equal(calls.length, 0);
});

test("rejects an unknown mode", async (t) => {
  setupEnv(t, { ...ENV, INPUT_MODE: "seal" });
  const calls = stubFetch(t, () => ({ body: {} }));

  await assert.rejects(main(), /Unknown mode "seal"/);
  assert.equal(calls.length, 0);
});

test("requires a build", async (t) => {
  setupEnv(t, ENV);
  delete process.env.BUILDID;
  const calls = stubFetch(t, () => ({ body: {} }));

  await assert.rejects(main(), /BUILDID/);
  assert.equal(calls.length, 0);
});

test("fails with the response of a rejected request", async (t) => {
  setupEnv(t, ENV);
  stubFetch(t, () => ({ status: 409, body: { error: "conflict" } }));

  await assert.rejects(main(), /POST \/api\/v1\/projects\/some-project\/builds\/build-1\/checks failed with status 409/);
});
