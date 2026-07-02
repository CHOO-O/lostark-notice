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
  description: string;
  timestamp: string;
  footer: {
    text: string;
  };
};

type IslandFieldGroup = {
  name: string;
  rewardCategory: RewardCategory;
  times: string[];
  sortKey: number;
};

const EMBED_DESCRIPTION_LIMIT = 4096;

export function createDiscordPayload(briefing: AdventureIslandBriefing): DiscordWebhookPayload {
  return {
    username: "Lostark Notice",
    embeds: [
      {
        title: createTitle(briefing),
        description: truncateDescription(createDescription(briefing)),
        timestamp: new Date().toISOString(),
        footer: {
          text: "Lost Ark Open API"
        }
      }
    ]
  };
}

function createTitle(briefing: AdventureIslandBriefing): string {
  return `${briefing.targetDate} (${toShortWeekday(briefing.weekday)}) 일정`;
}

function createDescription(briefing: AdventureIslandBriefing): string {
  const lines = ["### 모험 섬"];

  if (briefing.islands.length === 0) {
    lines.push("조회된 모험 섬 일정이 없습니다.");
  } else {
    lines.push(...groupIslands(briefing.islands).map(formatIslandLine));
  }

  return lines.join("\n");
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

function formatIslandLine(group: IslandFieldGroup): string {
  const timeLabel = getTimePeriodLabel(group.times);

  if (group.rewardCategory === "골드") {
    return `\`\`\`fix\n[${timeLabel}] ${group.name} | 골드\n\`\`\``;
  }

  return `\`\`\`[${timeLabel}] ${group.name} | ${group.rewardCategory}\`\`\``;
}

function compareTimeText(left: string, right: string): number {
  return left.localeCompare(right);
}

function getStartHour(time: string): number {
  return Number.parseInt(time.slice(0, 2), 10);
}

function truncateDescription(description: string): string {
  if (description.length <= EMBED_DESCRIPTION_LIMIT) {
    return description;
  }

  return `${description.slice(0, EMBED_DESCRIPTION_LIMIT - 20)}\n...내용 생략`;
}
