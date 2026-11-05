import { getInput, mask } from "./actions.mjs";

/*
 * The host of the Urnerys instance. The `host` input takes precedence over the
 * URNERYS_HOST environment variable, which can be set for the whole workflow.
 * There is deliberately no default. The value is a hostname, without scheme.
 */
export function resolveHost() {
  const host = getInput("host") || process.env.URNERYS_HOST;

  if (!host) {
    throw new Error("No Urnerys host. Set the `host` input or the URNERYS_HOST environment variable.");
  }

  if (host.includes("/")) {
    throw new Error(`Invalid Urnerys host "${host}". Pass a hostname without scheme or path.`);
  }

  return host;
}

/* The name of the repository (without the owner), the default project name. */
export function projectName() {
  const name = process.env.GITHUB_REPOSITORY?.split("/")[1];

  if (!name) {
    throw new Error("GITHUB_REPOSITORY is not set. Pass the project explicitly.");
  }

  return name;
}

/*
 * Send an HTTP request and return the parsed JSON response, or `undefined` if
 * the response has no body. Any other status than 2xx is an error which
 * includes the status and body of the response.
 */
export async function request(method, url, { token, json, form } = {}) {
  const headers = {};
  let body;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  if (form !== undefined) {
    /* The content type of a URLSearchParams body is set by fetch. */
    body = new URLSearchParams(form);
  }

  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`${method} ${new URL(url).pathname} failed with status ${res.status}: ${text}`);
  }

  return text === "" ? undefined : JSON.parse(text);
}

/* Send a request to the API of the Urnerys instance, `path` is relative to `/api/v1`. */
export function api(method, path, options) {
  return request(method, `https://${resolveHost()}/api/v1${path}`, options);
}

/*
 * Exchange the OIDC token of the job for an access token of the Urnerys
 * instance (RFC 8693). Both tokens are masked in the log.
 */
export async function exchangeToken() {
  const host = resolveHost();

  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!requestUrl || !requestToken) {
    throw new Error("The job cannot request an OIDC token. Grant the job the `id-token: write` permission.");
  }

  const url = new URL(requestUrl);
  url.searchParams.set("audience", `https://${host}`);

  const oidc = await request("GET", url, { token: requestToken });
  if (typeof oidc?.value !== "string") {
    throw new Error("GitHub did not return an OIDC token.");
  }
  mask(oidc.value);

  const access = await api("POST", "/token", {
    form: {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: oidc.value,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    },
  });
  if (typeof access?.access_token !== "string") {
    throw new Error("Urnerys did not return an access token.");
  }
  mask(access.access_token);

  return access.access_token;
}
