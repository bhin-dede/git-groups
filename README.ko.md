# Git Groups

VS Code 소스 컨트롤 탭에서 변경된 파일을 그룹으로 분류하고, 그룹 단위로 커밋할 수 있는 확장입니다.

## 이런 경험 있으신가요?

> "파일 10개를 수정했는데, 3개는 로그인 기능, 4개는 버그 수정, 3개는 리팩토링... 한번에 커밋하자니 히스토리가 지저분하고, 브랜치로 나누자니 서로 종속적이라 충돌이 나고..."

**기존 방법들의 한계:**
- **브랜치 분리** — 기능 간 종속성이 있으면 충돌 지옥, 매번 merge/rebase 해야 함
- **git stash** — 임시 저장일 뿐, 분류 도구가 아님. stash pop 할 때 충돌 가능
- **수동 git add** — 파일 하나씩 골라서 커밋. 파일이 많으면 실수하기 쉬움
- **결국 "일단 다 커밋"** — 히스토리가 뒤섞여서 나중에 추적이 어려움

## Git Groups는 다르게 접근합니다

변경 파일을 **그대로 두고**, 포스트잇처럼 **그룹으로 분류**만 합니다.

- 파일은 워킹트리에 그대로 — 충돌 없음
- 그룹별로 Stage → Commit — 깔끔한 커밋 히스토리
- 브랜치 전환 없이 여러 작업을 동시에 정리
- 드래그 & 드롭으로 간편하게 분류

```
Changes 10개 파일
  ↓ 그룹으로 분류
🏷 로그인 기능 (3개) → Commit "feat: add login"
🏷 버그 수정 (4개)   → Commit "fix: resolve timeout"
🏷 리팩토링 (3개)    → Commit "refactor: clean up utils"
```

## 설치

VS Code 확장 탭(`Ctrl+Shift+X`)에서 **"Git Groups"** 검색 후 설치

## 사용방법

### 1. 그룹 만들기

소스 컨트롤 탭(`Ctrl+Shift+G`)을 열면 **GIT GROUPS** 섹션이 보입니다.

- **Changes** 옆 `[+]` 버튼 클릭 → 그룹 이름 입력
- 또는 `Ctrl+Shift+P` → `Git Groups: Create Group`

### 2. 파일을 그룹에 넣기

- 파일 **우클릭** → `Add to Group...` → 그룹 선택
- 또는 파일을 그룹으로 **드래그 & 드롭**
- 여러 파일 선택 후 한번에 드래그도 가능

### 3. 그룹 단위로 커밋하기

**방법 A: 그룹째로 Stage → 커밋**
1. Changes의 그룹 옆 `[↑]` 버튼으로 Stage (그룹이 Staged Changes로 이동)
2. Staged Changes에서 그룹 옆 `[✓]` 버튼 클릭
3. 그룹명이 커밋 메시지 기본값으로 채워짐 → 수정 또는 그대로 Enter

**방법 B: 여러 그룹 한번에 커밋**
1. 여러 그룹을 Stage
2. Staged Changes 옆 `[✓]` 클릭
3. QuickPick에서 커밋할 그룹 선택 (체크박스)
4. 선택한 그룹별로 **각각 별도 커밋** 생성 (그룹명이 커밋 메시지)
5. 그룹에 속하지 않은 파일(Ungrouped)은 커밋 메시지 입력창이 뜸
6. 커밋 완료된 그룹은 **자동 삭제**

**방법 C: 개별 파일 관리**
- Changes 파일 옆 `[↑]` → Stage
- Staged 파일 옆 `[↓]` → Unstage
- Changes 파일 옆 `[✗]` → 작업 되돌리기 (discard)
- Changes 파일 옆 `[📦]` → 개별 파일 Stash (pop 시 원래 그룹으로 복원)

**전체 Stage/Unstage**
- Changes 옆 `[↑]` → 전체 Stage
- Staged Changes 옆 `[↓]` → 전체 Unstage

### 4. 그룹 관리

- **이름 변경**: 그룹 선택 후 `F2`, 또는 우클릭 → `Rename Group`
- **삭제**: 그룹 옆 `[🗑]` 버튼, 또는 우클릭 → `Delete Group`
- **파일 제거**: 그룹 내 파일 우클릭 → `Remove from Group`

