import ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs/promises";
import os from "os";

// Find a usable font file for drawtext — avoids fontconfig dependency on Windows
function getFontPath(): string | null {
  if (os.platform() === "win32") {
    const candidates = [
      "C:\\Windows\\Fonts\\arial.ttf",
      "C:\\Windows\\Fonts\\arialbd.ttf",
      "C:\\Windows\\Fonts\\calibri.ttf",
      "C:\\Windows\\Fonts\\segoeui.ttf",
    ];
    for (const f of candidates) {
      try {
        require("fs").accessSync(f);
        return f;
      } catch {
        continue;
      }
    }
  }
  return null;
}

// Escape a Windows path for FFmpeg's drawtext filter
// Colons must be escaped as \: and backslashes as \\
function escapeFfmpegPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

export async function createComposite(
  inputPaths: string[],
  slotLabels: string[],
  outputPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const fontPath = getFontPath();

  return new Promise((resolve, reject) => {
    const n = inputPaths.length;

    // Scale each video to 640x360
    const scaleFilters = inputPaths.map(
      (_, i) => `[${i}:v]scale=640:360,setsar=1[v${i}]`
    );

    // Stack side by side
    const stackInputs = inputPaths.map((_, i) => `[v${i}]`).join("");
    const stackFilter = `${stackInputs}xstack=inputs=${n}:layout=${inputPaths
      .map((_, i) => `${i * 640}_0`)
      .join("|")}[stacked]`;

    // Burn slot labels — use drawbox + drawtext if font available, else drawbox only
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

    const filterComplex = [
      ...scaleFilters,
      stackFilter,
      `[stacked]${drawFilters}[out]`,
    ].join(";");

    let cmd = ffmpeg();
    for (const p of inputPaths) cmd = cmd.input(p);

    cmd
      .complexFilter(filterComplex)
      .outputOptions(["-map [out]", "-c:v libx264", "-crf 23", "-preset fast"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}
