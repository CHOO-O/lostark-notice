# Lostark Notice

로스트아크 공식 Open API의 Calendar 데이터를 주 1회 저장하고, 저장된 JSON을 기준으로 매일 모험 섬 일정을 Discord Webhook으로 전송하는 GitHub Actions 자동화 프로젝트입니다.

API 호출과 Discord 알림 전송을 분리합니다.

```text
get-weekly-calendar
→ Lost Ark Calendar API 호출
→ data/calendar 기존 JSON 정리
→ raw-latest.json 저장
→ normalized-latest.json 생성
→ data/calendar/에 commit

daily-notice
→ data/calendar/normalized-latest.json 읽기
→ Lost Ark 기준 당일 모험 섬 필터링
→ Discord Embed payload 생성
→ Webhook 전송
```

## Workflows

### get-weekly-calender.yml

파일: `.github/workflows/get-weekly-calender.yml`

workflow name: `get-weekly-calendar`

매주 수요일 10:00 KST에 실행됩니다.

```yaml
schedule:
  - cron: "0 1 * * 3"
```

역할:

- `GET /gamecontents/calendar` 호출
- `data/calendar/*.json` 정리
- `data/calendar/raw-latest.json` 저장
- `data/calendar/normalized-latest.json` 저장
- 변경사항이 있을 때만 commit/push

이 workflow는 JSON 파일을 repository에 commit해야 하므로 `contents: write` 권한을 사용합니다.

### daily-notice.yml

파일: `.github/workflows/daily-notice.yml`

workflow name: `daily-notice`

월/화/목/금/토/일 10:00 KST에 schedule로 실행됩니다. 수요일은 중복 실행을 막기 위해 schedule에서 제외합니다.

```yaml
schedule:
  - cron: "0 1 * * 0,1,2,4,5,6"
```

수요일에는 `get-weekly-calendar`가 성공한 뒤 `workflow_run`으로 실행됩니다.

```yaml
workflow_run:
  workflows: ["get-weekly-calendar"]
  types:
    - completed
```

daily-notice는 `LOSTARK_API_KEY`를 사용하지 않으며 Lost Ark API를 직접 호출하지 않습니다. 저장된 `data/calendar/normalized-latest.json`만 읽습니다.

## 수요일 실행 순서

```text
수요일 10:00 KST
→ get-weekly-calendar 실행
→ Calendar API 호출
→ 기존 calendar JSON 정리
→ raw-latest.json / normalized-latest.json 저장 및 commit/push
→ get-weekly-calendar 성공 종료
→ workflow_run으로 daily-notice 실행
→ 저장된 normalized JSON 기준 Discord 공지 전송
```

## Secrets

GitHub Repository에서 `Settings → Secrets and variables → Actions → New repository secret` 경로로 등록합니다.

필수:

- `LOSTARK_API_KEY`: 주간 캘린더 동기화용 Lost Ark Open API JWT
- `DISCORD_WEBHOOK_TEST`: 테스트용 Discord Webhook URL

선택:

- `DISCORD_WEBHOOK_MAIN`: 운영용 Discord Webhook URL
- `DISCORD_WEBHOOK_CAFE`: 카페 채널 Discord Webhook URL
- `DISCORD_WEBHOOK_EXTRA`: 추가 채널 Discord Webhook URL

Webhook Secret은 값이 있는 항목만 `DISCORD_WEBHOOK_TEST → DISCORD_WEBHOOK_MAIN → DISCORD_WEBHOOK_CAFE → DISCORD_WEBHOOK_EXTRA` 순서로 전송합니다.

## 저장 파일

`get-weekly-calendar`는 실행 시 `data/calendar`의 기존 JSON 파일을 정리한 뒤 다음 두 파일만 생성하거나 갱신합니다.

- `data/calendar/raw-latest.json`: Lost Ark Calendar API raw response
- `data/calendar/normalized-latest.json`: daily-notice가 읽는 정규화 데이터

날짜별 백업 JSON은 더 이상 생성하지 않습니다. 기존에 repository에 남아 있는 `YYYY-MM-DD.raw.json`, `YYYY-MM-DD.normalized.json` 같은 파일은 다음 `get-weekly-calendar` 실행 시 삭제 변경으로 commit됩니다.

`normalized-latest.json`은 daily-notice가 raw API 구조에 직접 의존하지 않도록 다음 정보를 포함합니다.

