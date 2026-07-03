export const KST_TIME_ZONE = "Asia/Seoul";
export const LOSTARK_DAILY_RESET_HOUR = 6;

type DateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

export type KstDateTimeParts = {
  date: string;
  time: string;
  sortKey: number;
};

export function getLostArkBusinessDate(now = new Date()): string {
  const parts = getKstDateTimeParts(now);
  return getLostArkBusinessDateForKstDateTime({
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  });
}

export function getLostArkBusinessDateForKstDateTime(
  parts: Pick<KstDateTimeParts, "date" | "time">
): string {
  const match = parts.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return parts.date;
  }

  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);
  const hour = Number.parseInt(parts.time.slice(0, 2), 10);

  const businessDate = new Date(Date.UTC(year, month - 1, day));
  if (hour < LOSTARK_DAILY_RESET_HOUR) {
    businessDate.setUTCDate(businessDate.getUTCDate() - 1);
  }

  return formatUtcDateOnly(businessDate);
}

export function formatKstDateTime(now = new Date()): string {
  const parts = getKstDateTimeParts(now);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function getKoreanWeekday(date: string): string {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return "";
  }

  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return weekdays[utcDate.getUTCDay()] ?? "";
}

export function parseCalendarDateTime(value: unknown): KstDateTimeParts | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toKstDateTimeParts(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (hasExplicitTimeZone(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : toKstDateTimeParts(parsed);
  }

  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2})?)?/
  );
  if (!localMatch) {
    return null;
  }

  const [, year, month, day, hour = "00", minute = "00"] = localMatch;
  const date = `${year}-${month}-${day}`;
  const time = `${hour}:${minute}`;

  return {
    date,
    time,
    sortKey: createSortKey(date, time)
  };
}

function getKstDateTimeParts(date: Date): DateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }

  return {
    year: requireDatePart(parts, "year"),
    month: requireDatePart(parts, "month"),
    day: requireDatePart(parts, "day"),
    hour: requireDatePart(parts, "hour"),
    minute: requireDatePart(parts, "minute")
  };
}

function toKstDateTimeParts(date: Date): KstDateTimeParts {
  const parts = getKstDateTimeParts(date);
  const dateText = `${parts.year}-${parts.month}-${parts.day}`;
  const timeText = `${parts.hour}:${parts.minute}`;
  return {
    date: dateText,
    time: timeText,
    sortKey: createSortKey(dateText, timeText)
  };
}

function hasExplicitTimeZone(value: string): boolean {
  return /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function requireDatePart(parts: Record<string, string>, key: string): string {
  const value = parts[key];
  if (!value) {
    throw new Error(`Unable to format KST date part: ${key}`);
  }
  return value;
}

function createSortKey(date: string, time: string): number {
  return Number.parseInt(`${date.replaceAll("-", "")}${time.replace(":", "")}`, 10);
}

function formatUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
