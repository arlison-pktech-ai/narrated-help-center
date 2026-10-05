#!/usr/bin/env node
// Turns the recorded frames of the tutorial videos into MP4 files light enough
// for a web page: H.264 at a constant frame rate, captions already in the
// frames, the narration placed where each caption appears (AAC, mono,
// -16 LUFS) and a poster image. Output: <outDir>/video/<name>.mp4 and .jpg.
//   node lib/encode.mjs            every recorded video
//   node lib/encode.mjs 02 05      only the videos whose name starts so
// KEEP_FRAMES=1 keeps the raw frames (about 150 MB per minute).
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, FRAMES, VIDEO } from "./config.mjs";

export async function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (spawnSync("ffmpeg", ["-version"]).status === 0) return "ffmpeg";
  try {
    const bundled = (await import("ffmpeg-static")).default;
    if (bundled && existsSync(bundled)) return bundled;
  } catch {}
  for (const python of ["python3", "python"]) {
    const found = spawnSync(python, ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"], { encoding: "utf8" });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  throw Error("ffmpeg not found: install it (brew install ffmpeg / apt install ffmpeg), run `npm i -D ffmpeg-static`, or set FFMPEG.");
}

const run = (ffmpeg, args) => new Promise((resolve, reject) => {
  const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
  child.on("error", reject);
  child.on("exit", (code) => (code === 0 ? resolve() : reject(Error(`ffmpeg exited with ${code}`))));
});

// Frames arrive when something is painted; each one lasts until the next.
function concatList(dir, list, from, to) {
  const shown = list.filter((frame, index) => (list[index + 1]?.t ?? Infinity) > from && frame.t < to);
  const lines = ["ffconcat version 1.0"];
  shown.forEach((frame, index) => {
    const start = Math.max(frame.t, from), end = Math.min(shown[index + 1]?.t ?? to, to);
    lines.push(`file '${path.join(dir, frame.file)}'`, `duration ${Math.max(1 / 120, end - start).toFixed(6)}`);
  });
  lines.push(`file '${path.join(dir, shown.at(-1).file)}'`);
  return lines.join("\n");
}

// While the director waits for a new narration clip, nothing happens on the
// screen: that time is cut, and everything after it moves back.
function retime(timeline) {
  const cuts = timeline.filter((item) => item.type === "cut").map((item) => item.value);
  return (t) => t - cuts.reduce((sum, cut) => sum + Math.max(0, Math.min(t, cut.to) - cut.from), 0);
}

export async function encode(name, ffmpeg) {
  const dir = path.join(FRAMES, name);
  const clip = JSON.parse(await readFile(path.join(dir, "timeline.json"), "utf8"));
  if (!clip.frames.length) throw Error(`${name}: no frames were recorded.`);
  const at = retime(clip.timeline);
  // The frames of a cut fall on its start; the last of them stays on screen.
  const shown = clip.frames.map((frame) => ({ ...frame, t: at(frame.t) })).filter((frame, index, all) => index === all.length - 1 || all[index + 1].t > frame.t);
  const mark = (type) => clip.timeline.find((item) => item.type === type)?.t;
  const start = shown[0].t, end = mark("end") ? at(mark("end")) : shown.at(-1).t + 0.5;
  const list = path.join(dir, "video.ffconcat");
  await writeFile(list, concatList(dir, shown, start, end));
  // Each sentence starts when its caption appears.
  const voices = clip.timeline.filter((item) => item.type === "voice").map((item) => ({ file: item.value.file, from: Math.max(0, at(item.t) - start) }));
  const inputs = ["-f", "concat", "-safe", "0", "-i", list, ...voices.flatMap((voice) => ["-i", voice.file])];
  const fps = config.video.fps, length = (end - start).toFixed(3);
  const filters = [`[0:v]fps=${fps},format=yuv420p[v]`];
  if (voices.length) {
    voices.forEach((voice, index) => filters.push(`[${index + 1}:a]aresample=48000,adelay=${Math.round(voice.from * 1000)}:all=1[a${index}]`));
    // Silence until the end of the video, as long as it.
    filters.push(`${voices.map((_, index) => `[a${index}]`).join("")}amix=inputs=${voices.length}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,apad=whole_dur=${length},atrim=0:${length}[a]`);
  }
  const sound = voices.length ? ["-map", "[a]", "-c:a", "aac", "-b:a", "64k", "-ac", "1"] : [];
  await mkdir(VIDEO, { recursive: true });
  const file = path.join(VIDEO, `${name}.mp4`);
  // -t: at the end of the list, fps would repeat the last frame once more.
  await run(ffmpeg, [...inputs, "-filter_complex", filters.join(";"), "-map", "[v]", "-c:v", "libx264", "-preset", "slow", "-crf", String(config.video.crf), "-tune", "stillimage", "-profile:v", "high", ...sound, "-t", length, "-movflags", "+faststart", "-r", String(fps), file]);
  const poster = mark("poster") && at(mark("poster"));
  const still = Math.max(0, (poster ?? start + (end - start) * 0.4) - start + 0.6);
  await run(ffmpeg, ["-ss", still.toFixed(2), "-i", file, "-frames:v", "1", "-q:v", "3", path.join(VIDEO, `${name}.jpg`)]);
  console.log(`${name}: ${(end - start).toFixed(1)} s, ${shown.length} frames, ${voices.length} narration clips`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2);
  if (!existsSync(FRAMES)) throw Error("Record the videos first: npx playwright test -c <help dir>/playwright.config.mjs --project=videos");
  const ffmpeg = await ffmpegPath();
  let done = 0;
  for (const name of (await readdir(FRAMES)).sort()) {
    if (only.length && !only.some((prefix) => name.startsWith(prefix))) continue;
    if (!existsSync(path.join(FRAMES, name, "timeline.json"))) continue;
    await encode(name, ffmpeg);
    done++;
    if (!process.env.KEEP_FRAMES) await rm(path.join(FRAMES, name), { recursive: true, force: true });
  }
  if (!done) console.log("No recorded videos to encode.");
}
