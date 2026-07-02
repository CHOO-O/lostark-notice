export const REWARD_NAMES = ["골드", "카드 팩", "주화", "실링"] as const;

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
