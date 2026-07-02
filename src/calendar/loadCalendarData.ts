import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NormalizedCalendarData } from "./calendarTypes.js";

const NORMALIZED_LATEST_PATH = "data/calendar/normalized-latest.json";

export class CalendarDataNotFoundError extends Error {
  constructor(readonly path: string) {
    super("저장된 캘린더 데이터가 없습니다. get-weekly-calendar workflow를 먼저 실행해주세요.");
    this.name = "CalendarDataNotFoundError";
  }
}

export async function loadNormalizedCalendarData(
  baseDir = process.cwd()
): Promise<NormalizedCalendarData> {
  const path = join(baseDir, NORMALIZED_LATEST_PATH);

  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new CalendarDataNotFoundError(path);
    }
    throw error;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    return assertNormalizedCalendarData(parsed, path);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`저장된 캘린더 JSON을 파싱할 수 없습니다: ${path}`);
    }
    throw error;
  }
}

function assertNormalizedCalendarData(value: unknown, path: string): NormalizedCalendarData {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error(`저장된 캘린더 JSON 구조가 올바르지 않습니다: ${path}`);
  }

  return value as NormalizedCalendarData;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
