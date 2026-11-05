import assert from "node:assert/strict";
import { test } from "node:test";

import { main } from "../login/index.mjs";
import { captureLog, setupEnv, stubFetch } from "./support.mjs";

const OIDC_ENV = {
  ACTIONS_ID_TOKEN_REQUEST_URL: "https://actions.example/token?api-version=2",
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-token",
};

function backend(t, { exchange } = {}) {
  return stubFetch(t, (url) => {
    if (url.startsWith("https://actions.example/")) {
      return { body: { value: "oidc-jwt" } };
    }

    if (url === "https://urnerys.example/api/v1/token") {
      return exchange ?? { body: { access_token: "access-secret" } };
    }

    return { status: 404 };
  });
}

test("exchanges the OIDC token and exports URNERYS_TOKEN", async (t) => {
  const readEnv = setupEnv(t, { ...OIDC_ENV, INPUT_HOST: "urnerys.example" });
  const log = captureLog(t);
  const calls = backend(t);

  await main();

  assert.equal(
    calls[0].url,
    "https://actions.example/token?api-version=2&audience=https%3A%2F%2Furnerys.example",
  );
  assert.equal(calls[0].headers.Authorization, "Bearer request-token");

  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].url, "https://urnerys.example/api/v1/token");
  assert.equal(calls[1].body.get("grant_type"), "urn:ietf:params:oauth:grant-type:token-exchange");
  assert.equal(calls[1].body.get("subject_token"), "oidc-jwt");
  assert.equal(calls[1].body.get("subject_token_type"), "urn:ietf:params:oauth:token-type:id_token");

  assert.equal(readEnv(), "URNERYS_TOKEN=access-secret\n");
  assert.deepEqual(log(), ["::add-mask::oidc-jwt", "::add-mask::access-secret"]);
});

test("takes the host from URNERYS_HOST", async (t) => {
  const readEnv = setupEnv(t, { ...OIDC_ENV, URNERYS_HOST: "urnerys.example" });
  captureLog(t);
  backend(t);

  await main();

  assert.equal(readEnv(), "URNERYS_TOKEN=access-secret\n");
});

test("does not export the host", async (t) => {
  const readEnv = setupEnv(t, { ...OIDC_ENV, INPUT_HOST: "urnerys.example" });
  captureLog(t);
  backend(t);

  await main();

  assert.doesNotMatch(readEnv(), /URNERYS_HOST/);
});

test("fails without a host", async (t) => {
  setupEnv(t, OIDC_ENV);
  const calls = backend(t);

  await assert.rejects(main(), /URNERYS_HOST/);
  assert.equal(calls.length, 0);
});

test("explains the missing permission when the job cannot request an OIDC token", async (t) => {
  setupEnv(t, { INPUT_HOST: "urnerys.example" });
  const calls = backend(t);

  await assert.rejects(main(), /id-token: write/);
  assert.equal(calls.length, 0);
});

test("fails with the response of a rejected token exchange and exports nothing", async (t) => {
  const readEnv = setupEnv(t, { ...OIDC_ENV, INPUT_HOST: "urnerys.example" });
  captureLog(t);
  backend(t, { exchange: { status: 400, body: { error: "invalid_grant" } } });

  await assert.rejects(main(), /POST \/api\/v1\/token failed with status 400: \{"error":"invalid_grant"\}/);
  assert.equal(readEnv(), "");
});

test("fails if the exchange response has no access token", async (t) => {
  const readEnv = setupEnv(t, { ...OIDC_ENV, INPUT_HOST: "urnerys.example" });
  captureLog(t);
  backend(t, { exchange: { body: {} } });

  await assert.rejects(main(), /did not return an access token/);
  assert.equal(readEnv(), "");
});
