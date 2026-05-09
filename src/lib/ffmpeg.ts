import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import os from "os";

function getFontPath(): string | null {
  const candidates =
    os.platform() === "win32"
      ? [
          "C:\\Windows\\Fonts\\arial.ttf",
          "C:\\Windows\\Fonts\\arialbd.ttf",
          "C:\\Windows\\Fonts\\calibri.ttf",
          "C:\\Windows\\Fonts\\segoeui.ttf",
        ]
      : [
          // DejaVu — installed via fonts-dejavu-core in Dockerfile
          "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
          // Liberation (common on many distros)
          "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
          "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
          // FreeFonts fallback
          "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
          "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        ];

  const fsSync = require("fs");
  for (const f of candidates) {
    try {
      fsSync.accessSync(f);
      return f;
    } catch {
      continue;
    }
  }
  return null;
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

export async function createComposite(
  inputPaths: string[],
  slotLabels: string[],
  outputPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const fontPath = getFontPath();
  const n = inputPaths.length;

  // Probe each input for audio before building the filter graph
  const audioPresent = await Promise.all(inputPaths.map(probeHasAudio));
  const audioInputRefs = audioPresent
    .map((has, i) => (has ? `[${i}:a]` : null))
    .filter(Boolean) as string[];

  return new Promise((resolve, reject) => {
    // Scale each video to 640x360
    const scaleFilters = inputPaths.map(
      (_, i) => `[${i}:v]scale=640:360,setsar=1[v${i}]`
    );

    // Stack side by side
    const stackInputs = inputPaths.map((_, i) => `[v${i}]`).join("");
    const stackFilter = `${stackInputs}xstack=inputs=${n}:layout=${inputPaths
      .map((_, i) => `${i * 640}_0`)
      .join("|")}[stacked]`;

    // Burn slot labels
    const labelFilters = slotLabels.map((label, i) => {
      const x = i * 640 + 8;
      const boxFilter = `drawbox=x=${x}:y=8:w=52:h=58:color=black@0.6:t=fill`;
      if (fontPath) {
        const fp = escapeFfmpegPath(fontPath);
        const textFilter = `drawtext=fontfile='${fp}':text='${label}':fontsize=42:fontcolor=white:x=${x + 8}:y=12`;
        return `${boxFilter},${textFilter}`;
      }
      return boxFilter;
    });
    const drawFilters = labelFilters.join(",");

    const filterParts: string[] = [
      ...scaleFilters,
      stackFilter,
      `[stacked]${drawFilters}[out]`,
    ];

    // Mix audio from whichever inputs have audio tracks
    const outputOptions = ["-map [out]", "-c:v libx264", "-crf 23", "-preset fast"];

    if (audioInputRefs.length === 1) {
      // Single audio stream — pass through directly
      filterParts.push(`${audioInputRefs[0]}anull[aout]`);
      outputOptions.push("-map [aout]", "-c:a aac", "-b:a 128k");
    } else if (audioInputRefs.length > 1) {
      // Multiple audio streams — mix them
      filterParts.push(
        `${audioInputRefs.join("")}amix=inputs=${audioInputRefs.length}:duration=longest:normalize=0[aout]`
      );
      outputOptions.push("-map [aout]", "-c:a aac", "-b:a 128k");
    }
    // If no inputs have audio, no audio track is added to the composite

    const filterComplex = filterParts.join(";");

    let cmd = ffmpeg();
    for (const p of inputPaths) cmd = cmd.input(p);

    cmd
      .complexFilter(filterComplex)
      .outputOptions(outputOptions)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}
