# Git Groups - AI 개발 가이드

## 프로젝트 개요

VS Code 확장(Extension)으로, 소스 컨트롤 탭에서 변경된 파일을 커스텀 그룹으로 분류하고 그룹 단위로 커밋할 수 있게 해주는 도구.

- **마켓플레이스**: https://marketplace.visualstudio.com/items?itemName=joo00206.git-groups
- **리포지토리**: https://github.com/bhin-dede/git-groups
- **Publisher ID**: `joo00206`

## 기술 스택

- TypeScript
- VS Code Extension API (TreeView 기반, SCM API 아님)
- Git CLI (`child_process.execFile`로 실행)

## 파일 구조

```
src/
├── extension.ts      ← 진입점. 명령 등록, TreeView/Watcher 초기화
├── treeProvider.ts   ← TreeView UI. SectionItem/GroupItem/FileItem/SeparatorItem
├── gitService.ts     ← git 명령 실행 (status, add, reset, commit, checkout)
├── groupManager.ts   ← 그룹 CRUD + .vscode/git-groups.json 저장/로드
└── types.ts          ← 타입 정의 (FileGroup, GitFileStatus 등)
```

## 핵심 아키텍처

### TreeView 구조 (SCM 탭 내 "Git Groups" 뷰)
```
SectionItem("Staged Changes")
├── GroupItem(그룹명, section="staged")   ← contextValue: "stagedGroup"
│   └── FileItem(파일, staged=true)       ← contextValue: "stagedFile"
└── FileItem(그룹 없는 파일)               ← contextValue: "stagedFile"

SeparatorItem("──────────")

SectionItem("Changes")
├── GroupItem(그룹명, section="changes")  ← contextValue: "changesGroup"
│   └── FileItem(파일, staged=false)      ← contextValue: "groupedFile"
└── FileItem(그룹 없는 파일)               ← contextValue: "ungroupedFile"
```

### contextValue 규칙 (메뉴 표시 조건에 사용)
- `stagedSection` / `changesSection` — 섹션 헤더
- `stagedGroup` / `changesGroup` — 그룹 (staged/changes 구분)
- `stagedFile` — staged 파일
- `groupedFile` — changes에서 그룹에 속한 파일
- `ungroupedFile` — changes에서 그룹에 안 속한 파일
- `separator` — 구분선

### 명령어 prefix
모든 명령어는 `gitGroupCommit.` prefix 사용. 뷰 ID는 `gitGroups`.

### git status 파싱
`git status --porcelain -uall` 출력의 XY 포맷:
- X(첫번째 문자) = staged 상태
- Y(두번째 문자) = unstaged 상태
- 하나의 파일이 staged + unstaged 두 개의 FileItem으로 나뉠 수 있음

### 그룹 저장
- `.vscode/git-groups.json`에 저장
- `GroupManager`가 CRUD + 이벤트 발행
- `onDidChange` 이벤트로 TreeView 자동 갱신

### 파일 변경 감지
- `FileSystemWatcher`로 모든 파일 변경 감지
- 1초 디바운스 후 `treeProvider.updateChangedFiles()` 호출
- 커밋/삭제된 파일은 그룹에서 자동 제거 (`pruneStaleFiles`)

## 빌드 & 배포

```bash
npm run compile          # TypeScript 컴파일
npm run watch            # 변경 감지 컴파일

vsce package --allow-star-activation    # .vsix 패키징
vsce publish --allow-star-activation    # 마켓플레이스 배포
```

## 개발 모드 실행

```bash
# 방법 1: VS Code에서 git-groups 폴더 열고 F5
# 방법 2: 터미널
code --extensionDevelopmentPath=/path/to/git-groups /path/to/git-project
```

## 알려진 제약사항

- **TreeView API 한계**: 인라인 텍스트 편집 불가 (F2 → InputBox 팝업 사용)
- **TreeView API 한계**: 섹션 안에 인풋 필드 삽입 불가
- **TreeView API 한계**: 빈 공간 우클릭 메뉴 불가
- **SCM Provider 방식 시도했으나 실패**: VS Code가 내장 Git 옆에 커스텀 SCM Provider를 표시하지 않아 TreeView 방식으로 확정
- **activationEvents**: `"*"` 사용 중 (성능 영향 가능). 이상적으로는 `"onView:gitGroups"`이지만 활성화 문제가 있어 `"*"`로 설정

## 향후 개선 가능

- activationEvents를 `"*"` 대신 적절한 이벤트로 변경
- 아이콘 파일 크기 최적화 (현재 1.4MB)
- LICENSE 파일 추가
- 다중 워크스페이스 지원
- Webview로 전환하면 인라인 편집 등 고급 UI 가능
