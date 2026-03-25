# Git Groups

VS Code 소스 컨트롤 탭에서 변경된 파일을 그룹으로 분류하고, 그룹 단위로 커밋할 수 있는 확장입니다.

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

**방법 A: 그룹째로 커밋**
1. Changes의 그룹 옆 `[↑]` 버튼으로 Stage
2. Staged Changes에서 그룹 옆 `[✓]` 버튼 클릭
3. 커밋 메시지 입력 → 완료

**방법 B: 개별 파일 관리**
- Changes 파일 옆 `[↑]` → Stage
- Staged 파일 옆 `[↓]` → Unstage
- Changes 파일 옆 `[✗]` → 작업 되돌리기 (discard)

### 4. 그룹 관리

- **이름 변경**: 그룹 선택 후 `F2`, 또는 우클릭 → `Rename Group`
- **삭제**: 그룹 옆 `[🗑]` 버튼, 또는 우클릭 → `Delete Group`
- **파일 제거**: 그룹 내 파일 우클릭 → `Remove from Group`

### 5. 기타

- **전체 접기/열기**: 상단 토글 버튼
- **새로고침**: 상단 `[↻]` 버튼 (파일 변경 시 자동 갱신됨)
- **diff 보기**: 파일 클릭

## 구조

```
GIT GROUPS
├── Staged Changes                    [✓ 커밋]
│   ├── 🏷 로그인 기능    [✓][↓][🗑]
│   │   ├── auth.ts          M
│   │   └── login.vue        M
│   └── config.yaml          A       [↓]
│
── ── ── ── ── ── ──
│
├── Changes                           [+]
│   ├── 🏷 버그 fix       [↑][✗][🗑]
│   │   └── utils.ts         M
│   ├── readme.md            M       [↑][✗]
│   └── app.py               M       [↑][✗]
```

## 기능 요약

| 기능 | 설명 |
|------|------|
| 그룹 생성/삭제/이름변경 | 파일을 논리적으로 분류 |
| 드래그 & 드롭 | 파일을 그룹 간 이동 |
| 그룹별 Stage/Unstage | 그룹 단위로 git add/reset |
| 그룹별 Commit | 그룹 단위로 커밋 |
| 파일별 Stage/Unstage/Discard | 개별 파일 관리 |
| 그룹 데이터 저장 | `.vscode/git-groups.json`에 자동 저장 |
| 자동 새로고침 | 파일 변경 감지 시 자동 갱신 |

## 라이선스

MIT
