import { buildAdventureIslandBriefing } from "./briefing/buildAdventureIslandBriefing.js";
import { loadConfig } from "./config.js";
import { createDiscordPayload } from "./discord/createDiscordPayload.js";
import { sendDiscordPayloadToWebhooks } from "./discord/webhookSender.js";
import { fetchLostArkCalendar } from "./lostark/lostarkClient.js";
import { getLostArkBusinessDate } from "./time.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const now = new Date();
  const targetDate = getLostArkBusinessDate(now);

  console.log(`[lostark-notice] ${targetDate} 모험 섬 일정 조회 시작`);

  const calendarResponse = await fetchLostArkCalendar({
    apiKey: config.lostArkApiKey,
    baseUrl: config.lostArkApiBaseUrl,
    timeoutMs: config.requestTimeoutMs
  });
  const briefing = buildAdventureIslandBriefing(calendarResponse, { now, targetDate });

  console.log(`[lostark-notice] 모험 섬 일정 ${briefing.islands.length}건 생성`);

  const payload = createDiscordPayload(briefing);
  const results = await sendDiscordPayloadToWebhooks(config.webhooks, payload, {
    timeoutMs: config.requestTimeoutMs
  });
  const successCount = results.filter((result) => result.ok).length;

  if (successCount === 0) {
    throw new Error("All Discord webhook deliveries failed.");
  }

  console.log(`[lostark-notice] Discord webhook ${successCount}/${results.length}건 전송 완료`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[lostark-notice] 실행 실패: ${message}`);
  process.exitCode = 1;
});
