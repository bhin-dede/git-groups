# Changelog

## [0.7.0] - 2026-03-26

### Added
- 외부 stash(터미널 등) Stashes 섹션에 표시 — 회색 아이콘 + `(external)`, Pop/Drop 가능
- Stash index 검증 — pop/drop 전 실제 git stash list와 비교, 불일치 시 에러 방지
- `.vscode/git-groups.json` 자동 gitignore — 첫 그룹 저장 시 사용자 프로젝트 `.gitignore`에 자동 추가
- LICENSE (MIT) 파일 추가
- Stash 시 `.vscode/git-groups.json` 자동 제외

### Fixed
- stash pop 시 `git-groups.json already exists` 오류 수정

## [0.5.0] - 2026-03-26

### Added
- 그룹별 Stash 기능 — Changes 그룹 옆 `[📦]` 버튼으로 개별 stash
- 전체 Stash All — Changes 섹션 옆 `[📦]` 버튼, 그룹별로 각각 별도 stash 생성
- 전체 Pop All — Stashes 섹션 옆 `[Pop All]` 버튼으로 모든 stash 한번에 복원
- Stashes 섹션 — stash 목록 표시, 파일 목록 펼쳐서 확인 가능
- 개별 Pop / Drop 버튼
- Stash pop 시 그룹 자동 복원 (그룹명 + 파일 매핑 보존)
- 빈 그룹 정리 기능 (Clean Empty Groups)
- Ungrouped 표시 옵션 (`gitGroups.showUngroupedSection`) — 미분류 파일을 Ungrouped 그룹으로 묶을지 선택
- 확인창 "Don't ask again" 옵션 (그룹 삭제, stash drop)
- 설정 변경 시 자동 반영

### Fixed
- 파일명에 공백이 있을 때 따옴표 파싱 오류 수정
- Untracked 파일 discard 시 `git clean -f` 사용하도록 수정
- Stash 파일 목록이 꼬이는 문제 — groupManager에 정확한 파일 정보 저장

### Changed
- Discard 확인창은 항상 표시 (파일 삭제 위험이 있으므로 "Don't ask again" 없음)

## [0.4.0] - 2026-03-26

### Added
- AI 그룹명 자동 생성 (GitHub Copilot 연동, `[✨]` 버튼) — Staged/Changes 모두 지원
- 전체 Stage All / Unstage All 버튼
- Staged Changes 섹션에 그룹별 커밋 기능 (QuickPick으로 그룹 선택 → 각각 별도 커밋)
- 마지막 커밋 되돌리기 (Undo Last Commit) — `git reset --soft HEAD~1`
- 그룹별 Commit / Unstage (Staged Changes)
- 그룹별 Stage / Discard (Changes)
- 개별 파일 Stage / Unstage / Discard
- 그룹 인라인 삭제 버튼
- Staged Changes ↔ Changes 구분선

### Changed
- 커밋 시 그룹명을 커밋 메시지 기본값으로 표시
- 그룹 Stage 시 Changes에서 빈 그룹 자동 숨김
- Ungrouped 섹션 제거, 그룹 없는 파일은 아래에 직접 표시

## [0.1.0] - 2026-03-25

### Added
- 커스텀 그룹 생성 / 삭제 / 이름변경
- 파일을 그룹에 추가 / 제거
- 드래그 & 드롭으로 파일 이동
- 다중 선택 지원
- Staged Changes / Changes 중첩 구조
- 파일 클릭 시 diff 보기
- 전체 접기 / 열기 토글
- 파일 변경 시 자동 새로고침
- 그룹 데이터 `.vscode/git-groups.json`에 자동 저장
- VS Code 마켓플레이스 배포
