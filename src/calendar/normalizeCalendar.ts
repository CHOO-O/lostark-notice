import type { AdventureIslandSchedule } from "../briefing/briefingTypes.js";
import type { NormalizedCalendarData, NormalizedCalendarItem } from "./calendarTypes.js";
import { toAllAdventureIslandSchedules } from "../lostark/calendarAdapter.js";
import { formatKstDateTime, LOSTARK_DAILY_RESET_HOUR } from "../time.js";

export function normalizeCalendar(rawCalendarResponse: unknown, now = new Date()): NormalizedCalendarData {
  const schedules = toAllAdventureIslandSchedules(rawCalendarResponse);

  return {
    schemaVersion: 1,
    syncedAt: formatKstIsoOffset(now),
    source: "Lost Ark Open API /gamecontents/calendar",
    resetHourKst: LOSTARK_DAILY_RESET_HOUR,
    items: groupSchedules(schedules)
  };
}

export function toAdventureIslandSchedulesFromNormalized(
  calendarData: NormalizedCalendarData,
  targetDate: string
): AdventureIslandSchedule[] {
  return calendarData.items
    .filter((item) => item.category === "모험 섬" && item.date === targetDate)
    .flatMap((item) =>
      item.times.map((time) => ({
        name: item.name,
        startDate: item.date,
        startTime: time,
        sortKey: createSortKey(item.date, time),
        rewardCategory: item.rewardType,
        rewardSummary: item.rewardText,
        location: item.raw.schedules[0]?.location ?? null,
        iconUrl: item.raw.schedules[0]?.iconUrl ?? null,
        minItemLevel: item.raw.schedules[0]?.minItemLevel ?? null
      }))
    )
    .sort((left, right) => {
      if (left.sortKey !== right.sortKey) {
        return left.sortKey - right.sortKey;
      }
      return left.name.localeCompare(right.name, "ko-KR");
    });
}

function groupSchedules(schedules: AdventureIslandSchedule[]): NormalizedCalendarItem[] {
  const groups = new Map<string, AdventureIslandSchedule[]>();

  for (const schedule of schedules) {
    const key = [
      schedule.startDate,
      "모험 섬",
      schedule.name,
      schedule.rewardCategory,
      schedule.rewardSummary ?? ""
    ].join("|");
    const existing = groups.get(key) ?? [];
    existing.push(schedule);
    groups.set(key, existing);
  }

  return Array.from(groups.values())
    .map((group) => {
      const first = group[0]!;
      const times = Array.from(new Set(group.map((schedule) => schedule.startTime))).sort();

      return {
        date: first.startDate,
        category: "모험 섬" as const,
        name: first.name,
        times,
        rewardType: first.rewardCategory,
        rewardText: first.rewardSummary ?? first.rewardCategory,
        raw: {
          schedules: group.map((schedule) => ({
            startDate: schedule.startDate,
            startTime: schedule.startTime,
            rewardSummary: schedule.rewardSummary,
            location: schedule.location,
            iconUrl: schedule.iconUrl,
            minItemLevel: schedule.minItemLevel
          }))
        }
      };
    })
    .sort((left, right) => {
      const leftKey = `${left.date} ${left.times[0] ?? "99:99"} ${left.name}`;
      const rightKey = `${right.date} ${right.times[0] ?? "99:99"} ${right.name}`;
      return leftKey.localeCompare(rightKey, "ko-KR");
    });
}

function formatKstIsoOffset(now: Date): string {
  return `${formatKstDateTime(now).replace(" ", "T")}:00+09:00`;
}

function createSortKey(date: string, time: string): number {
  return Number.parseInt(`${date.replaceAll("-", "")}${time.replace(":", "")}`, 10);
}
