export const REWARD_NAMES = ["실링", "카드", "주화", "골드", "기타"] as const;

export type RewardCategory = (typeof REWARD_NAMES)[number];

export type AdventureIslandSchedule = {
  name: string;
  startDate: string;
  startTime: string;
  sortKey: number;
  rewardCategory: RewardCategory;
  rewardSummary: string | null;
  location: string | null;
  iconUrl: string | null;
  minItemLevel: number | null;
};

export type AdventureIslandBriefing = {
  title: string;
  targetDate: string;
  weekday: string;
  timezone: "KST";
  resetTime: "06:00";
  updatedAt: string;
  source: "Lost Ark Open API";
  islands: AdventureIslandSchedule[];
};
