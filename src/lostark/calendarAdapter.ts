import type { AdventureIslandSchedule } from "../briefing/briefingTypes.js";
import { classifyReward } from "../briefing/rewardClassifier.js";
import { type KstDateTimeParts, parseCalendarDateTime } from "../time.js";

type CalendarRecord = Record<string, unknown>;
type ScheduleStartTime = {
  raw: unknown;
  index: number;
  parsed: KstDateTimeParts;
};

type TargetScheduleStartTime = ScheduleStartTime & {
  targetIndex: number;
};

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
  const allStartTimes = extractScheduleStartTimes(item);
  const targetStartTimes = allStartTimes
    .filter((startTime) => startTime.parsed.date === targetDate)
    .map((startTime, targetIndex) => ({ ...startTime, targetIndex }));

  return targetStartTimes.flatMap((startTime) =>
    createScheduleFromTime(item, startTime, rewardSource ?? item, allStartTimes, targetStartTimes)
  );
}

function createScheduleFromTime(
  item: CalendarRecord,
  startTime: TargetScheduleStartTime,
  rewardSource: unknown,
  allStartTimes: ScheduleStartTime[],
  targetStartTimes: TargetScheduleStartTime[]
): AdventureIslandSchedule[] {
  const datedRewardSource = selectRewardSourceForStartTime(
    rewardSource,
    startTime,
    allStartTimes,
    targetStartTimes
  );
  const reward = classifyReward(datedRewardSource === undefined ? rewardSource : datedRewardSource);

  return [
    {
      name: getFirstString(item, NAME_KEYS) ?? "이름 미상",
      startDate: startTime.parsed.date,
      startTime: startTime.parsed.time,
      sortKey: startTime.parsed.sortKey,
      rewardCategory: reward.category,
      rewardSummary: reward.summary,
      location: getFirstString(item, ["Location", "location"]) ?? null,
      iconUrl: getFirstString(item, ["ContentsIcon", "contentsIcon", "Icon", "icon"]) ?? null,
      minItemLevel: getNumber(item, ["MinItemLevel", "minItemLevel"]) ?? null
    }
  ];
}

function extractScheduleStartTimes(item: CalendarRecord): ScheduleStartTime[] {
  return extractRawStartTimes(item).flatMap((raw, index) => {
    const parsed = parseCalendarDateTime(raw);
    return parsed ? [{ raw, index, parsed }] : [];
  });
}

function extractRawStartTimes(item: CalendarRecord): unknown[] {
  const value = getFirstExistingValue(item, START_TIME_KEYS);
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
}

function selectRewardSourceForStartTime(
  rewardSource: unknown,
  startTime: TargetScheduleStartTime,
  allStartTimes: ScheduleStartTime[],
  targetStartTimes: TargetScheduleStartTime[]
): unknown[] | undefined {
  const rewardEntries = Array.isArray(rewardSource) ? rewardSource : [];
  if (rewardEntries.length === 0) {
    return undefined;
  }

  const rewardsWithTimes = rewardEntries.map((rewardEntry) => ({
    rewardEntry,
    dateTimes: extractDateTimesDeep(rewardEntry)
  }));
  const hasAnyDateTime = rewardsWithTimes.some(({ dateTimes }) => dateTimes.length > 0);

  if (!hasAnyDateTime) {
    return selectRewardSourceByScheduleIndex(
      rewardEntries,
      startTime,
      allStartTimes,
      targetStartTimes
    );
  }

  const exactMatches = rewardsWithTimes
    .filter(({ dateTimes }) =>
      dateTimes.some(
        (dateTime) =>
          dateTime.date === startTime.parsed.date && dateTime.time === startTime.parsed.time
      )
    )
    .map(({ rewardEntry }) => rewardEntry);

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  const dateMatches = rewardsWithTimes
    .filter(({ dateTimes }) =>
      dateTimes.some((dateTime) => dateTime.date === startTime.parsed.date)
    )
    .map(({ rewardEntry }) => rewardEntry);

  return dateMatches;
}

function selectRewardSourceByScheduleIndex(
  rewardEntries: unknown[],
  startTime: TargetScheduleStartTime,
  allStartTimes: ScheduleStartTime[],
  targetStartTimes: TargetScheduleStartTime[]
): unknown[] | undefined {
  if (rewardEntries.length === allStartTimes.length) {
    return toRewardSourceArray(rewardEntries[startTime.index]);
  }

  if (rewardEntries.length === targetStartTimes.length) {
    return toRewardSourceArray(rewardEntries[startTime.targetIndex]);
  }

  return undefined;
}

function toRewardSourceArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function extractDateTimesDeep(value: unknown, depth = 0): KstDateTimeParts[] {
  if (depth > 4 || value == null) {
    return [];
  }

  if (typeof value === "string") {
    const parsed = parseCalendarDateTime(value);
    return parsed ? [parsed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractDateTimesDeep(item, depth + 1));
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) => {
    if (!isDateTimeKey(key) && !Array.isArray(nestedValue) && !isRecord(nestedValue)) {
      return [];
    }

    return extractDateTimesDeep(nestedValue, depth + 1);
  });
}

function isDateTimeKey(key: string): boolean {
  return /(?:date|time|schedule|period|start|end)/i.test(key);
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
