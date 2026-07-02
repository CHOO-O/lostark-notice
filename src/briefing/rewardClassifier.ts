import type { RewardCategory } from "./briefingTypes.js";

export type RewardClassification = {
  category: RewardCategory;
  summary: string | null;
};

const CATEGORY_RULES: Array<{ category: RewardCategory; pattern: RegExp }> = [
  { category: "골드", pattern: /골드|gold/i },
  { category: "카드 팩", pattern: /카드|card/i },
  { category: "주화", pattern: /대양|주화|해적|항해|coin/i },
  { category: "실링", pattern: /실링|shilling|silver/i }
];

export function classifyReward(rewardSource: unknown): RewardClassification {
  const namedTexts = collectRewardTexts(rewardSource, true);
  const fallbackTexts = collectRewardTexts(rewardSource, false);
  const targetTexts = namedTexts.length > 0 ? namedTexts : fallbackTexts;
  const joined = normalizeRewardText(targetTexts.join(" "));
  const matched = CATEGORY_RULES.find((rule) => rule.pattern.test(joined));

  return {
    category: matched?.category ?? "주화",
    summary: targetTexts.length > 0 ? targetTexts.slice(0, 5).join(", ") : null
  };
}

function collectRewardTexts(value: unknown, nameOnly: boolean): string[] {
  const result: string[] = [];
  collectText(value, result, 0, nameOnly);
  return Array.from(new Set(result.map((text) => text.trim()).filter(Boolean)));
}

function collectText(value: unknown, result: string[], depth: number, nameOnly: boolean): void {
  if (depth > 4 || value == null) {
    return;
  }

  if (typeof value === "string") {
    if (!isProbablyUrl(value)) {
      result.push(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, result, depth + 1, nameOnly);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isRewardTextKey(key, nameOnly)) {
      collectText(nestedValue, result, depth + 1, nameOnly);
    } else if (Array.isArray(nestedValue) && isRewardArrayKey(key)) {
      collectText(nestedValue, result, depth + 1, nameOnly);
    }
  }
}

function isRewardTextKey(key: string, nameOnly: boolean): boolean {
  if (nameOnly) {
    return /^(name|itemname|rewardname|reward_name|normalizedrewardname|normalized_reward_name)$/i.test(key);
  }

  return /^(name|itemname|rewardname|reward_name|normalizedrewardname|normalized_reward_name|grade|type|category|contentsname)$/i.test(key);
}

function isRewardArrayKey(key: string): boolean {
  return /^(rewarditems|rewards|items)$/i.test(key);
}

function isProbablyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeRewardText(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
