import type { RewardCategory } from "../briefing/briefingTypes.js";

export type NormalizedCalendarData = {
  schemaVersion: 1;
  syncedAt: string;
  source: "Lost Ark Open API /gamecontents/calendar";
  resetHourKst: 6;
  items: NormalizedCalendarItem[];
};

export type NormalizedCalendarItem = {
  date: string;
  category: "모험 섬";
  name: string;
  times: string[];
  rewardType: RewardCategory;
  rewardText: string | null;
  raw: {
    schedules: NormalizedCalendarRawSchedule[];
  };
};

export type NormalizedCalendarRawSchedule = {
  startDate: string;
  startTime: string;
  rewardSummary: string | null;
  location: string | null;
  iconUrl: string | null;
  minItemLevel: number | null;
};
