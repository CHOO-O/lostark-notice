import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NormalizedCalendarData } from "./calendarTypes.js";

export type SavedCalendarDataPaths = {
  rawLatestPath: string;
  normalizedLatestPath: string;
};

const DATA_DIR = "data/calendar";

export async function saveCalendarData(
  rawCalendarResponse: unknown,
  normalizedCalendarData: NormalizedCalendarData,
  baseDir = process.cwd()
): Promise<SavedCalendarDataPaths> {
  const dataDir = join(baseDir, DATA_DIR);
  await mkdir(dataDir, { recursive: true });
  await removeExistingCalendarJson(dataDir);

  const paths = {
    rawLatestPath: join(dataDir, "raw-latest.json"),
    normalizedLatestPath: join(dataDir, "normalized-latest.json")
  };

  await Promise.all([
    writeJson(paths.rawLatestPath, rawCalendarResponse),
    writeJson(paths.normalizedLatestPath, normalizedCalendarData)
  ]);

  return paths;
}

async function removeExistingCalendarJson(dataDir: string): Promise<void> {
  const entries = await readdir(dataDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => unlink(join(dataDir, entry.name)))
  );
}

function writeJson(path: string, value: unknown): Promise<void> {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
