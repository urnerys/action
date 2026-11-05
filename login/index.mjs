import { exportVariable, run } from "../lib/actions.mjs";
import { exchangeToken } from "../lib/urnerys.mjs";

export async function main() {
  exportVariable("URNERYS_TOKEN", await exchangeToken());
}

run(main, import.meta.url);
