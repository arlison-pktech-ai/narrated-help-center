#!/usr/bin/env node
// The narration of the tutorial videos: every caption and card read aloud.
// Providers: "elevenlabs" (final quality; ELEVENLABS_API_KEY), "system" (the
// computer's own voice: macOS `say` or espeak-ng; free, for drafts) and "off".
// HELP_VOICE overrides config.narration.provider for one run.
// Clips stay in <outDir>/voice, named after the provider, voice, model, seed
// and text, so recording again costs nothing: only a new or changed sentence
// is requested.
//
//   node lib/voice.mjs --sample "A sentence in the product's language."
//   node lib/voice.mjs --voices        voices of the ElevenLabs account (of the computer with HELP_VOICE=system)
//   node lib/voice.mjs --credits       ElevenLabs characters used and left this period
//   node lib/voice.mjs --estimate      ElevenLabs characters still to synthesize (after a silent run)
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, OUT, VOICE } from "./config.mjs";

const OFF = ["", "0", "off", "none", "false"];
const setting = process.env.HELP_VOICE ?? config.narration.provider ?? "off";
export const PROVIDER = OFF.includes(String(setting).toLowerCase()) ? null : String(setting).toLowerCase();
export const NARRATION = !!PROVIDER;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const KEY = () => process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_LABS_API_KEY || process.env.XI_API_KEY;

// What the narrator says: the caption without the step label and the markup,
// a stop after titles, and the words written one way and said another.
export function spoken(...parts) {
  const text = parts.filter(Boolean)
    .map((part) => String(part).replace(/<span class="step">.*?<\/span>/g, "").replace(/\*\*/g, "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((part) => /[.!?…:]$/.test(part) ? part : `${part}.`)
    .join(" ");
  return (config.pronunciation || []).reduce((result, [pattern, words]) => result.replace(pattern, words), text);
}

// Sentences end at a stop followed by a space or the end of the text.
export const sentences = (text) => String(text).split(/(?<=[.!?…])\s+/);

function identity(provider = PROVIDER) {
  const n = config.narration;
  return provider === "elevenlabs"
    ? { provider, voice: n.voice, model: n.model, seed: n.seed, settings: n.settings || null }
    : { provider, voice: n.systemVoice || null, rate: n.systemRate || null };
}
const clipName = (text, provider) => createHash("sha1").update(JSON.stringify([identity(provider), text])).digest("hex").slice(0, 20);
export const isCached = (text, provider = PROVIDER) => existsSync(path.join(VOICE, `${clipName(text, provider)}.json`));

// The clip of a text: the audio file, its length and when each sentence ends,
// in seconds.
export async function speak(text) {
  if (!PROVIDER) throw Error("Narration is off.");
  const name = clipName(text, PROVIDER), about = path.join(VOICE, `${name}.json`);
  if (existsSync(about)) {
    const info = JSON.parse(await readFile(about, "utf8"));
    return { ...info, file: path.join(VOICE, info.file), cached: true };
  }
  await mkdir(VOICE, { recursive: true });
  const result = PROVIDER === "elevenlabs" ? await eleven(text) : PROVIDER === "system" ? system(text, name) : null;
  if (!result) throw Error(`Unknown narration provider "${PROVIDER}". Use elevenlabs, system or off.`);
  const file = `${name}${result.ext}`;
  // Written whole before its description: a clip listed is always complete.
  await writeFile(path.join(VOICE, `${file}.tmp`), result.audio);
  await rename(path.join(VOICE, `${file}.tmp`), path.join(VOICE, file));
  const info = { text, file, seconds: result.seconds, ends: result.ends, provider: PROVIDER, characters: text.length, created: new Date().toISOString() };
  await writeFile(about, JSON.stringify(info));
  return { ...info, file: path.join(VOICE, file), cached: false };
}

async function eleven(text) {
  const key = KEY(), n = config.narration;
  if (!key) throw Error("Narration: set ELEVENLABS_API_KEY, use HELP_VOICE=system for a free draft voice, or HELP_VOICE=off.");
  if (!n.voice) throw Error("Narration: choose a voice in help.config.mjs (narration.voice). List them with: node lib/voice.mjs --voices");
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${n.voice}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: n.model, seed: n.seed, ...(n.settings ? { voice_settings: n.settings } : {}) }),
    });
    if (response.ok) {
      const data = await response.json();
      // The alignment has the time of every character read.
      const said = data.alignment.characters.join(""), times = data.alignment.character_end_times_seconds;
      let cursor = 0;
      const ends = sentences(said).map((sentence) => {
        const start = said.indexOf(sentence, cursor);
        const end = start < 0 ? Math.min(said.length, cursor + sentence.length) - 1 : start + sentence.length - 1;
        cursor = end + 1;
        return times[Math.max(0, Math.min(times.length - 1, end))];
      });
      return { audio: Buffer.from(data.audio_base64, "base64"), ext: ".mp3", seconds: times.at(-1), ends };
    }
    const detail = (await response.text()).slice(0, 300);
    // Too many requests at once (videos record in parallel) or a busy server.
    if ((response.status === 429 || response.status >= 500) && attempt < 6) { await wait(1500 * attempt); continue; }
    throw Error(`Narration: ElevenLabs answered ${response.status} for "${text}": ${detail}`);
  }
}

