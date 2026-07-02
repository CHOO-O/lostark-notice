import type { AdventureIslandSchedule } from "../briefing/briefingTypes.js";
import { classifyReward } from "../briefing/rewardClassifier.js";
import { parseCalendarDateTime } from "../time.js";

type CalendarRecord = Record<string, unknown>;

const ITEM_ARRAY_KEYS = ["data", "Data", "items", "Items", "result", "Result", "results", "Results"];
const CATEGORY_KEYS = ["CategoryName", "categoryName", "Category", "category"];
const NAME_KEYS = ["ContentsName", "contentsName", "Name", "name", "Title", "title"];
const START_TIME_KEYS = [
  "StartTimes",
  "startTimes",
  "StartTime",
  "startTime",
  "StartDate",
  "startDate",
  "StartDateTime",
  "startDateTime",
  "Date",
  "date"
];
const REWARD_KEYS = ["RewardItems", "rewardItems", "Rewards", "rewards", "Reward", "reward"];

export function toAdventureIslandSchedules(
  rawCalendarResponse: unknown,
  targetDate: string
): AdventureIslandSchedule[] {
  const calendarItems = extractCalendarItems(rawCalendarResponse);
  const schedules = calendarItems
    .filter(isAdventureIsland)
    .flatMap((item) => createSchedules(item, targetDate));

  return deduplicateSchedules(schedules).sort((left, right) => {
    if (left.sortKey !== right.sortKey) {
      return left.sortKey - right.sortKey;
    }
    return left.name.localeCompare(right.name, "ko-KR");
  });
}

function extractCalendarItems(rawCalendarResponse: unknown): CalendarRecord[] {
  if (Array.isArray(rawCalendarResponse)) {
    return rawCalendarResponse.filter(isRecord);
  }

  if (!isRecord(rawCalendarResponse)) {
    return [];
  }

  for (const key of ITEM_ARRAY_KEYS) {
    const value = rawCalendarResponse[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

function isAdventureIsland(item: CalendarRecord): boolean {
  const categoryText = CATEGORY_KEYS.map((key) => asString(item[key]))
    .filter(Boolean)
    .join(" ");
  const nameText = NAME_KEYS.map((key) => asString(item[key])).filter(Boolean).join(" ");
  const haystack = `${categoryText} ${nameText}`;

  return /모험\s*섬|adventure\s*island/i.test(haystack);
}

function createSchedules(item: CalendarRecord, targetDate: string): AdventureIslandSchedule[] {
  const rewardSource = getFirstExistingValue(item, REWARD_KEYS);
  const rewardTimeMap = buildRewardTimeMap(rewardSource);

  if (rewardTimeMap.size > 0) {
    return Array.from(rewardTimeMap.entries()).flatMap(([rawStartTime, rewardItems]) =>
      createScheduleFromTime(item, targetDate, rawStartTime, rewardItems)
    );
  }

  return extractRawStartTimes(item).flatMap((rawStartTime) =>
    createScheduleFromTime(item, targetDate, rawStartTime, rewardSource ?? item)
  );
}

function createScheduleFromTime(
  item: CalendarRecord,
  targetDate: string,
  rawStartTime: unknown,
  rewardSource: unknown
): AdventureIslandSchedule[] {
  const parsedStartTime = parseCalendarDateTime(rawStartTime);
  if (!parsedStartTime || parsedStartTime.date !== targetDate) {
    return [];
  }

  const reward = classifyReward(rewardSource);

  return [
    {
      name: getFirstString(item, NAME_KEYS) ?? "이름 미상",
      startDate: parsedStartTime.date,
      startTime: parsedStartTime.time,
      sortKey: parsedStartTime.sortKey,
      rewardCategory: reward.category,
      rewardSummary: reward.summary,
      location: getFirstString(item, ["Location", "location"]) ?? null,
      iconUrl: getFirstString(item, ["ContentsIcon", "contentsIcon", "Icon", "icon"]) ?? null,
      minItemLevel: getNumber(item, ["MinItemLevel", "minItemLevel"]) ?? null
    }
  ];
}

function buildRewardTimeMap(rewardSource: unknown): Map<unknown, unknown[]> {
  const result = new Map<unknown, unknown[]>();
  const rewardItems = Array.isArray(rewardSource) ? rewardSource : [];

  for (const rewardItem of rewardItems) {
    if (!isRecord(rewardItem)) {
      continue;
    }

    for (const rawStartTime of extractRawStartTimes(rewardItem)) {
      const existing = result.get(rawStartTime) ?? [];
      existing.push(rewardItem);
      result.set(rawStartTime, existing);
    }
  }

  return result;
}

function extractRawStartTimes(item: CalendarRecord): unknown[] {
  const value = getFirstExistingValue(item, START_TIME_KEYS);
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
}

function deduplicateSchedules(schedules: AdventureIslandSchedule[]): AdventureIslandSchedule[] {
  const seen = new Set<string>();
  const unique: AdventureIslandSchedule[] = [];

  for (const schedule of schedules) {
    const key = [
      schedule.startDate,
      schedule.startTime,
      schedule.name,
      schedule.rewardCategory
    ].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(schedule);
  }

  return unique;
}

function getFirstExistingValue(item: CalendarRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (item[key] != null) {
      return item[key];
    }
  }
  return null;
}

function getFirstString(item: CalendarRecord, keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(item[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function getNumber(item: CalendarRecord, keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is CalendarRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
