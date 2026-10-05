// Small readers of the generated files, without ffmpeg: the size of a JPEG,
// the length of an MP4 and whether it has sound.
import { readFileSync } from "node:fs";

export function jpegSize(file) {
  const data = readFileSync(file);
  for (let i = 2; i < data.length;) {
    if (data[i] !== 0xff) { i++; continue; }
    const marker = data[i + 1], length = data.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)];
    i += 2 + length;
  }
  return null;
}

// Length from the movie header.
export function mp4Seconds(file) {
  const mp4 = readFileSync(file), at = mp4.indexOf("mvhd");
  if (at < 0) return null;
  const version = mp4[at + 4], scale = version ? mp4.readUInt32BE(at + 24) : mp4.readUInt32BE(at + 16);
  const duration = version ? Number(mp4.readBigUInt64BE(at + 28)) : mp4.readUInt32BE(at + 20);
  return duration / scale;
}

// A "soun" handler in one of the tracks.
export function mp4HasSound(file) {
  const mp4 = readFileSync(file);
  for (let at = mp4.indexOf("hdlr"); at > -1; at = mp4.indexOf("hdlr", at + 4)) if (mp4.toString("latin1", at + 12, at + 16) === "soun") return true;
  return false;
}