### 5. AI 그룹명 생성 (GitHub Copilot 필요)

그룹 옆 `[✨]` 버튼을 클릭하면, diff를 분석해서 그룹명을 자동 생성합니다. Staged Changes, Changes 모두 사용 가능합니다.

예: `feat: add user authentication`, `fix: resolve login timeout`

> GitHub Copilot이 설치되어 있어야 동작합니다. 없으면 안내 메시지가 표시됩니다.

### 6. Stash

**그룹별 Stash:**
- Changes의 그룹 옆 `[📦]` 버튼 → 해당 그룹만 stash
- Pop하면 그룹명 + 파일 매핑 그대로 복원

**전체 Stash:**
- Changes 옆 `[📦]` 버튼 → 그룹별로 각각 별도 stash 생성
- Stashes 옆 `[Pop All]` 버튼으로 한번에 복원

**Stash 관리:**
- Stashes 섹션에서 목록 확인, 펼쳐서 파일 목록 보기
- 개별 `[Pop]` / `[🗑 Drop]` 가능

### 7. 마지막 커밋 되돌리기

상단 `[↩]` 버튼을 클릭하면 마지막 커밋을 취소합니다.

- 확인창에서 커밋 메시지를 보여줌
- `git reset --soft HEAD~1` 실행
- 커밋은 취소되고 변경사항은 **Staged Changes**로 돌아감

### 8. 기타

- **전체 접기/열기**: 상단 토글 버튼
- **새로고침**: 상단 `[↻]` 버튼 (파일 변경 시 자동 갱신됨)
- **diff 보기 + 경로 복사**: 파일 클릭 (diff 열기 + relative path 자동 복사)
- **경로 복사**: 우클릭 → Copy Relative Path / Copy Absolute Path

## 구조

```
GIT GROUPS                [↩][🧹][↻][접기/열기]
├── Staged Changes               [↓][✓]
│   ├── 🏷 로그인 기능  [✨][↓][🗑][✓]
│   │   ├── auth.ts          M    [↓]
│   │   └── login.vue        M    [↓]
│   └── config.yaml          A    [↓]
│
── ── ── ── ── ── ──
│
├── Changes                   [↑][📦][+]
│   ├── 🏷 버그 fix [✨][↑][✗][📦][🗑]
│   │   └── utils.ts         M    [↑][✗]
│   ├── readme.md            M    [↑][✗]
│   └── app.py               M    [↑][✗]
│
── ── ── ── ── ── ──
│
├── Stashes                   [Pop All]
│   ├── 📦 리팩토링      2 files  [Pop][🗑]
│   │   ├── utils.ts
│   │   └── helper.ts
│   └── 📦 WIP           1 files  [Pop][🗑]
│       └── temp.ts
```

## 기능 요약

| 기능 | 설명 |
|------|------|
| 그룹 생성/삭제/이름변경 | 파일을 논리적으로 분류 |
| 드래그 & 드롭 | 파일을 그룹 간 이동 |
| 그룹별 Stage/Unstage | 그룹 단위로 git add/reset |
| 전체 Stage/Unstage | 한번에 전체 올리기/내리기 |
| 그룹별 Commit | 그룹 단위로 커밋 (그룹명 = 커밋 메시지) |
| 여러 그룹 일괄 커밋 | QuickPick으로 선택 → 그룹별 별도 커밋 |
| 그룹별 Stash / Pop | 그룹 단위로 stash, pop 시 그룹 복원 |
| 전체 Stash All / Pop All | 그룹별 각각 별도 stash, 한번에 복원 |
| AI 그룹명 생성 | Copilot으로 diff 분석 후 자동 이름 생성 |
| 마지막 커밋 되돌리기 | git reset --soft HEAD~1 |
| 빈 그룹 정리 | 파일 0개인 그룹 한번에 삭제 |
| 파일별 Stage/Unstage/Discard | 개별 파일 관리 |
| Ungrouped 표시 옵션 | 미분류 파일을 그룹으로 묶을지 선택 |
| 그룹 데이터 저장 | `.vscode/git-groups.json`에 자동 저장 |
| 자동 새로고침 | 파일/설정 변경 시 자동 갱신 |

## 라이선스

MIT
