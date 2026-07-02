import {
  REWARD_CATEGORIES,
  type AdventureIslandBriefing,
  type AdventureIslandSchedule,
  type RewardCategory
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
        title: briefing.title,
        description: truncateEmbedDescription(createDescription(briefing)),
        color: 0x5865f2,
        timestamp: new Date().toISOString(),
        footer: {
          text: "Lost Ark Open API"
        }
      }
    ]
  };
}

function createDescription(briefing: AdventureIslandBriefing): string {
  const lines = [
    `${briefing.targetDate} ${briefing.weekday} / ${briefing.timezone} 기준`,
    `로스트아크 일일 초기화 기준: ${briefing.resetTime} KST`,
    ""
  ];

  if (briefing.islands.length === 0) {
    lines.push("오늘 조회된 모험 섬 일정이 없습니다.");
  } else {
    lines.push(...createRewardSections(briefing.islands));
  }

  lines.push(
    "",
    `마지막 갱신: ${briefing.updatedAt} KST`,
    `데이터 출처: ${briefing.source}`
  );

  return lines.join("\n");
}

function createRewardSections(islands: AdventureIslandSchedule[]): string[] {
  const sections: string[] = [];

  for (const category of REWARD_CATEGORIES) {
    const categoryItems = islands.filter((island) => island.rewardCategory === category);
    if (categoryItems.length === 0) {
      continue;
    }

    if (sections.length > 0) {
      sections.push("");
    }

    sections.push(`[${category}]`);
    sections.push(...categoryItems.map(formatIslandLine));
  }

  return sections;
}

function formatIslandLine(island: AdventureIslandSchedule): string {
  const details = createDetails(island);
  return details ? `- ${island.startTime} ${island.name} (${details})` : `- ${island.startTime} ${island.name}`;
}

function createDetails(island: AdventureIslandSchedule): string {
  const parts = [
    island.rewardSummary,
    island.location ? `위치: ${island.location}` : null,
    island.minItemLevel != null ? `입장 레벨: ${island.minItemLevel}` : null
  ].filter((part): part is string => Boolean(part));

  return parts.join(" / ");
}

function truncateEmbedDescription(description: string): string {
  if (description.length <= EMBED_DESCRIPTION_LIMIT) {
    return description;
  }

  return `${description.slice(0, EMBED_DESCRIPTION_LIMIT - 20)}\n...내용 생략`;
}
