# Git Groups

VS Code 소스 컨트롤 탭에서 변경된 파일을 그룹으로 분류하고, 그룹 단위로 커밋할 수 있는 확장입니다.

## 기능

### 그룹 관리
- 커스텀 그룹 생성 / 삭제 / 이름변경 (F2)
- 파일을 그룹에 추가 / 제거
- 드래그 & 드롭으로 파일 이동
- 다중 선택 지원
- 그룹 데이터 자동 저장 (`.vscode/git-groups.json`)

### Staged Changes
- 그룹별 커밋하기
- 그룹을 Changes로 되돌리기 (unstage)
- 개별 파일 unstage

### Changes
- 그룹별 Stage 올리기
- 그룹별 작업 되돌리기 (discard)
- 개별 파일 stage / discard

### UI
- 소스 컨트롤 탭 내 Git Groups 섹션
- Staged Changes / Changes 구조 안에 그룹이 중첩
- 파일 클릭 시 diff 보기
- 전체 접기 / 열기 토글
- 파일 변경 시 자동 새로고침

## 구조

```
GIT GROUPS
├── Staged Changes
│   ├── 🏷 로그인 기능
│   │   ├── auth.ts          M
│   │   └── login.vue        M
│   └── 📂 Ungrouped
│       └── config.yaml      A
│
├── Changes
│   ├── 🏷 버그 fix
│   │   └── utils.ts         M
│   └── 📂 Ungrouped
│       ├── readme.md        M
│       └── ...
```

## 설치

```bash
# 개발 모드
code --extensionDevelopmentPath=/path/to/git-groups /path/to/your/project

# 또는 git-groups 폴더를 VS Code에서 열고 F5
```

## 라이선스

MIT
