// @ts-check
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import starlight from "@astrojs/starlight";
import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
// @ts-ignore - rehype-katex liefert keine eigenen TS-Deklarationsdateien mit
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { ModuleArchiveSyncError, syncModuleArchivesAfterSave } from "./src/lib/module-archive.ts";

const MAX_LOCAL_REQUEST_BYTES = 500_000;
const LOCAL_MODULES_PATHS = new Set([
  "/api/modules",
  "/.netlify/functions/modules",
]);

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isLocalRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function sendLocalJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<string>}
 */
function readLocalRequestBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.byteLength;
      if (totalBytes > MAX_LOCAL_REQUEST_BYTES) {
        reject(new RangeError("Die Anfrage ist zu groß."));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * @param {URL} url
 * @param {Record<string, unknown> | null} body
 * @returns {{ entity: "module" | "question"; id: string } | null}
 */
function extractLocalDeleteTarget(url, body) {
  const entityParam =
    url.searchParams.get("entity") ??
    (typeof body?.entity === "string" ? body.entity : null);
  const questionId =
    url.searchParams.get("questionId") ??
    (typeof body?.questionId === "string" ? body.questionId : null);
  const moduleId =
    url.searchParams.get("moduleId") ??
    (typeof body?.moduleId === "string" ? body.moduleId : null);
  const genericId =
    url.searchParams.get("id") ?? (typeof body?.id === "string" ? body.id : null);

  if (entityParam === "question" || (entityParam !== "module" && questionId)) {
    const id = (questionId || genericId || "").trim();
    return id ? { entity: "question", id } : null;
  }

  const id = (moduleId || genericId || "").trim();
  return id ? { entity: "module", id } : null;
}

/**
 * Lokaler Dev-Endpunkt für `/api/modules` und `/.netlify/functions/modules`,
 * damit `npm run dev` direkt mit `data/modules.json` ohne Netlify-CLI funktioniert.
 */
function localModulesApiPlugin() {
  let writeQueue = Promise.resolve();

  return {
    name: "local-modules-api",
    /** @param {import("vite").ViteDevServer} server */
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!LOCAL_MODULES_PATHS.has(url.pathname)) {
          next();
          return;
        }

        const method = (req.method ?? "GET").toUpperCase();
        if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
          sendLocalJson(res, 405, {
            error: "Diese Methode wird nicht unterstützt.",
          });
          return;
        }

        try {
          const store =
            /** @type {typeof import("./src/lib/module-store.ts")} */ (
              await server.ssrLoadModule("/src/lib/module-store.ts")
            );
          const schema =
            /** @type {typeof import("./src/lib/module-schema.ts")} */ (
              await server.ssrLoadModule("/src/lib/module-schema.ts")
            );
          const dataFilePath = path.resolve(process.cwd(), "data/modules.json");

          const readDb = async () => {
            try {
              const raw = await readFile(dataFilePath, "utf8");
              const parsed = JSON.parse(raw);
              if (
                !isLocalRecord(parsed) ||
                !Array.isArray(parsed.modules) ||
                !Array.isArray(parsed.questions) ||
                (parsed.quizSettings !== undefined && !schema.isQuizSettings(parsed.quizSettings)) ||
                (parsed.learningConfig !== undefined && !schema.isLearningConfiguration(parsed.learningConfig))
              ) {
                throw new Error("Ungültiges Format in data/modules.json.");
              }
              return schema.normalizeLegacyDatabase(/** @type {import("./src/lib/module-schema.ts").ModulesDatabase} */ ({
                modules: parsed.modules,
                questions: parsed.questions,
                ...(parsed.quizSettings !== undefined ? { quizSettings: parsed.quizSettings } : {}),
                ...(parsed.learningConfig !== undefined ? { learningConfig: parsed.learningConfig } : {}),
              }));
            } catch (err) {
              if (
                isLocalRecord(err) &&
                err.code === "ENOENT"
              ) {
                return schema.normalizeLegacyDatabase(store.createEmptyModulesDatabase());
              }
              throw err;
            }
          };

          /** @param {import("./src/lib/module-schema.ts").ModulesDatabase} nextDb */
          const writeDb = async (nextDb) => {
            await mkdir(path.dirname(dataFilePath), { recursive: true });
            await writeFile(
              dataFilePath,
              `${JSON.stringify(nextDb, null, 2)}\n`,
              "utf8",
            );
            await syncModuleArchivesAfterSave(nextDb);
          };

          if (method === "GET") {
            sendLocalJson(res, 200, await readDb());
            return;
          }

          let bodyText = "";
          try {
            bodyText = await readLocalRequestBody(req);
          } catch (err) {
            if (err instanceof RangeError) {
              sendLocalJson(res, 413, { error: err.message });
              return;
            }
            throw err;
          }

          /** @type {Record<string, unknown> | null} */
          let parsedBody = null;
          if (bodyText.trim().length > 0) {
            /** @type {unknown} */
            let raw;
            try {
              raw = JSON.parse(bodyText);
            } catch {
              sendLocalJson(res, 400, {
                error: "Die Anfrage enthält kein gültiges JSON.",
              });
              return;
            }
            if (!isLocalRecord(raw)) {
              sendLocalJson(res, 400, {
                error: "Die Moduldaten sind ungültig.",
              });
              return;
            }
            parsedBody = raw;
          } else if (method !== "DELETE") {
            sendLocalJson(res, 400, {
              error: "Die Anfrage enthält kein gültiges JSON.",
            });
            return;
          }

          await new Promise((resolve, reject) => {
            writeQueue = writeQueue.then(async () => {
              if (method === "DELETE") {
                const target = extractLocalDeleteTarget(url, parsedBody);
                if (!target) {
                  sendLocalJson(res, 400, {
                    error: "Ungültige Lösch-Anfrage: ID fehlt.",
                  });
                  return;
                }
                const db = await readDb();
                if (target.entity === "question") {
                  if (!db.questions.some((q) => q.id === target.id)) {
                    sendLocalJson(res, 404, {
                      error: "Die Aufgabe wurde nicht gefunden.",
                    });
                    return;
                  }
                  await writeDb(store.deleteQuestion(db, target.id));
                  sendLocalJson(res, 200, {
                    message: "Aufgabe wurde gelöscht.",
                  });
                  return;
                }
                if (!db.modules.some((m) => m.id === target.id)) {
                  sendLocalJson(res, 404, {
                    error: "Das Modul wurde nicht gefunden.",
                  });
                  return;
                }
                await writeDb(store.deleteModule(db, target.id));
                sendLocalJson(res, 200, {
                  message: "Modul und zugehörige Aufgaben wurden gelöscht.",
                });
                return;
              }

              const body = parsedBody ?? {};
              if (body.entity === "quiz-settings") {
                if (method !== "PUT" || !schema.isQuizSettings(body.settings)) {
                  sendLocalJson(res, 400, { error: "Ungültige Quiz-Einstellungen." });
                  return;
                }
                const db = await readDb();
                if ((db.quizSettings ?? schema.DEFAULT_QUIZ_SETTINGS).revision !== body.settings.revision) {
                  sendLocalJson(res, 409, { error: "Die Einstellungen wurden zwischenzeitlich geändert. Bitte lade sie neu." });
                  return;
                }
                const nextDb = store.updateQuizSettings(db, body.settings);
                await writeDb(nextDb);
                sendLocalJson(res, 200, nextDb);
                return;
              }
              if (body.entity === "module-order") {
                if (
                  method !== "PUT" ||
                  typeof body.id !== "string" || !body.id.trim() ||
                  typeof body.neighborId !== "string" || !body.neighborId.trim() ||
                  (body.direction !== "up" && body.direction !== "down")
                ) {
                  sendLocalJson(res, 400, { error: "Ungültige Modulverschiebung." });
                  return;
                }
                const db = await readDb();
                const nextDb = store.moveModule(db, body.id.trim(), body.neighborId.trim(), body.direction);
                if (!nextDb) {
                  sendLocalJson(res, 409, { error: "Die Modulreihenfolge wurde geändert. Bitte lade die Übersicht neu." });
                  return;
                }
                await writeDb(nextDb);
                sendLocalJson(res, 200, nextDb);
                return;
              }
              if (
                body.entity !== undefined &&
                body.entity !== "module" &&
                body.entity !== "question"
              ) {
                sendLocalJson(res, 400, { error: "Ungültiger Entity-Typ." });
                return;
              }

              const isPost = method === "POST";
              const isQuestion =
                body.entity === "question" ||
                (body.entity === undefined && isLocalRecord(body.question));

              const db = await readDb();

              if (isQuestion) {
                const rawQuestion = isLocalRecord(body.question)
                  ? body.question
                  : body;
                if (
                  rawQuestion.id !== undefined &&
                  (typeof rawQuestion.id !== "string" || !rawQuestion.id.trim())
                ) {
                  sendLocalJson(res, 400, {
                    error: "Aufgaben-ID darf nicht leer sein.",
                  });
                  return;
                }

                const questionPayload =
                  isPost && rawQuestion.id === undefined
                    ? { ...rawQuestion, id: randomUUID() }
                    : rawQuestion;

                const validation = store.validateQuestionInput(
                  questionPayload,
                  db.modules,
                );
                if (!validation.valid) {
                  sendLocalJson(res, 400, {
                    error: validation.errors.join(" "),
                  });
                  return;
                }

                const typedQuestion =
                  /** @type {import("./src/lib/module-store.ts").UpsertQuestionInput} */ (
                    questionPayload
                  );
                const nextDb = store.upsertQuestion(db, typedQuestion);
                await writeDb(nextDb);
                const savedQuestion = nextDb.questions.find(
                  (item) => item.id === String(questionPayload.id).trim(),
                );
                sendLocalJson(res, isPost ? 201 : 200, {
                  message: isPost
                    ? "Aufgabe wurde gespeichert."
                    : "Aufgabe wurde aktualisiert.",
                  question: savedQuestion,
                });
                return;
              }

              const rawModule = isLocalRecord(body.module) ? body.module : body;
              const validation = store.validateModuleInput(rawModule);
              if (!validation.valid) {
                sendLocalJson(res, 400, {
                  error: validation.errors.join(" "),
                });
                return;
              }

              const typedModule =
                /** @type {import("./src/lib/module-store.ts").UpsertModuleInput} */ (
                  rawModule
                );
              let nextDb;
              try {
                nextDb = store.upsertModuleWithExercises(db, typedModule, body.exercises, body.exerciseRoleChanges);
              } catch (error) {
                if (!(error instanceof store.ModuleExerciseSaveError)) throw error;
                sendLocalJson(res, 400, { error: error.message });
                return;
              }
              await writeDb(nextDb);
              const savedModule = nextDb.modules.find(
                (item) => item.id === String(rawModule.id).trim(),
              );
              sendLocalJson(res, isPost ? 201 : 200, {
                message: isPost
                  ? "Modul wurde gespeichert."
                  : "Modul wurde aktualisiert.",
                module: savedModule,
                ...(body.exercises !== undefined || body.exerciseRoleChanges !== undefined ? { questions: nextDb.questions } : {}),
              });
            }).then(resolve, reject);
          });
        } catch (error) {
          console.error("Fehler im lokalen Modul-API-Endpunkt:", error);
          sendLocalJson(res, 500, {
            error: error instanceof ModuleArchiveSyncError
              ? error.message
              : "Die Moduldaten konnten lokal nicht verarbeitet werden.",
          });
        }
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: "http://localhost:8888",
  output: "static",
  markdown: {
    processor: unified({
      // @ts-ignore - Behebt die Diskrepanz zwischen unist-Node und mdast-Root
      remarkPlugins: [remarkMath],
      // @ts-ignore
      rehypePlugins: [rehypeKatex],
    }),
  },
  vite: {
    plugins: process.env.NETLIFY_DEV === "true" ? [] : [localModulesApiPlugin()],
    build: {
      chunkSizeWarningLimit: 1500, // Erhöht das Warnlimit von 500 kB auf 1500 kB
    },
  },
  integrations: [
    starlight({
      title: "Mein Musik-Hub",
      disable404Route: true,
      locales: {
        root: {
          label: "Deutsch",
          lang: "de",
        },
      },
      defaultLocale: "root",
      customCss: [
        "/src/styles/sidebar.css",
        "/src/styles/wide-content.css",
        "katex/dist/katex.min.css",
      ],
      components: {
        Header: "./src/components/starlight/Header.astro",
        MarkdownContent: "./src/components/starlight/MarkdownContent.astro",
      },
      sidebar: [
        {
          label: "Admin",
          items: [
            { label: "Konten & Einladungen", link: "/admin/konten/" },
            { label: "Beiträge", slug: "projektierung/beitraege" },
            { label: "Modul-Builder", slug: "projektierung/modul-builder" },
            { label: "Modularchiv", link: "/module-archives/" },
            { label: "Admin-Wiki", link: "/admin-wiki/" },
          ],
        },
        {
          label: "Bediener",
          items: [
            {
              label: "Dashboard",
              slug: "audio/theory/lernpfad",
            },
            {
              label: "Humpa-Shop",
              slug: "audio/theory/shop",
            },
            {
              label: "Inventar",
              slug: "audio/theory/inventar",
            },
            {
              label: "Studio",
              slug: "audio/theory/studio",
            },
          ],
        },
        {
          label: "Sonstiges",
          items: [
            {
              label: "Wiki",
              items: [
                { label: "Lernkonto & Synchronisierung", slug: "wiki/lernstand-konto" },
                { label: "Beiträge verwalten", slug: "wiki/beitraege" },
                { label: "Modul-Builder bedienen", slug: "wiki/modul-builder" },
                { label: "NotationBuilder bedienen", slug: "wiki/notation-builder" },
                { label: "Drum-Pattern anhören", slug: "wiki/drum-pattern" },
                { label: "Inventar und Shop benutzen", slug: "wiki/inventar" },
              ],
            },
            {
              label: "Lehrgänge (Level 100-500)",
              collapsed: true,
              items: [
                {
                  label: "Level 100: Elementarlehre",
                  collapsed: false,
                  items: [{ autogenerate: { directory: "audio/theory/100-general" } }],
                },
                                {
                  label: "Level 110: Gitarrenlehre",
                  collapsed: false,
                  items: [{ autogenerate: { directory: "audio/theory/101-guitar" } }],
                },
                {
                  label: "Level 200: Harmonie & Akkorde",
                  collapsed: false,
                  items: [{ autogenerate: { directory: "audio/theory/200" } }],
                },
                {
                  label: "Level 300: Multi-Instrumentierung",
                  collapsed: true,
                  items: [{ autogenerate: { directory: "audio/theory/300" } }],
                },
                {
                  label: "Level 400: DAW & Produktion",
                  collapsed: true,
                  items: [{ autogenerate: { directory: "audio/theory/400" } }],
                },
                {
                  label: "Level 500: Band & Performance",
                  collapsed: true,
                  items: [{ autogenerate: { directory: "audio/theory/500" } }],
                },
              ],
            },
            {
              label: "Songwriting",
              collapsed: true,
              items: [
                {
                  label: "Projekt: Rock-Arrangement",
                  collapsed: true,
                  items: [
                    {
                      label: "Schritt 0: Komposition",
                      slug: "audio/songwriting/rock-komposition",
                    },
                    {
                      label: "Schritt 1: Produktion (Refrain)",
                      slug: "audio/songwriting/rock-produktion",
                    },
                    {
                      label: "Schritt 2: Songstruktur",
                      slug: "audio/songwriting/rock-songstruktur",
                    },
                    {
                      label: "Schritt 3: Produktion (Strophe & Vor-Refrain)",
                      slug: "audio/songwriting/rock-produktion2",
                    },
                    {
                      label:
                        "Schritt 4: Produktion (Strophe 2 & Vor-Refrain 2)",
                      slug: "audio/songwriting/rock-produktion3",
                    },
                    {
                      label: "Schritt 5: Produktion (Bridge, Finale & Intro)",
                      slug: "audio/songwriting/rock-produktion4",
                    },
                  ],
                },
              ],
            },
            {
              label: "Referenz & Werkzeuge",
              collapsed: true,
              items: [
                {
                  label: "Audio-Hardware",
                  slug: "audio/referenzen-werkzeuge/hardware",
                },
                {
                  label: "Features",
                  collapsed: true,
                  items: [
                    {
                      label: "Übersicht",
                      slug: "audio/referenzen-werkzeuge/visualisierungen-erklaert",
                    },
                    {
                      label: "Notation.astro",
                      slug: "audio/referenzen-werkzeuge/visualisierungen-erklaert/notensystem",
                    },
                    {
                      label: "NotationBuilder.astro",
                      slug: "audio/referenzen-werkzeuge/visualisierungen-erklaert/notationbuilder",
                    },
                  ],
                },
                {
                  label: "Akkordmuster",
                  slug: "audio/referenzen-werkzeuge/akkordmuster",
                },
                {
                  label: "EXP und Tags",
                  slug: "audio/referenzen-werkzeuge/exp-und-tags",
                },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
