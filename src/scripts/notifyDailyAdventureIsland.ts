import { buildAdventureIslandBriefingFromSchedules } from "../briefing/buildAdventureIslandBriefing.js";
import { CalendarDataNotFoundError, loadNormalizedCalendarData } from "../calendar/loadCalendarData.js";
import type { NormalizedCalendarCategory } from "../calendar/calendarTypes.js";
import { toSchedulesFromNormalized } from "../calendar/normalizeCalendar.js";
import { loadDailyNoticeConfig } from "../config.js";
import { createDiscordPayload, type DiscordWebhookPayload } from "../discord/createDiscordPayload.js";
import { sendDiscordPayloadToWebhooks } from "../discord/webhookSender.js";
import { getLostArkBusinessDate } from "../time.js";

const enabledCategories: readonly NormalizedCalendarCategory[] = [
  "필드 보스",
  "카오스게이트",
  "모험 섬"
];

async function main(): Promise<void> {
  const config = loadDailyNoticeConfig();
  const now = new Date();
  const targetDate = getLostArkBusinessDate(now);

  console.log(`[daily-notice] ${targetDate} 저장 캘린더 기준 공지 생성 시작`);

  try {
    const normalizedCalendarData = await loadNormalizedCalendarData();
    const schedules = toSchedulesFromNormalized(
      normalizedCalendarData,
      targetDate,
      enabledCategories
    );
    const briefing = buildAdventureIslandBriefingFromSchedules(schedules, { now, targetDate });
    const payload = createDiscordPayload(briefing);
    const results = await sendDiscordPayloadToWebhooks(config.webhooks, payload, {
      timeoutMs: config.requestTimeoutMs
    });
    const successCount = results.filter((result) => result.ok).length;

    if (successCount === 0) {
      throw new Error("All Discord webhook deliveries failed.");
    }

    console.log(`[daily-notice] Discord webhook ${successCount}/${results.length}건 전송 완료`);
  } catch (error) {
    if (error instanceof CalendarDataNotFoundError) {
      console.error(`[daily-notice] ${error.message}`);
      await sendFailureNotice(config, error.message);
    }
    throw error;
  }
}

async function sendFailureNotice(
  config: ReturnType<typeof loadDailyNoticeConfig>,
  message: string
): Promise<void> {
  const payload: DiscordWebhookPayload = {
    content: message
  };

  await sendDiscordPayloadToWebhooks(config.webhooks, payload, {
    timeoutMs: config.requestTimeoutMs
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[daily-notice] 실행 실패: ${message}`);
  process.exitCode = 1;
});
