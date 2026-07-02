# Lostark Notice

로스트아크 공식 Open API에서 오늘의 모험 섬 일정을 조회하고 Discord Webhook으로 전송하는 GitHub Actions 자동화 프로젝트입니다.

매일 오전 10:00 KST에 실행되며, 수동 실행도 지원합니다. Discord Bot이나 `discord.js`는 사용하지 않고 Webhook API에 직접 POST합니다.

## 동작 구조

```text
GitHub Actions
→ Lost Ark Calendar API 호출
→ 오늘 기준 모험 섬 일정 필터링
→ 보상 분류
→ Discord Embed payload 생성
→ 설정된 Webhook에 순차 전송
```

로직은 이후 Discord Bot으로 옮기기 쉽도록 API 호출, 일정 adapter, 브리핑 생성, Discord payload 생성, Webhook 전송으로 분리되어 있습니다.

## 필요한 Secrets

GitHub Repository에서 `Settings → Secrets and variables → Actions → New repository secret` 경로로 등록합니다.

필수:

- `LOSTARK_API_KEY`: 로스트아크 Open API JWT
- `DISCORD_WEBHOOK_TEST`: 테스트용 Discord Webhook URL

선택:

- `DISCORD_WEBHOOK_MAIN`: 운영용 Discord Webhook URL
- `DISCORD_WEBHOOK_EXTRA`: 추가 채널 Discord Webhook URL

Webhook Secret은 값이 있는 항목만 `DISCORD_WEBHOOK_TEST → DISCORD_WEBHOOK_MAIN → DISCORD_WEBHOOK_EXTRA` 순서로 전송합니다.

## Lost Ark API Key 등록

1. [Lostark OpenAPI Developer Portal](https://developer-lostark.game.onstove.com/)에 로그인합니다.
2. Client를 생성하고 JWT Key를 발급받습니다.
3. GitHub Actions Secret `LOSTARK_API_KEY`에 발급받은 JWT를 저장합니다.

코드가 `Authorization` 헤더에 `bearer` 접두사를 붙입니다. Secret에 `bearer ...` 형태로 넣어도 중복으로 붙지 않습니다.

## Discord Webhook URL 등록

1. Discord 채널 설정에서 `연동 → 웹후크`를 엽니다.
2. 새 Webhook을 만들고 URL을 복사합니다.
3. GitHub Actions Secret `DISCORD_WEBHOOK_TEST`에 저장합니다.
4. 추가 채널도 보내려면 `DISCORD_WEBHOOK_MAIN`, `DISCORD_WEBHOOK_EXTRA`에 각각 저장합니다.

## GitHub Actions 실행

워크플로 파일은 `.github/workflows/daily-adventure-island.yml`입니다.

자동 실행:

```yaml
schedule:
  - cron: "0 1 * * *"
```

`0 1 * * *`는 UTC 01:00이며, 한국 시간으로 매일 오전 10:00입니다.

수동 실행:

1. GitHub Repository의 `Actions` 탭으로 이동합니다.
2. `Daily Adventure Island Notice` workflow를 선택합니다.
3. `Run workflow`를 누릅니다.

## 예약 시간 변경

GitHub Actions cron은 UTC 기준입니다. 예를 들어 KST 09:30에 실행하려면 UTC 00:30이므로 다음처럼 바꿉니다.

```yaml
- cron: "30 0 * * *"
```

스크립트는 로스트아크 일일 초기화 시간인 06:00 KST를 기준으로 날짜를 계산합니다. 실행 시간이 06:00 KST 이전이면 전날을 기준일로 봅니다.

## 보상 분류 기준

API 응답의 보상 텍스트를 기준으로 다음 카테고리 중 하나로 분류합니다.

- `실링`: `실링`, `shilling`, `silver`
- `카드`: `카드`, `card`
- `주화`: `주화`, `해적`, `항해`, `coin`
- `골드`: `골드`, `gold`
- `기타`: 위 키워드로 판별되지 않는 경우

보상 판별 로직은 `src/briefing/rewardClassifier.ts`에 분리되어 있어 실제 API 응답에 맞춰 수정할 수 있습니다.

## 로컬 실행

```bash
npm ci
npm run build
npm start
```

로컬에서 실행하려면 같은 이름의 환경변수를 먼저 설정해야 합니다.

PowerShell 예시:

```powershell
$env:LOSTARK_API_KEY="발급받은 JWT"
$env:DISCORD_WEBHOOK_TEST="Discord Webhook URL"
npm start
```

## 문제 해결

- `LOSTARK_API_KEY secret is required.`: GitHub Actions Secret 또는 로컬 환경변수가 비어 있습니다.
- `Lost Ark API authentication failed.`: API Key가 잘못되었거나 `bearer` 형식 인증에 실패했습니다.
- `Lost Ark API rate limit exceeded.`: Open API 호출 제한에 걸렸습니다. 잠시 후 다시 실행합니다.
- `webhook was deleted or is invalid`: Discord Webhook URL이 삭제되었거나 잘못되었습니다.
- `All Discord webhook deliveries failed.`: 설정된 모든 Webhook 전송이 실패했습니다.

## 보안 주의사항

- Lost Ark API Key를 코드에 직접 넣지 말 것
- Discord Webhook URL을 코드에 직접 넣지 말 것
- API Key와 Webhook URL은 GitHub Actions Secrets로 관리할 것
- 로그에 Authorization 헤더나 Webhook URL 원문을 출력하지 말 것
- Webhook URL이 유출되면 해당 채널에 외부 메시지가 전송될 수 있으므로 즉시 삭제 후 재발급할 것
