/*
 * The small part of the runner protocol that the actions in this repository
 * need. It is written out by hand so that the actions have no dependencies and
 * do not need a build step.
 */

import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/*
 * Read an input of the action. The runner passes inputs as `INPUT_<NAME>`
 * environment variables: the name is uppercased and spaces become underscores,
 * hyphens are kept. An input which is not set is the empty string.
 */
export function getInput(name) {
  return (process.env[`INPUT_${name.replaceAll(" ", "_").toUpperCase()}`] ?? "").trim();
}

function assertSingleLine(what, value) {
  if (typeof value !== "string" || value === "" || /[\r\n]/.test(value)) {
    throw new Error(`${what} must be a non-empty single-line string.`);
  }
}

/* Redact the value from the log of all following steps of the job. */
export function mask(value) {
  assertSingleLine("A masked value", value);
  console.log(`::add-mask::${value}`);
}

function appendToCommandFile(variable, name, value) {
  assertSingleLine(`The value of ${name}`, value);

  const file = process.env[variable];
  if (!file) {
    throw new Error(`${variable} is not set. This code must run as part of a GitHub Actions job.`);
  }

  appendFileSync(file, `${name}=${value}\n`);
}

/* Make the variable available to all following steps of the job. */
export function exportVariable(name, value) {
  appendToCommandFile("GITHUB_ENV", name, value);
}

/* Set an output of the step, which other steps and jobs can refer to. */
export function setOutput(name, value) {
  appendToCommandFile("GITHUB_OUTPUT", name, value);
}

function escapeData(s) {
  return s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

/*
 * Run the entry point of an action. An error fails the step with an annotation.
 *
 * The entry point only runs if its module is the one that was started. This
 * allows the tests to import the module without running it.
 */
export async function run(main, moduleUrl) {
  if (process.argv[1] === undefined || pathToFileURL(process.argv[1]).href !== moduleUrl) {
    return;
  }

  try {
    await main();
  } catch (error) {
    console.log(`::error::${escapeData(error instanceof Error ? error.message : String(error))}`);
    process.exitCode = 1;
  }
}
