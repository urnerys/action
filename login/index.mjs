import { exportVariable, mask, run } from "../lib/actions.mjs";
import { api, request, resolveHost } from "../lib/urnerys.mjs";

export async function main() {
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
  exportVariable("URNERYS_TOKEN", access.access_token);
}

run(main, import.meta.url);
