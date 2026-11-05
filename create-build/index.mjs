import { exportVariable, getInput, run, setOutput } from "../lib/actions.mjs";
import { api, projectName } from "../lib/urnerys.mjs";

export async function main() {
  const token = process.env.URNERYS_TOKEN;
  if (!token) {
    throw new Error("URNERYS_TOKEN is not set. Run the login action before this one.");
  }

  const { GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT } = process.env;
  if (!GITHUB_RUN_ID || !GITHUB_RUN_ATTEMPT) {
    throw new Error("GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT are not set. This code must run as part of a GitHub Actions job.");
  }

  const id = `github-run-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}`;
  const project = encodeURIComponent(getInput("project") || projectName());
  const commit = getInput("commit") || process.env.GITHUB_SHA;

  await api("POST", `/projects/${project}/builds`, {
    token,
    json: { id, build: { origin: commit ? { commit } : undefined } },
  });

  setOutput("build", id);
  exportVariable("URNERYS_BUILD_ID", id);

  console.log(`Created build ${id}.`);
}

run(main, import.meta.url);
