import { getInput, run } from "../lib/actions.mjs";
import { api, projectName } from "../lib/urnerys.mjs";

export async function main() {
  const token = process.env.URNERYS_TOKEN;
  if (!token) {
    throw new Error("URNERYS_TOKEN is not set. Run the login action before this one.");
  }

  const mode = getInput("mode");
  const baseline = encodeURIComponent(getInput("baseline"));
  const project = encodeURIComponent(getInput("project") || projectName());

  const buildId = getInput("build") || process.env.BUILDID;
  if (!buildId) {
    throw new Error("No build. Set the `build` input or the BUILDID environment variable.");
  }
  const build = encodeURIComponent(buildId);

  let result;

  switch (mode) {
    case "check":
      result = await api("POST", `/projects/${project}/builds/${build}/checks`, {
        token,
        json: { check: { baseline: getInput("baseline") } },
      });
      break;

    case "promote":
      result = await api("PATCH", `/projects/${project}/baselines/${baseline}`, {
        token,
        json: { baseline: { build: buildId } },
      });
      break;

    default:
      throw new Error(`Unknown mode "${mode}". Use "check" or "promote".`);
  }

  console.log(`${mode} of build ${buildId} against baseline ${getInput("baseline")} succeeded.`);
  if (result !== undefined) {
    console.log(JSON.stringify(result));
  }
}

run(main, import.meta.url);
