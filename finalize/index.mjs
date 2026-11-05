import { getInput, run } from "../lib/actions.mjs";
import { api, exchangeToken, projectName } from "../lib/urnerys.mjs";

export async function main() {
  const mode = getInput("mode");
  if (mode !== "check" && mode !== "promote") {
    throw new Error(`Unknown mode "${mode}". Use "check" or "promote".`);
  }

  const baselineName = getInput("baseline");
  const baseline = encodeURIComponent(baselineName);
  const project = encodeURIComponent(getInput("project") || projectName());

  const buildId = getInput("build") || process.env.URNERYS_BUILD_ID;
  if (!buildId) {
    throw new Error("No build. Set the `build` input or the URNERYS_BUILD_ID environment variable.");
  }
  const build = encodeURIComponent(buildId);

  const token = await exchangeToken();

  const result =
    mode === "check"
      ? await api("POST", `/projects/${project}/builds/${build}/checks`, {
          token,
          json: { check: { baseline: baselineName } },
        })
      : await api("PATCH", `/projects/${project}/baselines/${baseline}`, {
          token,
          json: { baseline: { build: buildId } },
        });

  console.log(`${mode} of build ${buildId} against baseline ${baselineName} succeeded.`);
  if (result !== undefined) {
    console.log(JSON.stringify(result));
  }
}

run(main, import.meta.url);
