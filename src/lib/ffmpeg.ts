import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";

// Bundled font — always at a known path regardless of OS or distro
function getFontPath(): string {
  return path.join(process.cwd(), "public", "fonts", "arial.ttf");
}

function escapeFfmpegPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

// Returns true if the file has at least one audio stream
function probeHasAudio(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (_err, metadata) => {
      resolve(
        !_err &&
          (metadata?.streams ?? []).some((s) => s.codec_type === "audio")
      );
    });
  });
}

// Returns video dimensions (width × height) or null if probe fails
export function probeVideoDimensions(
  filePath: string
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (_err, metadata) => {
      if (_err) return resolve(null);
      const stream = metadata?.streams?.find((s) => s.codec_type === "video");
      resolve(
        stream && stream.width && stream.height
          ? { width: stream.width, height: stream.height }
          : null
      );
    });
  });
}

export type CompositeSettings = {
  layout: "horizontal" | "vertical";
  cropX: number;
  cropY: number;
  padding: number;
  keepOriginalSize: boolean;
};

const DEFAULT_SETTINGS: CompositeSettings = {
  layout: "horizontal",
  cropX: 0,
  cropY: 0,
  padding: 0,
  keepOriginalSize: false,
};

// Default scaled dimensions when keepOriginalSize is false
const SCALED_W = 640;
const SCALED_H = 360;

export async function createComposite(
  inputPaths: string[],
  slotLabels: string[],
  outputPath: string,
  settings: CompositeSettings = DEFAULT_SETTINGS
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const fontPath = getFontPath();
  const n = inputPaths.length;
  const { layout, cropX, cropY, padding, keepOriginalSize } = settings;

  // Probe each input for audio before building the filter graph
  const audioPresent = await Promise.all(inputPaths.map(probeHasAudio));
  const audioInputRefs = audioPresent
    .map((has, i) => (has ? `[${i}:a]` : null))
    .filter(Boolean) as string[];

  // When keeping original size, probe actual post-crop dimensions for xstack positions.
  // Assume all videos in the set share the same source dimensions (same prompt, diff models).
  let slotW = SCALED_W;
  let slotH = SCALED_H;
  if (keepOriginalSize && inputPaths.length > 0) {
    const dims = await probeVideoDimensions(inputPaths[0]);
    if (dims) {
      // Apply the same crop formula used in the filter graph, then round to even
      const rawW = Math.max(1, dims.width - cropX);
      const rawH = Math.max(1, dims.height - cropY);
      slotW = Math.floor(rawW / 2) * 2;
      slotH = Math.floor(rawH / 2) * 2;
    }
  }

  return new Promise((resolve, reject) => {
    // Per-video filter: crop (if needed), then scale (or just force even dims)
    const perVideoFilters = inputPaths.map((_, i) => {
      const crop =
        cropX > 0 || cropY > 0
          ? `crop=iw-${cropX}:ih-${cropY}:${cropX}:${cropY},`
          : "";
      const scale = keepOriginalSize
        ? `scale=trunc(iw/2)*2:trunc(ih/2)*2`
        : `scale=${SCALED_W}:${SCALED_H}`;
      return `[${i}:v]${crop}${scale},setsar=1[v${i}]`;
    });

    // xstack layout positions — use actual slot dimensions (probed above for original size)
    const stackInputs = inputPaths.map((_, i) => `[v${i}]`).join("");
    const positions = inputPaths
      .map((_, i) =>
        layout === "vertical"
          ? `0_${i * (slotH + padding)}`
          : `${i * (slotW + padding)}_0`
      )
      .join("|");
    const stackFilter = `${stackInputs}xstack=inputs=${n}:layout=${positions}[stacked]`;

    // Burn slot labels in top-left corner of each video slot
    const fp = escapeFfmpegPath(fontPath);
    const labelFilters = slotLabels.map((label, i) => {
      const lx =
        layout === "vertical" ? 8 : i * (slotW + padding) + 8;
      const ly =
        layout === "vertical" ? i * (slotH + padding) + 8 : 8;
      return [
        `drawbox=x=${lx}:y=${ly}:w=52:h=58:color=black@0.6:t=fill`,
        `drawtext=fontfile='${fp}':text='${label}':fontsize=42:fontcolor=white:x=${lx + 8}:y=${ly + 4}`,
      ].join(",");
    });
    const drawFilters = labelFilters.join(",");

    const filterParts: string[] = [
      ...perVideoFilters,
      stackFilter,
      // libx264 requires even width and height — round down by 1px if odd (imperceptible)
      `[stacked]scale=trunc(iw/2)*2:trunc(ih/2)*2[stacked_e]`,
      `[stacked_e]${drawFilters}[out]`,
    ];

    // Mix audio from whichever inputs have audio tracks
    const outputOptions = ["-map [out]", "-c:v libx264", "-crf 23", "-preset fast"];

    if (audioInputRefs.length === 1) {
      filterParts.push(`${audioInputRefs[0]}anull[aout]`);
      outputOptions.push("-map [aout]", "-c:a aac", "-b:a 128k");
    } else if (audioInputRefs.length > 1) {
      filterParts.push(
        `${audioInputRefs.join("")}amix=inputs=${audioInputRefs.length}:duration=longest:normalize=0[aout]`
      );
      outputOptions.push("-map [aout]", "-c:a aac", "-b:a 128k");
    }

    const filterComplex = filterParts.join(";");

    let cmd = ffmpeg();
    for (const p of inputPaths) cmd = cmd.input(p);

    cmd
      .complexFilter(filterComplex)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on("start", (cmdLine) => console.log("[ffmpeg] start:", cmdLine))
      .on("stderr", (line) => console.log("[ffmpeg]", line))
      .on("end", () => { console.log("[ffmpeg] done:", outputPath); resolve(); })
      .on("error", (err) => { console.error("[ffmpeg] error:", err.message); reject(err); })
      .run();
  });
}
