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
};

type IslandFieldGroup = {
  name: string;
  rewardCategory: RewardCategory;
  times: string[];
  sortKey: number;
};

const EMBED_DESCRIPTION_LIMIT = 4096;
const DEFAULT_CATEGORY = "모험 섬";

export function createDiscordPayload(briefing: AdventureIslandBriefing): DiscordWebhookPayload {
  return {
    embeds: [
      {
        title: createTitle(briefing),
        description: truncateDescription(createDescription(briefing))
      }
    ]
  };
}

function createTitle(briefing: AdventureIslandBriefing): string {
  return `${briefing.targetDate}(${toShortWeekday(briefing.weekday)}) 일정`;
}

function createDescription(briefing: AdventureIslandBriefing): string {
  const categoryGroups = groupSchedulesByCategory(briefing.islands);
  const fieldBossSchedules = categoryGroups.get("필드 보스") ?? [];
  const chaosGateSchedules = categoryGroups.get("카오스게이트") ?? [];
  const adventureIslandSchedules = categoryGroups.get("모험 섬") ?? [];

  return [
    "### 필드 보스",
    formatAvailabilityBlock(fieldBossSchedules.length > 0),
    "### 카오스게이트",
    formatAvailabilityBlock(chaosGateSchedules.length > 0),
    "### 모험 섬",
    ...renderAdventureIslandLines(adventureIslandSchedules)
  ].join("\n");
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

function groupSchedulesByCategory(
  schedules: AdventureIslandSchedule[]
): Map<string, AdventureIslandSchedule[]> {
  const groups = new Map<string, AdventureIslandSchedule[]>();

  for (const schedule of schedules) {
    const category = schedule.category ?? DEFAULT_CATEGORY;
    const existing = groups.get(category) ?? [];
    existing.push(schedule);
    groups.set(category, existing);
  }

  return groups;
}

function formatAvailabilityBlock(hasItems: boolean): string {
  return hasItems ? "```yaml\nO\n```" : "```prolog\nX\n```";
}

function renderAdventureIslandLines(schedules: AdventureIslandSchedule[]): string[] {
  if (schedules.length === 0) {
    return ["조회된 모험 섬 일정이 없습니다."];
  }

  return groupIslands(schedules).map(formatIslandLine);
}

function getAdventureIslandTimePeriodLabel(times: string[]): "오전" | "오후" | "종일" {
  const hours = times.map((time) => Number.parseInt(time.slice(0, 2), 10));
  const hasEvening = hours.some((hour) => hour >= 18);
  const hasDaytime = hours.some((hour) => hour < 18);

  if (hasDaytime && hasEvening) {
    return "종일";
  }
  if (hasEvening) {
    return "오후";
  }
  return "오전";
}

function formatIslandLine(group: IslandFieldGroup): string {
  const timeLabel = getAdventureIslandTimePeriodLabel(group.times);
  const rewardLabel = toDisplayRewardLabel(group.rewardCategory);
  const codeBlockLanguage = rewardLabel === "골드" ? "fix" : "text";

  return `\`\`\`${codeBlockLanguage}\n[${timeLabel}] ${group.name} | ${rewardLabel}\n\`\`\``;
}

function compareTimeText(left: string, right: string): number {
  return left.localeCompare(right);
}

function toDisplayRewardLabel(rewardCategory: RewardCategory): string {
  switch (rewardCategory) {
    case "카드":
      return "카드 팩";
    case "주화":
      return "주화";
    case "실링":
      return "실링";
    case "골드":
      return "골드";
    default:
      return "기타";
  }
}

function truncateDescription(description: string): string {
  if (description.length <= EMBED_DESCRIPTION_LIMIT) {
    return description;
  }

  return `${description.slice(0, EMBED_DESCRIPTION_LIMIT - 20)}\n...내용 생략`;
}
