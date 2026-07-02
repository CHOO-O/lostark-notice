import type {
  AdventureIslandBriefing,
  AdventureIslandSchedule
} from "../briefing/briefingTypes.js";

export type DiscordWebhookPayload = {
  username?: string;
  content?: string;
  embeds?: DiscordEmbed[];
};

type DiscordEmbed = {
  title: string;
  description: string;
  color: number;
  timestamp: string;
  footer: {
    text: string;
  };
};

const EMBED_DESCRIPTION_LIMIT = 4096;

export function createDiscordPayload(briefing: AdventureIslandBriefing): DiscordWebhookPayload {
  return {
    username: "Lostark Notice",
    embeds: [
      {
        title: createTitle(briefing),
        description: truncateEmbedDescription(createDescription(briefing)),
        color: 0xf1c40f,
        timestamp: new Date().toISOString(),
        footer: {
          text: "Lost Ark Open API"
        }
      }
    ]
  };
}

function createDescription(briefing: AdventureIslandBriefing): string {
  const lines = ["### 모험 섬"];

  if (briefing.islands.length === 0) {
    lines.push("조회된 모험 섬 일정이 없습니다.");
  } else {
    lines.push(...createIslandLines(briefing));
  }

  return lines.join("\n");
}

function createTitle(briefing: AdventureIslandBriefing): string {
  return `${briefing.targetDate} (${toShortWeekday(briefing.weekday)}) 일정`;
}

function createIslandLines(briefing: AdventureIslandBriefing): string[] {
  if (!isWeekend(briefing.targetDate)) {
    return briefing.islands.map((island) => formatIslandLine(island, island.startTime));
  }

  const morning = briefing.islands.filter((island) => getStartHour(island) < 12);
  const afternoon = briefing.islands.filter((island) => getStartHour(island) >= 12);
  const lines: string[] = [];

  lines.push(...morning.map((island) => formatIslandLine(island, "오전")));

  if (morning.length > 0 && afternoon.length > 0) {
    lines.push("");
  }

  lines.push(...afternoon.map((island) => formatIslandLine(island, "오후")));

  return lines;
}

function formatIslandLine(island: AdventureIslandSchedule, timeLabel: string): string {
  if (island.rewardCategory === "골드") {
    return `\`\`\`fix\n[${timeLabel}] ***${island.name}*** | ***골드***\n\`\`\``;
  }

  return `\`\`\`[${timeLabel}] **${island.name}** | ${island.rewardCategory}\`\`\``;
}

function toShortWeekday(weekday: string): string {
  return weekday.replace("요일", "");
}

function isWeekend(date: string): boolean {
  const day = getDayOfWeek(date);
  return day === 0 || day === 6;
}

function getDayOfWeek(date: string): number {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return -1;
  }

  const year = Number.parseInt(match[1]!, 10);
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function getStartHour(island: AdventureIslandSchedule): number {
  return Number.parseInt(island.startTime.slice(0, 2), 10);
}

function truncateEmbedDescription(description: string): string {
  if (description.length <= EMBED_DESCRIPTION_LIMIT) {
    return description;
  }

  return `${description.slice(0, EMBED_DESCRIPTION_LIMIT - 20)}\n...내용 생략`;
}
