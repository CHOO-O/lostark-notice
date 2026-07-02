import type { RewardCategory } from "./briefingTypes.js";

export type RewardClassification = {
  category: RewardCategory;
  summary: string | null;
};

const CATEGORY_RULES: Array<{ category: RewardCategory; pattern: RegExp }> = [
  { category: "골드", pattern: /골드|gold/i },
  { category: "카드 팩", pattern: /카드|card/i },
  { category: "대양의 주화", pattern: /대양|주화|해적|항해|coin/i },
  { category: "실링", pattern: /실링|shilling|silver/i }
];

export function classifyReward(rewardSource: unknown): RewardClassification {
  const texts = collectRewardTexts(rewardSource);
  const joined = texts.join(" ");
  const matched = CATEGORY_RULES.find((rule) => rule.pattern.test(joined));

  return {
    category: matched?.category ?? "대양의 주화",
    summary: texts.length > 0 ? texts.slice(0, 5).join(", ") : null
  };
}

function collectRewardTexts(value: unknown): string[] {
  const result: string[] = [];
  collectText(value, result, 0);
  return Array.from(new Set(result.map((text) => text.trim()).filter(Boolean)));
}

function collectText(value: unknown, result: string[], depth: number): void {
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
      collectText(item, result, depth + 1);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isRewardTextKey(key)) {
      collectText(nestedValue, result, depth + 1);
    } else if (Array.isArray(nestedValue) && isRewardArrayKey(key)) {
      collectText(nestedValue, result, depth + 1);
    }
  }
}

function isRewardTextKey(key: string): boolean {
  return /^(name|itemname|rewardname|grade|type|category|contentsname)$/i.test(key);
}

function isRewardArrayKey(key: string): boolean {
  return /^(rewarditems|rewards|items)$/i.test(key);
}

function isProbablyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