// The computer's voice, for drafts: no timing per character, so each sentence
// gets a share of the clip proportional to its length.
function system(text, name) {
  const wav = path.join(VOICE, `${name}.draft.wav`), n = config.narration;
  let run;
  if (process.platform === "darwin") {
    run = spawnSync("say", [...(n.systemVoice ? ["-v", n.systemVoice] : []), ...(n.systemRate ? ["-r", String(n.systemRate)] : []), "--file-format=WAVE", "--data-format=LEI16@22050", "-o", wav, text], { encoding: "utf8" });
  } else {
    const espeak = ["espeak-ng", "espeak"].find((bin) => spawnSync(bin, ["--version"]).status === 0);
    if (!espeak) throw Error("Narration: no system voice. Install espeak-ng or use HELP_VOICE=off.");
    run = spawnSync(espeak, [...(n.systemVoice ? ["-v", n.systemVoice] : []), ...(n.systemRate ? ["-s", String(n.systemRate)] : []), "-w", wav, text], { encoding: "utf8" });
  }
  if (run.status !== 0) throw Error(`Narration: the system voice failed: ${run.stderr || run.error}`);
  const audio = readFileSync(wav);
  unlinkSync(wav);
  const seconds = wavSeconds(audio);
  const parts = sentences(text), total = parts.reduce((sum, part) => sum + part.length, 0) || 1;
  let sum = 0;
  const ends = parts.map((part) => (sum += part.length) / total * seconds);
  return { audio, ext: ".wav", seconds, ends };
}

function wavSeconds(buffer) {
  const rate = buffer.readUInt32LE(28);
  for (let at = 12; at < buffer.length - 8;) {
    const id = buffer.toString("latin1", at, at + 4), size = buffer.readUInt32LE(at + 4);
    if (id === "data") return size / rate;
    at += 8 + size + (size % 2);
  }
  return (buffer.length - 44) / rate;
}

// The texts each video asked for, written by director.mjs at the end of a
// recording (also with narration off), for --estimate.
export const SCRIPTS = path.join(OUT, "narration");

