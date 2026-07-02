import { loadCalendarSyncConfig } from "../config.js";
import { normalizeCalendar } from "../calendar/normalizeCalendar.js";
import { saveCalendarData } from "../calendar/saveCalendarData.js";
import { fetchLostArkCalendar } from "../lostark/lostarkClient.js";
import { formatKstDateTime } from "../time.js";

async function main(): Promise<void> {
  const config = loadCalendarSyncConfig();
  const now = new Date();
  const syncDate = formatKstDateTime(now).slice(0, 10);

  console.log(`[calendar-sync] ${syncDate} 주간 캘린더 동기화 시작`);

  const rawCalendarResponse = await fetchLostArkCalendar({
    apiKey: config.lostArkApiKey,
    baseUrl: config.lostArkApiBaseUrl,
    timeoutMs: config.requestTimeoutMs
  });
  const normalizedCalendarData = normalizeCalendar(rawCalendarResponse, now);
  const paths = await saveCalendarData(rawCalendarResponse, normalizedCalendarData);

  console.log(`[calendar-sync] normalized items: ${normalizedCalendarData.items.length}`);
  console.log(`[calendar-sync] saved: ${paths.rawLatestPath}`);
  console.log(`[calendar-sync] saved: ${paths.normalizedLatestPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[calendar-sync] 실행 실패: ${message}`);
  process.exitCode = 1;
});
