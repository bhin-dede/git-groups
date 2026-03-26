# Changelog

## [0.2.0] - 2026-03-26

### Added
- AI 그룹명 자동 생성 (GitHub Copilot 연동, `[✨]` 버튼)
- 전체 Stage All / Unstage All 버튼
- Staged Changes 섹션에 커밋 버튼
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
