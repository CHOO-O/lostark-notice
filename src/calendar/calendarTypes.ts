import type { RewardCategory } from "../briefing/briefingTypes.js";

export const NORMALIZED_CALENDAR_CATEGORIES = ["모험 섬", "필드 보스", "카오스게이트"] as const;

export type NormalizedCalendarCategory = (typeof NORMALIZED_CALENDAR_CATEGORIES)[number];

export type NormalizedCalendarData = {
  schemaVersion: 2;
  syncedAt: string;
  source: "Lost Ark Open API /gamecontents/calendar";
  resetHourKst: 6;
  items: NormalizedCalendarItem[];
};

export type NormalizedCalendarItem = {
  date: string;
  category: NormalizedCalendarCategory;
  name: string;
  times: string[];
  location: string | null;
  minItemLevel: number | null;
  rewardType: RewardCategory;
  rewardText: string | null;
  iconUrl: string | null;
  rawRef: {
    categoryName: string | null;
    contentsName: string | null;
  };
};
