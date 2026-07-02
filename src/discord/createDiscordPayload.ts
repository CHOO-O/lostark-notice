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

const SECTION_FIELD_NAME = "모험 섬";
const EMPTY_FIELD_NAME = "\u200B";
const FIELD_VALUE_LIMIT = 1024;
const MAX_EMBED_FIELDS = 25;

export function createDiscordPayload(briefing: AdventureIslandBriefing): DiscordWebhookPayload {
  const fields = createFields(briefing);

  return {
    username: "Lostark Notice",
    embeds: [
      {
        title: createTitle(briefing),
        description: fields.length > 0 ? undefined : "조회된 모험 섬 일정이 없습니다.",
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
    .map((group, index) => ({
      name: index === 0 ? SECTION_FIELD_NAME : EMPTY_FIELD_NAME,
      value: truncateFieldText(formatIslandFieldValue(group), FIELD_VALUE_LIMIT),
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

function formatIslandFieldValue(group: IslandFieldGroup): string {
  return [
    `[${getTimePeriodLabel(group.times)}] ${group.name} | ${formatReward(group.rewardCategory)}`,
    group.times.join(", ")
  ].join("\n");
}

function formatReward(rewardCategory: RewardCategory): string {
  return rewardCategory === "골드" ? "**골드**" : rewardCategory;
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
