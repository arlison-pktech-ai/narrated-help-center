#!/usr/bin/env node
// Copies the help toolkit into a project:
//   node <skill>/scripts/scaffold.mjs [--dir scripts/help] [--update]
// lib/ is the shared toolkit (replaced by --update); the templates (config,
// content, Playwright fixtures and specs, README) are copied only when absent,
// because they become the project's own files. Also adds the output folder to
// .gitignore and the npm scripts, when missing; `help:stills` follows
// `app.phone` of the project's help.config.mjs (run --update after changing it).
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name, fallback) => { const at = args.indexOf(name); return at > -1 && args[at + 1] ? args[at + 1] : fallback; };
const root = path.resolve(option("--root", process.cwd()));
const dir = option("--dir", "scripts/help");
const target = path.resolve(root, dir);
const update = args.includes("--update");
const done = [];

if (!existsSync(path.join(root, "package.json"))) {
  console.error(`No package.json in ${root}. Run from the project root (or pass --root), after \`npm init -y\` if the project has none.`);
  process.exit(1);
}

// Phone pictures only when the app works on phones (app.phone, true until the
// project's help.config.mjs says otherwise): without it the playwright config
// defines no "phone" project, and naming it is an error.
let phone = true;
const configFile = path.join(target, "help.config.mjs");
if (existsSync(configFile)) {
  try {
    phone = (await import(pathToFileURL(configFile).href)).default?.app?.phone !== false;
  } catch (error) {
    console.warn(`Could not read ${dir}/help.config.mjs (${error.message}); assuming app.phone: true.`);
  }
}

await mkdir(target, { recursive: true });
const lib = path.join(target, "lib");
if (!existsSync(lib) || update) {
  await cp(path.join(skill, "toolkit/lib"), lib, { recursive: true, force: true });
  done.push(`${update ? "updated" : "added"} ${path.relative(root, lib)}/`);
}
for (const file of await readdir(path.join(skill, "toolkit/templates"))) {
  const destination = path.join(target, file);
  if (existsSync(destination) || (file === "phone.spec.mjs" && !phone)) continue;
  await cp(path.join(skill, "toolkit/templates", file), destination);
  done.push(`added ${path.relative(root, destination)}`);
}

// The generated files stay out of git.
const ignore = path.join(root, ".gitignore");
const ignored = existsSync(ignore) ? readFileSync(ignore, "utf8") : "";
if (!/^\/?\.help-center\/?$/m.test(ignored)) {
  await writeFile(ignore, `${ignored}${ignored && !ignored.endsWith("\n") ? "\n" : ""}.help-center/\n`);
  done.push("added .help-center/ to .gitignore");
}

// npm scripts, without touching existing ones, except a help:stills this
// script wrote for the other phone setting.
const pkgFile = path.join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
const config = `${dir}/playwright.config.mjs`;
const stills = (withPhone) => `playwright test -c ${config} --project=stills${withPhone ? " --project=phone" : ""} && node ${dir}/lib/build.mjs`;
const scripts = {
  help: `playwright test -c ${config} && node ${dir}/lib/encode.mjs && node ${dir}/lib/covers.mjs && node ${dir}/lib/build.mjs`,
  "help:stills": stills(phone),
  "help:videos": `playwright test -c ${config} --project=videos && node ${dir}/lib/encode.mjs && node ${dir}/lib/covers.mjs && node ${dir}/lib/build.mjs`,
  "help:build": `node ${dir}/lib/build.mjs`,
};
pkg.scripts ||= {};
const added = Object.entries(scripts).filter(([name]) => !pkg.scripts[name]);
for (const [name, command] of added) pkg.scripts[name] = command;
const switched = pkg.scripts["help:stills"] === stills(!phone);
if (switched) pkg.scripts["help:stills"] = stills(phone);
if (added.length || switched) await writeFile(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
if (added.length) done.push(`added npm scripts: ${added.map(([name]) => name).join(", ")}`);
if (switched) done.push(`help:stills now ${phone ? "includes" : "skips"} the phone pictures (app.phone: ${phone})`);

const deps = { ...pkg.dependencies, ...pkg.devDependencies };
console.log(done.length ? done.map((line) => `• ${line}`).join("\n") : "Nothing to do: the toolkit is already here (use --update to refresh lib/).");
console.log(`
Next:
  ${deps["@playwright/test"] ? "✓ @playwright/test is installed" : "npm i -D @playwright/test && npx playwright install chromium"}
  ${deps["ffmpeg-static"] ? "✓ ffmpeg-static is installed" : "ffmpeg with libx264 on the PATH, or: npm i -D ffmpeg-static"}
  Fill ${dir}/help.config.mjs, ${dir}/support.mjs and the webServer of ${config}.
  Write ${dir}/content.mjs and the specs (stills, phone, videos), then: npm run help`);
