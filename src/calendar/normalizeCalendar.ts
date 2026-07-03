import type { AdventureIslandSchedule } from "../briefing/briefingTypes.js";
import { classifyReward } from "../briefing/rewardClassifier.js";
import {
  type NormalizedCalendarCategory,
  type NormalizedCalendarData,
  type NormalizedCalendarItem
} from "./calendarTypes.js";
import {
  formatKstDateTime,
  getLostArkBusinessDateForKstDateTime,
  type KstDateTimeParts,
  LOSTARK_DAILY_RESET_HOUR,
  parseCalendarDateTime
} from "../time.js";

type CalendarRecord = Record<string, unknown>;

type CalendarStartTime = {
  raw: unknown;
  parsed: KstDateTimeParts;
};

type RewardSplit = {
  commonRewards: unknown[];
  timedRewards: unknown[];
  ignoredRewards: unknown[];
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
const REWARD_ITEM_ARRAY_KEYS = ["Items", "items", "Data", "data", "Rewards", "rewards"];

const CATEGORY_RULES: Array<{ category: NormalizedCalendarCategory; pattern: RegExp }> = [
  { category: "모험 섬", pattern: /모험\s*섬|adventure\s*island/i },
  { category: "필드 보스", pattern: /필드\s*보스|field\s*boss/i },
  { category: "카오스게이트", pattern: /카오스\s*게이트|chaos\s*gate/i }
];

export function normalizeCalendar(rawCalendarResponse: unknown, now = new Date()): NormalizedCalendarData {
  const items = extractCalendarItems(rawCalendarResponse).flatMap(createNormalizedItems);

  return {
    schemaVersion: 2,
    syncedAt: formatKstIsoOffset(now),
    source: "Lost Ark Open API /gamecontents/calendar",
    resetHourKst: LOSTARK_DAILY_RESET_HOUR,
    items: deduplicateItems(items)
  };
}

export function normalizeCategory(rawCategoryName: unknown): NormalizedCalendarCategory | null {
  const categoryText = asString(rawCategoryName);
  if (!categoryText) {
    return null;
  }

  return CATEGORY_RULES.find((rule) => rule.pattern.test(categoryText))?.category ?? null;
}

export function toSchedulesFromNormalized(
  calendarData: NormalizedCalendarData,
  targetDate: string,
  enabledCategories: readonly NormalizedCalendarCategory[]
): AdventureIslandSchedule[] {
  const enabledCategorySet = new Set(enabledCategories);

  return calendarData.items
    .filter((item) => enabledCategorySet.has(item.category))
    .flatMap((item) =>
      item.times.flatMap((time) => {
        const businessDate = getScheduleBusinessDate(item.date, time);
        if (businessDate !== targetDate) {
          return [];
        }

        return [
          {
            category: item.category,
            name: item.name,
            startDate: item.date,
            startTime: time,
            sortKey: createSortKey(item.date, time),
            rewardCategory: item.rewardType,
            rewardSummary: item.rewardText,
            location: item.location,
            iconUrl: item.iconUrl,
            minItemLevel: item.minItemLevel
          }
        ];
      })
    )
    .sort(compareSchedules);
}

export function toAdventureIslandSchedulesFromNormalized(
  calendarData: NormalizedCalendarData,
  targetDate: string
): AdventureIslandSchedule[] {
  return toSchedulesFromNormalized(calendarData, targetDate, ["모험 섬"]);
}

function createNormalizedItems(item: CalendarRecord): NormalizedCalendarItem[] {
  const rawCategoryName = getFirstString(item, CATEGORY_KEYS);
  const category = normalizeCategory(rawCategoryName);

  if (!category) {
    return [];
  }

  const rawContentsName = getFirstString(item, NAME_KEYS);
  const name = rawContentsName ?? "이름 미상";
  const startTimesByDate = groupStartTimesByDate(extractScheduleStartTimes(item));
  const rewardItems = extractRewardItems(item);

  return Array.from(startTimesByDate.entries()).map(([date, startTimes]) => {
    const targetDateTimeSet = new Set(startTimes.map(({ parsed }) => toDateTimeKey(parsed)));
    const rewardSplit = splitRewardItems(rewardItems, targetDateTimeSet);
    const rewardsForType =
      rewardSplit.timedRewards.length > 0 ? rewardSplit.timedRewards : rewardSplit.commonRewards;
    const rewardType = classifyReward(rewardsForType).category;
    const rewardText = classifyReward([
      ...rewardSplit.commonRewards,
      ...rewardSplit.timedRewards
    ]).summary;

    return {
      date,
      category,
      name,
      times: Array.from(new Set(startTimes.map(({ parsed }) => parsed.time))).sort(compareTimeText),
      location: getFirstString(item, ["Location", "location"]) ?? null,
      minItemLevel: getNumber(item, ["MinItemLevel", "minItemLevel"]) ?? null,
      rewardType,
      rewardText,
      iconUrl: getFirstString(item, ["ContentsIcon", "contentsIcon", "Icon", "icon"]) ?? null,
      rawRef: {
        categoryName: rawCategoryName,
        contentsName: rawContentsName
      }
    };
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

function extractScheduleStartTimes(item: CalendarRecord): CalendarStartTime[] {
  return extractRawStartTimes(item).flatMap((raw) => {
    const parsed = parseCalendarDateTime(raw);
    return parsed ? [{ raw, parsed }] : [];
  });
}

function groupStartTimesByDate(startTimes: CalendarStartTime[]): Map<string, CalendarStartTime[]> {
  const groups = new Map<string, CalendarStartTime[]>();

  for (const startTime of startTimes) {
    const existing = groups.get(startTime.parsed.date) ?? [];
    existing.push(startTime);
    groups.set(startTime.parsed.date, existing);
  }

  return groups;
}

function extractRawStartTimes(item: CalendarRecord): unknown[] {
  const value = getFirstExistingValue(item, START_TIME_KEYS);
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
}

function extractRewardItems(item: CalendarRecord): unknown[] {
  const rewardSource = getFirstExistingValue(item, REWARD_KEYS);
  return flattenRewardItems(rewardSource);
}

function flattenRewardItems(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenRewardItems);
  }

  if (isRecord(value)) {
    for (const key of REWARD_ITEM_ARRAY_KEYS) {
      const nestedValue = value[key];
      if (Array.isArray(nestedValue)) {
        return flattenRewardItems(nestedValue);
      }
    }
    return [value];
  }

  return [value];
}

function splitRewardItems(rewardItems: unknown[], targetDateTimeSet: Set<string>): RewardSplit {
  const result: RewardSplit = {
    commonRewards: [],
    timedRewards: [],
    ignoredRewards: []
  };

  for (const rewardItem of rewardItems) {
    if (!isRecord(rewardItem)) {
      result.commonRewards.push(rewardItem);
      continue;
    }

    const startTimesValue = getFirstValueWithPresence(rewardItem, START_TIME_KEYS);
    if (!startTimesValue.found || startTimesValue.value == null) {
      result.commonRewards.push(rewardItem);
      continue;
    }

    const rewardDateTimeSet = extractDateTimeKeySet(startTimesValue.value);
    if (setsOverlap(targetDateTimeSet, rewardDateTimeSet)) {
      result.timedRewards.push(rewardItem);
    } else {
      result.ignoredRewards.push(rewardItem);
    }
  }

  return result;
}

function extractDateTimeKeySet(value: unknown): Set<string> {
  const rawValues = Array.isArray(value) ? value : [value];
  const result = new Set<string>();

  for (const rawValue of rawValues) {
    const parsed = parseCalendarDateTime(rawValue);
    if (parsed) {
      result.add(toDateTimeKey(parsed));
    }
  }

  return result;
}

function deduplicateItems(items: NormalizedCalendarItem[]): NormalizedCalendarItem[] {
  const groups = new Map<string, NormalizedCalendarItem>();

  for (const item of items) {
    const key = [
      item.date,
      item.category,
      item.name,
      item.rewardType,
      item.rewardText ?? ""
    ].join("|");
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, item);
      continue;
    }

    existing.times = Array.from(new Set([...existing.times, ...item.times])).sort(compareTimeText);
  }

  return Array.from(groups.values()).sort(compareNormalizedItems);
}