async function main(args) {
  if (args[0] === "--sample") {
    const text = args.slice(1).join(" ") || "This is the voice of the tutorials. Click Save to finish.";
    const clip = await speak(spoken(text));
    const target = path.join(OUT, `voice-sample${path.extname(clip.file)}`);
    await copyFile(clip.file, target);
    console.log(`${PROVIDER} voice: ${target} (${clip.seconds.toFixed(1)} s${clip.cached ? ", from the cache" : `, ${clip.characters} characters`})`);
    return;
  }
  if (args[0] === "--voices" && (PROVIDER === "system" || args[1] === "system")) {
    // The computer's voices, those of the help's language first.
    const code = (config.language || "en").toLowerCase().replace("-", "_"), base = code.split("_")[0];
    const list = process.platform === "darwin"
      ? spawnSync("say", ["-v", "?"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean)
      : (spawnSync("espeak-ng", ["--voices"], { encoding: "utf8" }).stdout || "").split("\n").slice(1).filter(Boolean);
    // "pt-BR" lists the Brazilian voices; "en" every English one.
    const mine = list.filter((line) => { const text = line.toLowerCase().replace(/-/g, "_"); return code.includes("_") ? text.includes(code) : text.includes(` ${base}_`); });
    console.log((mine.length ? mine : list).join("\n"));
    console.log(`\n${mine.length ? `${mine.length} voices for ${config.language}` : `${list.length} voices`}. Set narration.systemVoice to the name (first column).`);
    return;
  }
  if (args[0] === "--voices") {
    if (!KEY()) throw Error("Set ELEVENLABS_API_KEY first, or list the computer's voices: HELP_VOICE=system node lib/voice.mjs --voices");
    const response = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY() } });
    if (!response.ok) throw Error(`ElevenLabs answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const { voices } = await response.json();
    for (const voice of voices) console.log(`${voice.voice_id}  ${voice.name}  ${Object.values(voice.labels || {}).join(", ")}  [${voice.category}]`);
    console.log(`\n${voices.length} voices in this account. More in the ElevenLabs Voice Library (add one to the account, then use its id).`);
    return;
  }
  if (args[0] === "--credits") {
    if (!KEY()) throw Error("Set ELEVENLABS_API_KEY first.");
    const response = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": KEY() } });
    if (response.status === 401 && /user_read/.test(await response.clone().text())) throw Error("This API key cannot read the subscription (it lacks the User → Read permission). See the balance at elevenlabs.io, in Subscription, or use a key with that permission.");
    if (!response.ok) throw Error(`ElevenLabs answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const plan = await response.json();
    const reset = plan.next_character_count_reset_unix ? new Date(plan.next_character_count_reset_unix * 1000).toISOString().slice(0, 10) : "?";
    console.log(`ElevenLabs: ${plan.character_count} of ${plan.character_limit} characters used, ${plan.character_limit - plan.character_count} left (resets ${reset}).`);
    return;
  }
  if (args[0] === "--estimate") {
    // What the paid voice would cost; drafts with the computer's voice are free.
    const provider = args[1] || "elevenlabs";
    if (!existsSync(SCRIPTS)) throw Error("Record the videos once with HELP_VOICE=off first: it writes the narration texts without spending anything.");
    let missing = 0, cached = 0, videos = 0;
    for (const file of (await readdir(SCRIPTS)).filter((name) => name.endsWith(".json")).sort()) {
      const texts = JSON.parse(await readFile(path.join(SCRIPTS, file), "utf8"));
      const left = texts.filter((text) => !isCached(text, provider)).reduce((sum, text) => sum + text.length, 0);
      const done = texts.filter((text) => isCached(text, provider)).reduce((sum, text) => sum + text.length, 0);
      console.log(`${file.replace(/\.json$/, "")}: ${left} characters to synthesize, ${done} cached`);
      missing += left; cached += done; videos++;
    }
    console.log(`\n${videos} videos with ${provider}: ${missing} characters to synthesize, ${cached} already cached.`);
    return;
  }
  if (args[0] === "--clear-drafts") {
    let removed = 0;
    for (const file of existsSync(VOICE) ? await readdir(VOICE) : []) {
      if (!file.endsWith(".json")) continue;
      const info = JSON.parse(await readFile(path.join(VOICE, file), "utf8"));
      if (info.provider !== "system") continue;
      await rm(path.join(VOICE, info.file), { force: true });
      await rm(path.join(VOICE, file), { force: true });
      removed++;
    }
    console.log(`Removed ${removed} draft clips.`);
    return;
  }
  console.log("Use --sample \"text\", --voices, --credits, --estimate or --clear-drafts.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2)).catch((error) => { console.error(error.message); process.exit(1); });
}
