import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const envFile = path.resolve(".env.local");
const managedKeys = [
  "LOCAL_NETLIFY_IDENTITY_ORIGIN",
  "LOCAL_NETLIFY_ONLINE_DATA",
];

function runNetlify(args) {
  const result = spawnSync("npx", ["netlify-cli", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || "Unbekannter Fehler";
    throw new Error(`Netlify-CLI ist fehlgeschlagen. ${detail}`);
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("Netlify-CLI hat keine gültige JSON-Antwort zurückgegeben.");
  }
}

function deployedAt(deploy) {
  const value = deploy.published_at ?? deploy.created_at;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Deploy ${deploy.id ?? "unbekannt"} hat keinen gültigen Zeitstempel.`);
  }
  return timestamp;
}

function isHttpsOrigin(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

function selectLatestDeploy(deploys) {
  const candidates = deploys.filter((deploy) =>
    deploy.state === "ready" &&
    (deploy.context === "deploy-preview" ||
      (deploy.context === "production" && deploy.branch === "main")),
  );

  if (candidates.length === 0) {
    throw new Error("Kein erfolgreicher Deploy-Preview oder Main-Deploy gefunden.");
  }

  return candidates.sort((left, right) => deployedAt(right) - deployedAt(left))[0];
}

function originForDeploy(deploy) {
  const origin = deploy.context === "production"
    ? deploy.ssl_url
    : deploy.deploy_ssl_url;

  if (!isHttpsOrigin(origin)) {
    throw new Error(`Deploy ${deploy.id ?? "unbekannt"} enthält keine gültige HTTPS-URL.`);
  }
  return new URL(origin).origin;
}

function updateEnv(contents, values) {
  const managedPattern = new RegExp(`^(?:${managedKeys.join("|")})=`);
  const retainedLines = contents
    .split(/\r?\n/)
    .filter((line) => !managedPattern.test(line))
    .filter((line, index, lines) => !(line === "" && index === lines.length - 1));
  const managedLines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  return [...retainedLines, ...managedLines, ""].join("\n");
}

async function main() {
  const status = runNetlify(["status", "--json"]);
  if (!status.loggedIn || !status.linked || !status.siteData?.["site-id"]) {
    throw new Error("Zuerst npx netlify-cli login und npx netlify-cli link ausführen.");
  }

  const deploys = runNetlify([
    "api",
    "listSiteDeploys",
    "--data",
    JSON.stringify({ site_id: status.siteData["site-id"], per_page: 100 }),
  ]);
  if (!Array.isArray(deploys)) {
    throw new Error("Die Netlify-Deploy-Liste hat ein ungültiges Format.");
  }

  const deploy = selectLatestDeploy(deploys);
  const origin = originForDeploy(deploy);
  let current = "";
  try {
    current = await readFile(envFile, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await writeFile(envFile, updateEnv(current, {
    LOCAL_NETLIFY_IDENTITY_ORIGIN: origin,
    LOCAL_NETLIFY_ONLINE_DATA: "true",
  }), "utf8");

  const target = deploy.context === "production" ? "main" : `Preview ${deploy.branch}`;
  console.log(`${target}: ${origin}`);
  console.log(`Aktualisiert: ${path.basename(envFile)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