function compareNormalizedItems(left: NormalizedCalendarItem, right: NormalizedCalendarItem): number {
  const leftKey = `${left.date} ${left.times[0] ?? "99:99"} ${left.category} ${left.name}`;
  const rightKey = `${right.date} ${right.times[0] ?? "99:99"} ${right.category} ${right.name}`;
  return leftKey.localeCompare(rightKey, "ko-KR");
}

function compareSchedules(left: AdventureIslandSchedule, right: AdventureIslandSchedule): number {
  if (left.sortKey !== right.sortKey) {
    return left.sortKey - right.sortKey;
  }
  return left.name.localeCompare(right.name, "ko-KR");
}

function setsOverlap(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
}

function toDateTimeKey(parts: KstDateTimeParts): string {
  return `${parts.date}T${parts.time}:00`;
}

function getScheduleBusinessDate(date: string, time: string): string {
  return getLostArkBusinessDateForKstDateTime({
    date,
    time
  });
}

function formatKstIsoOffset(now: Date): string {
  return `${formatKstDateTime(now).replace(" ", "T")}:00+09:00`;
}

function createSortKey(date: string, time: string): number {
  return Number.parseInt(`${date.replaceAll("-", "")}${time.replace(":", "")}`, 10);
}

function compareTimeText(left: string, right: string): number {
  return left.localeCompare(right);
}

function getFirstExistingValue(item: CalendarRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (item[key] != null) {
      return item[key];
    }
  }
  return null;
}

function getFirstValueWithPresence(
  item: CalendarRecord,
  keys: string[]
): { found: boolean; value: unknown } {
  for (const key of keys) {
    if (key in item) {
      return { found: true, value: item[key] };
    }
  }
  return { found: false, value: null };
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
