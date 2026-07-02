import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NormalizedCalendarData } from "./calendarTypes.js";

export type SavedCalendarDataPaths = {
  rawLatestPath: string;
  normalizedLatestPath: string;
  rawDatedPath: string;
  normalizedDatedPath: string;
};

const DATA_DIR = "data/calendar";

export async function saveCalendarData(
  rawCalendarResponse: unknown,
  normalizedCalendarData: NormalizedCalendarData,
  syncDate: string,
  baseDir = process.cwd()
): Promise<SavedCalendarDataPaths> {
  const dataDir = join(baseDir, DATA_DIR);
  await mkdir(dataDir, { recursive: true });

  const paths = {
    rawLatestPath: join(dataDir, "raw-latest.json"),
    normalizedLatestPath: join(dataDir, "normalized-latest.json"),
    rawDatedPath: join(dataDir, `${syncDate}.raw.json`),
    normalizedDatedPath: join(dataDir, `${syncDate}.normalized.json`)
  };

  await Promise.all([
    writeJson(paths.rawLatestPath, rawCalendarResponse),
    writeJson(paths.normalizedLatestPath, normalizedCalendarData),
    writeJson(paths.rawDatedPath, rawCalendarResponse),
    writeJson(paths.normalizedDatedPath, normalizedCalendarData)
  ]);

  return paths;
}

function writeJson(path: string, value: unknown): Promise<void> {
  return writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
