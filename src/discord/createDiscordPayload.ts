import type {
  AdventureIslandBriefing,
  AdventureIslandSchedule,
  RewardCategory
} from "../briefing/briefingTypes.js";

export type DiscordWebhookPayload = {
  username?: string;
  content?: string;
  embeds?: DiscordEmbed[];
};

type DiscordEmbed = {
  title: string;
  description?: string;
  color: number;
  timestamp: string;
  footer: {
    text: string;
  };
  fields?: DiscordEmbedField[];
};

type DiscordEmbedField = {
  name: string;
  value: string;
  inline: boolean;
};

type IslandFieldGroup = {
  name: string;
  rewardCategory: RewardCategory;
  times: string[];
  sortKey: number;
};

const FIELD_NAME_LIMIT = 256;
const FIELD_VALUE_LIMIT = 1024;
const MAX_EMBED_FIELDS = 25;

const REWARD_COLORS: Record<RewardCategory, number> = {
  "대양의 주화": 0x3498db,
  실링: 0x95a5a6,
  골드: 0xf1c40f,
  "카드 팩": 0x9b59b6
};

const REWARD_COLOR_PRIORITY: RewardCategory[] = ["골드", "카드 팩", "대양의 주화", "실링"];

export function createDiscordPayload(briefing: AdventureIslandBriefing): DiscordWebhookPayload {
  const fields = createFields(briefing);

  return {
    username: "Lostark Notice",
    embeds: [
      {
        title: createTitle(briefing),
        description: fields.length > 0 ? "### 모험 섬" : "조회된 모험 섬 일정이 없습니다.",
        color: chooseEmbedColor(briefing.islands),
        timestamp: new Date().toISOString(),
        footer: {
          text: "Lost Ark Open API"
        },
        fields
      }
    ]
  };
}

function createTitle(briefing: AdventureIslandBriefing): string {
  return `${briefing.targetDate} (${toShortWeekday(briefing.weekday)}) 일정`;
}

function createFields(briefing: AdventureIslandBriefing): DiscordEmbedField[] {
  return groupIslands(briefing.islands)
    .slice(0, MAX_EMBED_FIELDS)
    .map((group) => ({
      name: truncateFieldText(
        `[${getTimePeriodLabel(group.times)}] ${group.name} | ${group.rewardCategory}`,
        FIELD_NAME_LIMIT
      ),
      value: truncateFieldText(group.times.join(", "), FIELD_VALUE_LIMIT),
      inline: false
    }));
}

function toShortWeekday(weekday: string): string {
  return weekday.replace("요일", "");
}

function groupIslands(islands: AdventureIslandSchedule[]): IslandFieldGroup[] {
  const groups = new Map<string, IslandFieldGroup>();

  for (const island of islands) {
    const key = `${island.name}|${island.rewardCategory}`;
    const existing = groups.get(key);

    if (existing) {
      existing.times.push(island.startTime);
      existing.sortKey = Math.min(existing.sortKey, island.sortKey);
      continue;
    }

    groups.set(key, {
      name: island.name,
      rewardCategory: island.rewardCategory,
      times: [island.startTime],
      sortKey: island.sortKey
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      times: Array.from(new Set(group.times)).sort(compareTimeText)
    }))
    .sort((left, right) => {
      if (left.sortKey !== right.sortKey) {
        return left.sortKey - right.sortKey;
      }
      return left.name.localeCompare(right.name, "ko-KR");
    });
}

function getTimePeriodLabel(times: string[]): "오전" | "오후" | "종일" {
  const hasMorning = times.some((time) => getStartHour(time) < 12);
  const hasAfternoon = times.some((time) => getStartHour(time) >= 12);

  if (hasMorning && hasAfternoon) {
    return "종일";
  }
  if (hasMorning) {
    return "오전";
  }
  return "오후";
}

function chooseEmbedColor(islands: AdventureIslandSchedule[]): number {
  const rewards = new Set(islands.map((island) => island.rewardCategory));
  const representativeReward = REWARD_COLOR_PRIORITY.find((reward) => rewards.has(reward));

  return representativeReward ? REWARD_COLORS[representativeReward] : 0x5865f2;
}

function compareTimeText(left: string, right: string): number {
  return left.localeCompare(right);
}

function getStartHour(time: string): number {
  return Number.parseInt(time.slice(0, 2), 10);
}

function truncateFieldText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 1)}…`;
}
