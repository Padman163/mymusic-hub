import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const cliPath = require.resolve("@lhci/cli/src/cli.js");
const result = spawnSync(
  process.execPath,
  [cliPath, ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath(),
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(
    `Lighthouse CI konnte nicht gestartet werden: ${result.error.message}`,
  );
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