- 동기화 시각
- 데이터 출처
- 로스트아크 일일 초기화 기준
- 일정 날짜
- 카테고리 (`모험 섬`, `필드 보스`, `카오스게이트`)
- 콘텐츠 이름
- 등장 시간 목록
- 위치
- 최소 아이템 레벨
- 정규화된 보상 타입
- 보상 텍스트
- 아이콘 URL
- raw 참조 정보

현재 `daily-notice`는 `enabledCategories = ["모험 섬"]` 기준으로 모험 섬만 전송합니다. 이후 같은 normalized 구조에서 `["모험 섬", "필드 보스", "카오스게이트"]`처럼 확장할 수 있습니다.

## 수동 실행 순서

1. GitHub Actions에서 `get-weekly-calendar`를 수동 실행합니다.
2. `data/calendar/normalized-latest.json` 생성 또는 갱신을 확인합니다.
3. GitHub Actions에서 `daily-notice`를 수동 실행합니다.
4. Discord 메시지를 확인합니다.

`daily-notice` 실행 시 `data/calendar/normalized-latest.json`이 없으면 실패합니다. 이 경우 가능한 경우 Discord에도 다음 메시지를 보냅니다.

```text
저장된 캘린더 데이터가 없습니다.
get-weekly-calendar workflow를 먼저 실행해주세요.
```

## Workflow 권한

`get-weekly-calendar`는 repository에 JSON 파일을 commit해야 합니다. workflow 파일에는 다음 권한이 포함되어 있습니다.

```yaml
permissions:
  contents: write
```

Repository 설정에서도 필요하면 다음을 확인합니다.

```text
Repository
→ Settings
→ Actions
→ General
→ Workflow permissions
→ Read and write permissions
```

## 보상 분류 기준

보상은 다음 중 하나로 정규화합니다.

- `골드`: `골드`, `귀속 골드`, `gold`
- `카드`: `카드 팩`, `card pack`
- `주화`: `대양의 주화 상자`, `해적 주화`, `주화`, `coin`
- `실링`: `실링`, `shilling`, `silver`
- `기타`: 위 키워드로 판별되지 않는 경우

분류 우선순위는 `골드 → 카드 → 주화 → 실링`입니다. normalized 생성 시 날짜별 `targetDateTimeSet`을 만들고, `RewardItems`를 다음처럼 나눕니다.

- `commonRewards`: `StartTimes`가 없거나 `null`인 보상
- `timedRewards`: `StartTimes`가 있고 해당 날짜/시간과 겹치는 보상
- `ignoredRewards`: `StartTimes`가 있지만 해당 날짜/시간과 겹치지 않는 보상

`rewardText`는 `commonRewards + timedRewards`로 만들고, `ignoredRewards`는 포함하지 않습니다. `rewardType`은 `timedRewards`를 우선 사용하며, 비어 있을 때만 `commonRewards`로 fallback합니다. 단일 카드명은 대표 카드 보상으로 보지 않고, 카드 팩 계열만 `카드`로 분류합니다.

## Lost Ark 날짜 기준

로스트아크 일일 초기화 시간은 KST 06:00으로 봅니다.

```text
현재 KST 시간이 06:00 이상이면 오늘
현재 KST 시간이 06:00 미만이면 전날
```

daily-notice는 오전 10시에 실행되므로 일반적으로 오늘 날짜와 같지만, 내부 로직은 초기화 시간 기준을 반영합니다.

## 로컬 실행

```bash
npm ci
npm run build
```

주간 캘린더 동기화:

```powershell
$env:LOSTARK_API_KEY="발급받은 JWT"
npm run sync:calendar
```

일일 공지:

```powershell
$env:DISCORD_WEBHOOK_TEST="Discord Webhook URL"
npm run notify:daily
```

## 보안 주의사항

- Lost Ark API Key를 코드에 직접 넣지 말 것
- Lost Ark API Key를 JSON 파일에 저장하지 말 것
- Discord Webhook URL을 코드에 직접 넣지 말 것
- Discord Webhook URL을 JSON 파일에 저장하지 말 것
- API Key와 Webhook URL은 GitHub Actions Secrets로 관리할 것
- 로그에 Authorization 헤더나 Webhook URL 원문을 출력하지 말 것
- raw JSON에도 인증 관련 값을 저장하지 말 것
- Webhook URL이 유출되면 즉시 삭제 후 재발급할 것
