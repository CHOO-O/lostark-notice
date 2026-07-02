import {
  type AdventureIslandBriefing,
  type AdventureIslandSchedule
} from "./briefingTypes.js";
import { toAdventureIslandSchedules } from "../lostark/calendarAdapter.js";
import { formatKstDateTime, getKoreanWeekday, getLostArkBusinessDate } from "../time.js";

export type BuildAdventureIslandBriefingOptions = {
  now?: Date;
  targetDate?: string;
};

export function buildAdventureIslandBriefing(
  rawCalendarResponse: unknown,
  options: BuildAdventureIslandBriefingOptions = {}
): AdventureIslandBriefing {
  const now = options.now ?? new Date();
  const targetDate = options.targetDate ?? getLostArkBusinessDate(now);
  const islands = toAdventureIslandSchedules(rawCalendarResponse, targetDate);

  return {
    title: "오늘의 모험 섬 일정",
    targetDate,
    weekday: getKoreanWeekday(targetDate),
    timezone: "KST",
    resetTime: "06:00",
    updatedAt: formatKstDateTime(now),
    source: "Lost Ark Open API",
    islands: sortSchedules(islands)
  };
}

function sortSchedules(schedules: AdventureIslandSchedule[]): AdventureIslandSchedule[] {
  return [...schedules].sort((left, right) => {
    if (left.sortKey !== right.sortKey) {
      return left.sortKey - right.sortKey;
    }
    return left.name.localeCompare(right.name, "ko-KR");
  });
}
