// @vitest-environment node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../scripts/netlify-blob-transfer.ts", import.meta.url));
const timestamp = "2026-11-19T21-17-30.211Z";
const newerTimestamp = "2026-11-20T13-58-19.330Z";
const directories = [];

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

async function fixture(modules = '{"modules":[],"questions":[]}') {
  const root = await mkdtemp(path.join(os.tmpdir(), "blob-restore-test-"));
  directories.push(root);
  const archive = path.join(root, "data", "blob-archive", timestamp);
  const newerArchive = path.join(root, "data", "blob-archive", newerTimestamp);
  const snapshot = path.join(root, "data", "blob-snapshot");
  await mkdir(archive, { recursive: true });
  await mkdir(newerArchive, { recursive: true });
  await mkdir(snapshot, { recursive: true });
  await writeFile(path.join(archive, "contributions.json"), '[{"id":"backup"}]\n');
  await writeFile(path.join(archive, "modules.json"), modules);
  await writeFile(path.join(newerArchive, "contributions.json"), '[{"id":"newer"}]\n');
  await writeFile(path.join(newerArchive, "modules.json"), '{"modules":[],"questions":[]}');
  await writeFile(path.join(snapshot, "contributions.json"), '[{"id":"local"}]\n');
  await writeFile(path.join(snapshot, "modules.json"), '{"local":true}\n');
  return { root, snapshot };
}

function runRestore(root, confirmation) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", script, "restore"], {
      cwd: root,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let selected = false;
    let confirmed = false;
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (!selected && stdout.includes("Backup auswählen")) {
        selected = true;
        child.stdin.write("\u001b[B");
        setTimeout(() => child.stdin.write("\r"), 50);
      }
      if (!confirmed && stdout.includes("[y/N]")) {
        confirmed = true;
        child.stdin.end(`${confirmation}\n`);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

describe("Blob-Backup wiederherstellen", () => {
  it("stellt beide ausgewählten Dateien erst nach Bestätigung unverändert wieder her", async () => {
    const { root, snapshot } = await fixture();
    const result = await runRestore(root, "y");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Die Cloud wurde nicht geändert");
    expect(result.stdout).toContain(newerTimestamp);
    expect(result.stdout).toContain(timestamp);
    expect(await readFile(path.join(snapshot, "contributions.json"), "utf8"))
      .toBe('[{"id":"backup"}]\n');
    expect(await readFile(path.join(snapshot, "modules.json"), "utf8"))
      .toBe('{"modules":[],"questions":[]}');
  });

  it.each([
    ["abgelehnter Bestätigung", '{"modules":[],"questions":[]}', "n"],
    ["ungültiger Moduldatei", '{"modules":[]}', ""],
  ])("überschreibt bei %s keinen Snapshot", async (_description, modules, confirmation) => {
    const { root, snapshot } = await fixture(modules);
    const result = await runRestore(root, confirmation);
    expect(result.status).not.toBe(0);
    expect(await readFile(path.join(snapshot, "contributions.json"), "utf8"))
      .toBe('[{"id":"local"}]\n');
    expect(await readFile(path.join(snapshot, "modules.json"), "utf8"))
      .toBe('{"local":true}\n');
  });
});
