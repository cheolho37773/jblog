# jblog UI 디자인 기획서 (Portfolio + Blog)

> 버전 v0.6.2 · 작성일 2026-11-20 · 개정 2026-11-27: §7.2 목록 로딩 스켈레톤은 필터 전환 중에만(M2-07 G2, 개발자 결정) · 개정 2026-11-24: §3.3·§7.3 코드 블록 배경 토큰 `code-bg`, 인라인 코드·링크 글자 `primary-text`(M2-02) · 개정 2026-11-24: §11-6 시각 회귀 운용(실행 환경·허용 오차, M1 결과 보정) · 개정 2026-11-22: §3.3·§5.1·§5.9 Footer 카드 토큰(`footer-card`)·Contact Me 카드 확정·하단 정책 링크 제외·글자 로고(M1-10, 개발자 결정) · 개정 2026-11-22: §3.3·§9·§11 강조색 글자 대비 토큰과 추가 토큰(M1-08, 개발자 결정) · 개정 2026-11-22: §11 M1 한시 대체 비교(개발자 결정) · 개정 2026-11-20 ([기획 검토 피드백](../plan/feedback/2026-11-20_plan_review.md) 반영: 메타 텍스트 대비, Hero CTA, 프로젝트 카드 정보 보강, Featured 조건부, 프로젝트 목록 열 수, 태그 필터, 연락처 복사 예외, 검수 기준 분리)
> 목적: 개인 포트폴리오 겸 기술 블로그 웹서비스의 UI 기준 문서. 프론트엔드 구현과 디자인 QA의 단일 기준(Single Source of Truth)으로 사용한다.

---

## 0. 참고 디자인 소스

| 구분 | Figma 파일 | fileKey | 주요 노드 |
|---|---|---|---|
| 블로그 (MetaBlog) | [Free Blog Template – Modern & Creative](https://www.figma.com/design/GXKVmfDrGbtIySaHmc8X7z/?node-id=1-2) | `GXKVmfDrGbtIySaHmc8X7z` | Home Light `2101:19307` / Dark `2143:5510`<br>Blog Listing Light `2101:21306` / Dark `2143:5414`<br>Single Post Light `2101:21570` / Dark `2143:5373`<br>Author Page Light `2101:21786` / Dark `2143:5278` |
| 포트폴리오 | [Developer Portfolio Website Design](https://www.figma.com/design/CoblNVbMcS3zrts9kMls7W/?node-id=0-1) | `CoblNVbMcS3zrts9kMls7W` | Web Design `14:4` (다크 단일 테마, 1440px) |

참고 스크린샷 (Figma MCP로 추출, `./references/`):

> 이 스크린샷들은 **로컬 전용**이다. 공개 저장소에 올리지 않으므로 `.gitignore`로 제외되어 있다. 저장소를 새로 받은 환경에서는 아래 이미지가 보이지 않으며, 필요하면 §0 표의 Figma 노드에서 `get_screenshot`으로 다시 추출해 같은 경로에 저장한다.

| 블로그 Home (Light) | 블로그 Home (Dark) | 포트폴리오 Home |
|---|---|---|
| ![](./references/blog-home-light.png) | ![](./references/blog-home-dark.png) | ![](./references/portfolio-home.png) |

| Blog Listing | Single Post | Author Page |
|---|---|---|
| ![](./references/blog-listing-light.png) | ![](./references/blog-single-post-light.png) | ![](./references/blog-author-light.png) |

### 데이터 신뢰도 표기

이 문서의 수치는 Figma MCP(`get_variable_defs`, `get_design_context`, `get_metadata`)로 읽은 실제 값이다. 예외는 아래 표기로 구분한다.

- **(확정)**: Figma 변수 또는 노드 스타일에서 직접 추출한 값 (표기 생략 시 기본값)
- **(추정)**: 스크린샷이나 레이어 좌표로 역산한 값. 구현 전에 Figma Dev Mode에서 확인해야 한다 (→ [§10 미확정 항목](#10-미확정-항목--후속-확인-필요))

> Figma MCP Starter 플랜 호출 한도에 걸려 포트폴리오 노드의 상세 스타일(폰트/그라디언트 값)과 블로그 다크 navbar를 추출하지 못했다. 이 항목들은 (추정)으로 표기했다.

---

## 1. 디자인 조합 전략

두 템플릿의 성격이 다르므로 **블로그 템플릿을 디자인 시스템의 뼈대**로 삼고, **포트폴리오 템플릿은 콘텐츠 섹션(모듈)** 으로 이식한다.

| 항목 | 채택 소스 | 이유 |
|---|---|---|
| 디자인 토큰 (색상 스케일, 타이포, 그림자, radius) | 블로그 | 변수 체계가 갖춰져 있고 Light/Dark 두 테마가 모두 정의되어 있음 |
| 레이아웃 그리드 (컨테이너 1216px, 3열 카드) | 블로그 | 블로그 목록과 상세 페이지에 최적화되어 있음 |
| Navbar / Footer / 테마 토글 / 검색 | 블로그 | 다크모드 스위치가 내장되어 있음 |
| Hero(아바타, 대형 헤드라인, CTA), 기술 스택 로고, 프로젝트 카드, 경력 타임라인, Contact | 포트폴리오 | 개인 브랜딩 영역 |
| 포인트 그라디언트 (헤드라인 강조, 섹션 타이틀) | 포트폴리오 | 개성 있는 액센트. 블로그 Primary(#4B6BFB)와 함께 사용 |

**조정 원칙**
1. 포트폴리오의 고유 배경색(`#161513`, 카드 `#2A2A2A`)은 쓰지 않는다. 블로그 Secondary 스케일로 대체해 전 페이지의 톤을 통일한다 (§3.3 매핑표).
2. 포트폴리오는 다크 전용이므로 Light 버전을 블로그 Light 토큰으로 새로 정의한다.
3. 블로그 템플릿의 광고 영역(`o-ads-space`)은 개인 사이트에 맞지 않아 제거한다. 그 자리는 섹션 간격으로만 유지한다.
4. 포트폴리오 섹션의 콘텐츠 폭(810px)은 블로그 컨테이너(1216px) 안에서 중앙 정렬해 그대로 유지한다. 원본의 좁은 폭과 집중감을 보존하기 위해서다.

---

## 2. 정보 구조 (IA) & 라우트

```
/                     Home        — 포트폴리오 Hero + 기술스택 + Featured Projects + Latest Posts
/blog                 Blog 목록   — Page Info + Featured(overlay) + 카드 그리드 + Load More
/blog?category=xxx    카테고리 필터
/blog/[slug]          글 상세     — Article(800px) + 이전/다음 글 + 관련 글
/projects             프로젝트    — 프로젝트 카드 3열 그리드 (Home의 Featured Projects는 2열)
/projects/[slug]      프로젝트 상세 (Single Post 레이아웃 재사용)
/about                About       — Author Info 박스 + Experience 타임라인 + 기술스택 + Contact
/search?q=            검색 결과   — Blog 목록 그리드 재사용
```

**Navbar 메뉴**: `Home` · `Blog` · `Projects` · `About` · `Contact`(About 페이지의 #contact 앵커)
(원본 메뉴 Home/Blog/Single Post/Pages/Contact를 개인 사이트에 맞게 변경)

---

## 3. 디자인 토큰

### 3.1 색상 – 블로그 원본 변수 (확정)

| Token | Hex | 비고 |
|---|---|---|
| `Theme 1/Primary` | `#4B6BFB` | 버튼, 활성 배지, 링크 |
| `White` | `#FFFFFF` | |
| `Secondary/50` | `#F6F6F7` | Light 서브 배경 (Quote, Author 박스, Footer) |
| `Secondary/100` | `#E8E8EA` | Light 보더, 토글 트랙, Ads 배경 |
| `Secondary/200` | `#DCDDDF` | |
| `Secondary/300` | `#BABABF` | Dark 푸터 링크 텍스트 |
| `Secondary/400` | `#97989F` | 원본의 메타 텍스트 (작성자, 날짜) – 이 프로젝트에서는 Dark 메타 텍스트에만 사용 (Light는 §3.3, §9) |
| `Secondary/500` | `#696A75` | 서브 텍스트, 소셜 버튼 배경 |
| `Secondary/600` | `#3B3C4A` | Light 본문/메뉴 텍스트, Dark 인풋 보더 |
| `Secondary/700` | `#242535` | Dark 보더, Dark 서브 배경 (뉴스레터 박스) |
| `Secondary/800` | `#181A2A` | Light 제목 텍스트, Dark 페이지/카드 배경 |
| `Secondary/900` | `#141624` | Dark 푸터 배경 |
| 검색 인풋 bg | `#F4F4F5` | Light (Tailwind zinc-100 계열) |
| 검색 placeholder | `#A1A1AA` | Light 원본. 이 프로젝트에서는 대비 기준 때문에 `--color-input-placeholder`(`#696A75`)로 대체 (§9) |
| 이미지 오버레이 | `rgba(20,22,36,0.4)` | Hero/Overlay 카드 이미지 딤 처리 |
| Badge (soft) bg | `rgba(75,107,251,0.05)` | 카드 내 카테고리 배지 |

### 3.2 색상 – 포트폴리오 원본 변수 (확정)

| Token | Hex | 이 프로젝트에서의 처리 |
|---|---|---|
| `Background Color` | `#161513` | 사용 안 함 → `--color-bg` |
| `Card Color` | `#2A2A2A` | 사용 안 함 → `--color-surface-2` |
| `Primary Color` | `#FFFFFF` | Dark 텍스트 `--color-text-strong` |
| `Secondary Text` | `#C5C5C5` | 사용 안 함 → `--color-text-body` |
| `Light Grey` | `#8491A0` | 사용 안 함 → `--color-text-muted` |
| `Orange Gradient` | (값 미추출) | `--gradient-orange` (추정값 §3.4) |
| `Blue Gradient` | (값 미추출) | `--gradient-blue` (추정값 §3.4) |
| `Primary Gradient` | (값 미추출) | `--gradient-primary` (추정값 §3.4) |

### 3.3 시맨틱 토큰 (Light / Dark) — 구현 기준

CSS 변수로 정의하고, `<html data-theme="light|dark">`로 전환한다.

| Semantic Token | Light | Dark | 출처 |
|---|---|---|---|
| `--color-bg` | `#FFFFFF` | `#181A2A` | 블로그 Home L/D |
| `--color-bg-subtle` | `#F6F6F7` | `#242535` | Author 박스, Quote, Footer 영역 |
| `--color-surface` (카드) | `#FFFFFF` | `#181A2A` | `m-post-card-grid` L/D (확정) |
| `--color-surface-2` (프로젝트 카드 하단바, 뉴스레터) | `#F6F6F7` | `#242535` | 블로그 Footer 뉴스레터(Dark 확정) / Light (추정) |
| `--color-border` | `#E8E8EA` | `#242535` | 카드 보더 L/D (확정) |
| `--color-border-strong` | `#DCDDDF` | `#3B3C4A` | 인풋 보더 (Dark 확정) |
| `--color-text-strong` (제목) | `#181A2A` | `#FFFFFF` | (확정) |
| `--color-text-body` (본문) | `#3B3C4A` | `#BABABF` | Light 확정 / Dark (추정) |
| `--color-text-muted` (메타) | **`#696A75`** | `#97989F` | Dark 확정 / **Light는 접근성(AA) 기준으로 원본 `#97989F`에서 변경** (§9) |
| `--color-text-subtle` | `#696A75` | `#97989F` | Author 서브타이틀 |
| `--color-nav-text` | `#3B3C4A` | `#FFFFFF` | Light 확정 / Dark (추정, 스크린샷 기준) |
| `--color-primary` | `#4B6BFB` | `#4B6BFB` | (확정) |
| `--color-primary-soft` | `rgba(75,107,251,0.05)` | `rgba(75,107,251,0.05)` | (확정) |
| `--color-input-bg` | `#F4F4F5` | `#242535` | Light 확정 / Dark (추정) |
| `--color-input-placeholder` | **`#696A75`** | `#97989F` | 원본 Light `#A1A1AA`(≈2.3:1)는 대비 미달이라 변경 (§9) |
| `--color-footer-bg` | `#F6F6F7` | `#141624` | Light (추정, 스크린샷) / Dark 확정 |
| `--color-footer-link` | `#3B3C4A` | `#BABABF` | Light (추정) / Dark 확정 |
| `--color-toggle-track` | `#E8E8EA` | `#4B6BFB` | Light 확정 / Dark (추정, 스크린샷) |
| `--color-overlay` | `rgba(20,22,36,0.4)` | `rgba(20,22,36,0.4)` | (확정) |
| `--color-primary-strong` | `#4361EE` | `#4361EE` | **추가 (M1-08, §9)**: 채운 배경(Button primary, Badge solid, Avatar 이니셜) — 흰 글자 5.0:1 |
| `--color-primary-text` | `#4361EE` | `#7B93FF` | **추가 (M1-08, §9)**: 강조색 글자(링크, soft 배지 글자) |
| `--color-on-primary` | `#FFFFFF` | `#FFFFFF` | 추가 (M1-08): `primary-strong` 위 글자·아이콘 |
| `--color-danger` | `#C81E1E` | `#F87171` | 추가 (M1-08): 입력 오류 글자·테두리 |
| `--color-icon-button-bg` | `#696A75` | `#696A75` | 추가 (M1-08): Button `icon` 배경(§5.8 원본 값을 토큰화, 흰 아이콘 5.4:1) |
| `--color-toggle-knob` · `--color-toggle-knob-icon` | `#FFFFFF` · `#181A2A` | 같음 | 추가 (M1-08): 테마 토글 노브와 해·달 아이콘 |
| `--color-footer-card` | `#FFFFFF` | `#242535` | **추가 (M1-10)**: Footer 오른쪽 카드 배경. Light는 `surface-2`가 `footer-bg`와 같아 카드가 보이지 않아 분리(참고 스크린샷 흰 상자) / Dark는 `surface-2` 확정값과 같음 |
| `--color-code-bg` | `#F6F6F7` | `#141624` | **추가 (M2-02)**: 코드 블록 배경(§7.3). Light는 `bg-subtle`과 같은 값이지만 용도가 달라 분리 |

### 3.4 그라디언트 (포트폴리오 액센트) — (추정)

포트폴리오 변수에 이름(`Orange/Blue/Primary Gradient`)만 있고 값은 추출되지 않았다. 스크린샷 기준 추정값을 쓰고, 구현 전 Figma에서 실제 stop 값을 확인한다.

| Token | 사용처 | 추정값 |
|---|---|---|
| `--gradient-primary` | Hero 헤드라인 강조어("about it!"), 아바타 배경 | `linear-gradient(90deg, #FF8660 0%, #D53AFF 100%)` |
| `--gradient-orange` | "PROJECTS" 섹션 타이틀 | `linear-gradient(90deg, #FF8660 0%, #F23D4C 100%)` |
| `--gradient-blue` | "EXPERIENCE" 섹션 타이틀 | `linear-gradient(90deg, #4B6BFB 0%, #3DB8FF 100%)` |

적용 방식: `background: var(--gradient-*); -webkit-background-clip: text; color: transparent;`
그라디언트는 양 테마에서 동일하게 쓴다. Light 배경에서의 대비는 §9에서 검증한다.

### 3.5 타이포그래피 (확정 — 블로그 변수)

| Token | Family | Weight | Size / Line-height | 사용처 |
|---|---|---|---|---|
| `Heading/h1/Semibold` | Work Sans | 600 | 36 / 40 | Hero 카드 제목, 글 상세 제목, Overlay 카드 제목 |
| `Heading/h3/Bold` | Work Sans | 700 | 24 / 28 | 섹션 타이틀 ("Latest Post") |
| `Heading/h3/Semibold` | Work Sans | 600 | 24 / 28 | 카드 제목, 본문 H2 |
| `Heading/h4/Semibold` | Work Sans | 600 | 20 / 24 | 뉴스레터 제목 |
| `Body/b2/Medium` | Work Sans | 500 | 20 / 28 | Author 이름 |
| `Body/b3/Regular` | Work Sans | 400 | 18 / 26 | Author 소개문 |
| `Body/b4/Regular` | Work Sans | 400 | 16 / 24 | 메뉴, 날짜, 일반 텍스트 |
| `Body/b4/Medium` | Work Sans | 500 | 16 / 24 | 작성자명, 버튼 |
| `Body/b5/Regular` | Work Sans | 400 | 14 / 20 | 소형 메타 |
| `Body/b5/Medium` | Work Sans | 500 | 14 / 20 | 배지 |
| `Article/lg/Regular` | Source Serif Pro | 400 | 20 / 32 | 글 본문 |
| `Article/quote/Regular` | Source Serif Pro | 400 Italic | 24 / 32 | 인용문 |
| `text-xl/Bold` | Plus Jakarta Sans | 700 | 20 / 28 | 푸터 로고 텍스트 |
| `text-lg/Semi Bold` | Plus Jakarta Sans | 600 | 18 / 28 | 푸터 컬럼 제목 |
| `text-base/Regular` | Plus Jakarta Sans | 400 | 16 / 24 | 푸터 본문/링크 |
| `text-base/Semi Bold` | Plus Jakarta Sans | 600 | 16 / 24 | 푸터 라벨(Email:, Phone:) |

**포트폴리오 섹션용 Display 타이포 — (추정)**: 원본 폰트는 Poppins 계열로 보인다 (스크린샷 기준).

| Token | Family | Weight | Size / LH | 사용처 | 근거 |
|---|---|---|---|---|---|
| `Display/hero` | Poppins | 700 | 56 / 64 | Hero 헤드라인 2줄 | Title 레이어 670×127 |
| `Display/section` | Poppins | 700 | 32 / 36 | PROJECTS / EXPERIENCE 타이틀 | 레이어 높이 36 |
| `Label/eyebrow` | Poppins | 500 | 20 / 30, letter-spacing 0.2em | "EXPERIENCE WITH" | 레이어 208×30 |
| `Body/intro` | Poppins | 400 | 18 / 27 | Hero 소개문 4줄 | About Me 679×108 |
| `Title/exp` | Poppins | 600 | 20 / 28 | 경력 항목 제목 | |
| `Body/exp` | Poppins | 400 | 14 / 22 | 경력 설명 | |

> **폰트 결정**: Work Sans(UI), Source Serif Pro(본문), Plus Jakarta Sans(푸터/로고), Poppins(포트폴리오 Display) 4종을 쓴다. 본문 serif 스택에는 한글 본문 폰트 Noto Serif KR 변수(`--font-noto-serif-kr`)가 들어간다. 이 변수는 글 상세에서만 정의되고, 다른 페이지에서는 기존 serif로 떨어진다(M2-05, 2026-11-26 개발자 수용). 검색 placeholder의 Inter는 Work Sans 14/20으로 대체한다 (육안 차이 미미, 폰트 1종 절감).
> 한글: 각 영문 폰트 뒤에 `Pretendard`를 fallback으로 지정한다. 본문 세리프의 한글은 `Noto Serif KR`(400·700)이며, 글/프로젝트 상세 페이지에서만 로드한다. 한글은 이탤릭이 없으므로 인용문의 한글은 기울이지 않는다 (로딩 방식: [프론트엔드 §5.1-a](../plan/02_frontend_plan.md#51-a-한글-본문-폰트)).

### 3.6 Radius / Shadow / Spacing (확정)

| Token | 값 | 사용처 |
|---|---|---|
| `--radius-sm` | 5px | 검색 인풋 |
| `--radius-md` | 6px | 배지, 버튼, 카드 썸네일, 인풋 |
| `--radius-lg` | 12px | 카드, Hero 이미지, Quote, Author 박스, 아티클 이미지 |
| `--radius-full` | 100px | 테마 토글, 아바타(28~80px), 포트폴리오 CTA 버튼 (추정) |
| `--shadow-md` | `0 12px 24px -6px rgba(24,26,42,0.12)` | Hero 플로팅 카드 |
| `--shadow-toggle` | `0 1px 1px rgba(0,0,0,0.12)` | 토글 노브 |

Spacing 스케일 (블로그에서 실제 쓰인 값): `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80`

---

## 4. 레이아웃 & 그리드

### 4.1 Desktop 기준 (블로그 원본 1920px 프레임)

| 항목 | 값 |
|---|---|
| 컨테이너 최대 폭 | **1216px** (좌우 352px 여백 @1920) |
| Navbar | 높이 100px, `padding: 32px 0`, 내부 폭 1218px |
| Navbar → 콘텐츠 간격 | 24px |
| 섹션 간 간격 | 80px (Hero 하단 → 다음 섹션) |
| 섹션 타이틀 → 그리드 | 32px |
| 카드 그리드 | 3열, 카드 392px, gap 20px (가로·세로) |
| 아티클 폭 | 800px 중앙 정렬, 블록 간 32px |
| 포트폴리오 섹션 폭 | 810px 중앙 정렬 (원본 1440 프레임 기준 좌우 315px) |
| Footer | `padding: 64px 352px 0`, 상단 콘텐츠 ↔ 카피라이트 64px |

### 4.2 반응형 브레이크포인트

| 이름 | 범위 | 컨테이너 | 카드 그리드 (블로그, `/projects`) | Home Featured Projects (810 섹션) | 비고 |
|---|---|---|---|---|---|
| `desktop` | ≥ 1280px | 1216px | 3열 / gap 20 | 2열 / gap 30 | 원본 그대로 |
| `laptop` | 1024–1279px | 100% − 64px (좌우 32) | 3열 / gap 20 | 2열 / gap 24 | 카드 폭 유동 |
| `tablet` | 768–1023px | 100% − 48px (좌우 24) | 2열 / gap 20 | 2열 / gap 20 | Navbar 메뉴 → 햄버거 |
| `mobile` | < 768px | 100% − 32px (좌우 16) | 1열 / gap 16 | 1열 / gap 16 | 아래 모바일 규칙 적용 |

**모바일 규칙**
- Navbar: 로고 + (검색 아이콘, 테마 토글, 햄버거). 검색 인풋은 아이콘으로 접고, 탭하면 전체폭 오버레이로 연다. 메뉴는 우측 드로어 또는 전체화면 시트.
- 타이포 축소: h1 36/40 → **28/34**, h3 24/28 → **20/26**, Display/hero 56/64 → **36/44**, Display/section 32 → **24**, Article 본문 20/32 → **18/30**.
- Hero(블로그형 플로팅 카드): 이미지 높이 600 → 240. 카드는 이미지 아래로 `-48px` 겹치고, 폭 `calc(100% − 32px)`, padding 40 → 24.
- Overlay 카드(Blog 목록 Featured): 높이 450 → 320, padding 40 → 20.
- 카드 썸네일: 고정 240px 대신 `aspect-ratio: 3 / 2` (360×240 비율 유지).
- 아티클 이미지 462px → `aspect-ratio: 800 / 462`.
- Footer: 4컬럼 → 1열 스택 (About → Quick Link·Category 2열 → Newsletter 전체폭). 카피라이트 영역은 세로 스택, 가운데 정렬.
- 터치 타겟은 최소 44×44px. 테마 토글(48×28)은 히트 영역을 padding으로 확장한다.

---

## 5. 공통 컴포넌트 명세

### 5.1 Navbar (`o-navbar`) — 블로그 `2147:4183`

```
[Logo 158×36] ──118px── [Menu: gap 40, w 667, 가운데 정렬] ──21px── [Search 166×36] ──40px── [Toggle 48×28]
```

| 요소 | 스펙 |
|---|---|
| 컨테이너 | `padding: 32px 0`, 내부 flex, align center |
| Logo | **글자 로고**("jblog", 높이 36, 토큰 색·폰트로 테마에 따라 자동 전환 — M1-10 개발자 결정). SVG 로고를 받으면 교체 |
| 메뉴 아이템 | Work Sans 400 16/24, `--color-nav-text`. Active: `--color-primary` + 500 weight (원본에 없음, 추가) |
| Hover | `--color-primary`, transition 150ms |
| Search | bg `--color-input-bg`, radius 5, `padding: 8px 8px 8px 16px`, gap 12, 아이콘 16px. placeholder `--color-input-placeholder`. `aria-label="검색"`. Enter 시 `/search?q=` |
| Theme Toggle | 트랙 48×28 radius 100. 노브 24×24 white, margin 2, shadow-toggle, 내부 아이콘 14px (Light: sunny ☀ / Dark: moon ☾). Dark일 때 노브가 오른쪽으로 이동 (translateX 20px, 200ms ease) |
| Sticky | 스크롤 시 상단 고정, 배경 `--color-bg` + 하단 1px `--color-border` (원본에 없음, UX상 추가) |

### 5.2 Badge (`a-badge`)

| Variant | 배경 | 텍스트 | Padding | 사용처 |
|---|---|---|---|---|
| `solid` | `#4B6BFB` | `#FFFFFF` | 4px 10px (lg: 6px 12px) | Hero 카드, Overlay 카드, 글 상세 |
| `soft` | `rgba(75,107,251,0.05)` | `#4B6BFB` | 4px 10px | 카드 그리드 |

공통: Work Sans 500 14/20, radius 6.

### 5.3 Author Meta (`a-author` + Date)

- 아바타 36px 원형 (상세 페이지: 28px), 아바타 ↔ 이름 gap 12 (상세: 8)
- 이름 Work Sans 500 16/24, 날짜 Work Sans 400 16/24, 둘 다 `--color-text-muted` (상세: 14/20, `#696A75`)
- 이름 ↔ 날짜 gap 20 (상세: 24)
- 개인 블로그는 작성자가 1명이므로 카드에서는 **날짜 + 읽는 시간(“5 min read”)** 으로 대체할 수 있다. 원본 레이아웃(아바타 자리)은 유지한다.

### 5.4 Post Card Grid (`m-post-card-grid`) — `2141:2688` / Dark `2143:5531`

| 속성 | 값 |
|---|---|
| 크기 | 392×488 (desktop) |
| 컨테이너 | bg `--color-surface`, border 1px `--color-border`, radius 12, padding 16, gap 16 |
| 썸네일 | 360×240, radius 6, object-fit cover |
| Content | padding 8, gap 20 |
| Heading | gap 16: Badge(soft) → 제목 h3/Semibold 24/28 `--color-text-strong`, 최대 3줄 clamp |
| Hover (추가) | 카드 `translateY(-4px)` + `--shadow-md`, 썸네일 `scale(1.03)` (overflow hidden) |

### 5.5 Featured Hero Card (Home) — `2101:19788` / Dark `2143:5515`

- 이미지 1216×600, radius 12, Light는 오버레이 `rgba(20,22,36,0.4)` 적용 (Dark 원본은 오버레이 없음 → 양 테마 모두 적용해 통일)
- 플로팅 카드: `left: 64px; top: 360px` (이미지 하단에서 64px 돌출), 폭 598, padding 40, gap 24, radius 12, border 1px `--color-border`, bg `--color-surface`, shadow-md
- 내용: Badge(solid) → h1 36/40 제목 → Author Meta
- 이 블록 총 높이 664px, 다음 섹션까지 80px

### 5.6 Overlay Post Card (Blog 목록 Featured) — `2147:4133`

- 1216×450, radius 12, overflow hidden, padding 40, 콘텐츠는 하단 정렬 (`justify-content: flex-end`)
- 배경 이미지 + 오버레이 `rgba(20,22,36,0.4)`
- Badge(solid) → 제목 h1 36/40 white (max-width 720) → Author Meta (white). 이름 ↔ 날짜 gap 20

### 5.7 Page Info (`o-page-info`) — Blog 목록 상단

- 높이 100, 가운데 정렬. 제목(“Page Title”, h3/Bold 계열) + Breadcrumb (`Home` · `Link One`)
- Breadcrumb: Work Sans 16/24, 현재 위치 `--color-text-muted`, 구분자 세로선 (추정)

### 5.8 Button (`a-button`)

| Variant | 스펙 | 사용처 |
|---|---|---|
| `primary` | bg `#4B6BFB`, text white, Work Sans 500 16/24, padding 12px 20px, radius 6 | Subscribe, 폼 제출 |
| `outline` | border 1px `--color-border-strong`, text `--color-text-body`, padding 12px 20px, radius 6 | View All Post, Load More (원본 142×48) |
| `icon` | bg `#696A75`, padding 8, radius 6, 아이콘 16 white | 소셜 링크 (Author 박스) |
| `pill-solid` (포트폴리오) | bg `--color-text-strong`, text `--color-bg`, radius full, h≈52, padding 0 24 (추정) | “Get In Touch” |
| `pill-outline` (포트폴리오) | border 2px `--color-text-strong`, text `--color-text-strong`, radius full (추정) | “Download CV” |

### 5.9 Footer (`o-footer`) — Dark `2147:3818`

```
[Info 289px] ─20─ [Links 495px: Quick Link ─80─ Category] ─20─ [Newsletter 392px]
──────────────── border-top 1px ────────────────
[Logo + jblog / © 2026 ...]   (정책 링크 없음 — M1-10)
```

- 컨테이너: bg `--color-footer-bg`, border-top 1px `--color-border`, padding-top 64, 상하 블록 gap 64
- 컬럼 제목: Plus Jakarta Sans 600 18/28 `--color-text-strong`. 컬럼 제목 ↔ 리스트 gap 24, 리스트 아이템 gap 8
- 링크 Plus Jakarta 400 16/24 `--color-footer-link`
- Info: About 소개 (w 280, `--color-text-muted`) + Email / GitHub (원본의 Phone은 GitHub 링크로 교체). 이메일·GitHub 텍스트는 복사 방지 예외(선택 가능)
- **동적 값**(Email·GitHub·Category, M1-10 개발자 결정): 컴포넌트가 값을 넘겨받고 **값이 없으면 그 항목·칸을 숨긴다**. API 연결은 M2~M3. `/dev/components`에서만 예시 값으로 표시
- Quick Link: Home, Blog, Projects, About, Contact, RSS
- Category: 블로그 카테고리 상위 6개 (동적)
- **Newsletter 박스**: bg `--color-footer-card`(M1-10), padding 32, radius 12, gap 30. 제목 h4 20/24, 설명 16/24 muted, 인풋 320px (padding 12 16, radius 6, border `--color-border-strong`, bg `--color-bg`, mail 아이콘 20) + Subscribe 버튼(primary, full width), 인풋 ↔ 버튼 gap 8.
  → 뉴스레터는 MVP 제외(개요 범위)이므로 같은 박스를 **“Contact Me” 카드**(이메일 + 소셜 아이콘)로 **대체한다(확정, M1-10)**. 박스 크기·여백·배경은 위와 같다
- 카피라이트: padding 32 0, 로고 + 저작권 문구(gap 2). 원본 우측의 Terms·Privacy·Cookie 링크는 **넣지 않는다**(정책 페이지가 IA에 없음, M1-10 개발자 결정)

---

## 6. 포트폴리오 섹션 컴포넌트 (포트폴리오 템플릿 이식)

원본 1440 프레임 좌표 기준. 섹션 폭 810px, 가운데 정렬.

### 6.1 Profile Hero (`s-profile-hero`) — avatar `19:97`, Title `19:109`, About `19:110`, Actions `19:99`

| 요소 | 원본 위치/크기 | 스펙 |
|---|---|---|
| 아바타 | 251×223 @ y180 | 원형 아바타(≈200px) + 배경 원에 `--gradient-primary`. 이미지는 사용자 본인 사진/일러스트로 교체 |
| 헤드라인 | 670×127 @ y444 (아바타 아래 ~41px) | Display/hero 56/64, 2줄 가운데 정렬. 강조 단어에 `--gradient-primary` text-clip. 색 `--color-text-strong` |
| 소개문 | 679×108 @ y610 (헤드라인 아래 ~39px) | Body/intro 18/27, `--color-text-body`, 4줄 가운데 정렬 |
| CTA 버튼 | 417×64 @ y772 (소개문 아래 ~54px) | 버튼 모양·크기·배치는 원본 그대로, **문구와 목적지만 변경**: `pill-solid` **"프로젝트 보기"**(→ Home `#projects`) + `pill-outline` **"기술 글 읽기"**(→ `/blog`), gap ≈16. 방문자가 첫 화면에서 두 핵심 콘텐츠로 바로 이동하게 한다 (§7.1 근거) |
| 보조 링크 (추가) | CTA 아래 16px | 텍스트 링크 2개를 가운데 정렬로 둔다: "이력서 다운로드"(PDF) · "연락하기"(→ `/about#contact`). Body/b4 16/24, `--color-text-muted`, hover `--color-primary`, 사이에 `·` 구분자. 원본의 Get In Touch / Download CV 역할을 이어받는다 |
| 상단 여백 | Navbar(82) 아래 ~98px | Home 첫 섹션 padding-top 96px |

### 6.2 Tech Stack (`s-tech-stack`) — `19:105`, Logos `19:100`

- Eyebrow “EXPERIENCE WITH” (Label/eyebrow, uppercase, letter-spacing 넓게, `--color-text-body`), CTA 아래 ~88px
- 로고 행: 447×42, 로고 5개(높이 42) 가로 나열, gap ≈60. Eyebrow 아래 48px
- 로고는 단색 SVG(`currentColor`)로 받아 테마별 색상(`--color-text-muted`, hover 시 원색)을 적용
- 데이터: `{ name, icon }[]`. 모바일에서는 줄바꿈되는 flex-wrap, gap 24

### 6.3 Project Card (`m-project-card`) — `19:102`, `19:103`

| 속성 | 값 |
|---|---|
| 크기 | 390×301 (2열, gap 30) |
| 구성 | 상단 썸네일 390×≈235 + 하단 정보 바 ≈66px |
| 컨테이너 | radius 12 (추정), overflow hidden, bg `--color-surface-2` |
| 정보 바 | padding 12 16 (추정). 원본 구성: 상단 라벨 “CLICK HERE TO VISIT” (Poppins 600 8–10px uppercase, `--color-text-muted`), 하단 프로젝트명 (Poppins 700 16, `--color-text-strong`), 우측 ↗ 아이콘 16px |
| 정보 바 확장 (추가) | 포트폴리오로서의 정보량을 위해 원본 라벨 자리를 **역할**로 바꾸고 아래 두 줄을 추가한다 (정보 바 높이 ≈66 → ≈112px, 카드 총 높이 ≈347px). ① 라벨: 역할 (예: "BACKEND · 2025") — 원본 라벨 스타일 그대로 ② 프로젝트명 — 원본 그대로 ③ **한 줄 요약** (해결한 문제, Work Sans 14/20 `--color-text-body`, 1줄 말줄임, 최대 60자) ④ **핵심 기술 Badge 3개** (soft, 12/16, gap 6). 위아래 요소 간격 4/8 |
| Light 모드 | 원본에 없음. bg `--color-surface` + border 1px `--color-border` |
| Hover | ↗ 아이콘 `translate(2px,-2px)`, 카드 shadow-md |
| 링크 | 카드 전체 클릭 → `/projects/[slug]`. 외부 데모 링크는 상세 페이지에 둔다 |

섹션 타이틀 “PROJECTS”: Display/section + `--gradient-orange`, 가운데 정렬. 타이틀 ↔ 카드 gap ≈27px(원본 y1143→1206에서 높이 36 제외). 구현값 **28px**.

### 6.4 Experience Timeline (`s-experience`) — Title `19:108`, Section `19:107`

- 타이틀 “EXPERIENCE”: Display/section + `--gradient-blue`, 가운데 정렬. 타이틀 ↔ 리스트 gap ≈57 → 구현값 **56px**
- 리스트 810×448, 항목 3개, 항목 간 ≈48px
- 항목 구조:
  ```
  [회사로고 24] ─12─ [직함 at 회사 (Title/exp)]                 [기간 (14/20, muted)]
  [설명 (Body/exp, --color-text-muted), 최대 3줄]
  ```
  제목행 ↔ 설명 gap 16
- 데이터: `{ company, logo, role, period, description }[]`

### 6.5 Contact (`s-contact`) — 포트폴리오 Footer `19:104`

- 원본 위치는 페이지 최하단(footer 위)이며 배경이 살짝 밝은 다크 블록. 이 프로젝트에서는 About 페이지 하단의 `#contact` 섹션으로 둔다.
- 배경 `--color-bg-subtle`, 섹션 padding 64 0
- 제목 “Contact” (Work Sans 600 24/28), 소개문 (16/24 muted, max-width 520), 이메일 링크(메일 아이콘 16 + 텍스트 + "주소 복사" 아이콘 버튼 16), 소셜 아이콘 행(24px, gap 24: GitHub, LinkedIn, X, YouTube 등), 이력서 다운로드 링크
- 이메일과 소셜 링크 텍스트는 **복사 방지 예외**로 선택·복사할 수 있다 ([접근 통제 §2.1](../plan/04_access_control_and_content_protection.md))
- 블로그 Footer와 기능이 겹치지 않도록 Footer Info에는 이메일만 남긴다.

### 6.6 Author Info Box (`o-author-info`) — 블로그 `2101:21791`

About 페이지 상단과 글 상세 하단의 “작성자 소개”에 재사용한다.

- 1216 폭, bg `--color-bg-subtle`, padding 48, radius 12, 내부 콘텐츠 668px 가운데 정렬, gap 24
- 아바타 64px + (이름 b2/Medium 20/28 `--color-text-strong`, 직함 b5 14/20 `#696A75`) gap 16
- 소개문 b3 18/26 `--color-text-body` 가운데 정렬
- 소셜 버튼 (icon variant) gap 8

---

## 7. 페이지별 화면 설계

### 7.1 Home `/`

| 순서 | 섹션 | 소스 | 핵심 스펙 |
|---|---|---|---|
| 1 | Navbar | 블로그 | §5.1 |
| 2 | Profile Hero | 포트폴리오 | §6.1, padding-top 96 |
| 3 | Tech Stack | 포트폴리오 | §6.2, Hero와 88px 간격 |
| 4 | Featured Projects (2~4개, `id="projects"`) | 포트폴리오 | §6.3, **2열**(810 폭), 섹션 간격 80, 하단 “View All Projects” outline 버튼 |
| 5 | Featured Post (**조건부**) | 블로그 | §5.5 Hero Card. Featured 글이 있고 **발행 글이 4개 이상일 때만** 표시. 아니면 생략하고 6번이 바로 이어진다 |
| 6 | Latest Post (6개, 3×2) | 블로그 | 타이틀 “Latest Post” h3/Bold 24/28, 타이틀 ↔ 그리드 32, §5.4 |
| 7 | View All Post 버튼 | 블로그 | outline, 그리드 아래 32, 가운데 |
| 8 | Footer | 블로그 | §5.9, 위 섹션과 100px 간격 |

**Home 구성 근거**: 첫 화면은 “누구인가”(포트폴리오 Hero), 스크롤하면 “무엇을 했나”(프로젝트), 이어서 “무엇을 쓰나”(블로그) 순서로 읽힌다. 블로그 원본의 Hero 카드는 5번 Featured Post로 옮겨 블로그 영역의 시작점 역할을 한다.

**방문자별 이동 경로**
| 방문자 | 주로 확인하는 것 | 첫 화면에서의 경로 |
|---|---|---|
| 채용 담당자 | 역할, 성과, 연락처, 이력서 | Hero "프로젝트 보기" → 프로젝트 카드(역할·요약·기술) → 상세 / 보조 링크 "이력서 다운로드", "연락하기" |
| 동료 개발자 | 문제 해결 과정, 코드 | Hero "기술 글 읽기" → `/blog` / 프로젝트 상세의 트러블슈팅 |

모바일에서는 Hero와 큰 이미지 때문에 글 목록이 화면 아래로 밀리므로, Hero CTA가 블로그와 프로젝트로 바로 가는 입구 역할을 한다.

### 7.2 Blog 목록 `/blog`

1. Navbar
2. Page Info (제목 “Blog”, Breadcrumb Home / Blog) — navbar 아래 24
3. **카테고리 필터 칩 (추가)**: Badge `soft` 형태 가로 스크롤 리스트. 선택 시 `solid`. Page Info 아래 24
   - **태그 필터** `?tag=<slug>`: 글 상세·카드의 태그를 누르면 진입한다. Page Info 제목은 `#태그명`, Breadcrumb `Home / Blog / #태그명`, 칩 영역 대신 "태그 필터 해제 ✕" 칩 1개를 보여주고, Overlay 카드는 숨긴다
4. Overlay Post Card (최신 1개) — 1216×450, 위 블록과 48 간격
5. 카드 그리드 3열 × 3행 (9개) — Overlay 아래 48 (원본 722→770)
6. Load More 버튼 (outline, 그리드 아래 32) — 클릭 시 9개씩 추가 로드. 페이지네이션 URL은 `?page=` 쿼리로 동기화
7. Footer (원본의 Ads 영역은 제거)

빈 상태: “아직 글이 없습니다” + Home 링크. 로딩: 카드 스켈레톤 (썸네일/제목 2줄/메타, bg `--color-bg-subtle`, shimmer). 카테고리·태그 필터를 바꾸는 화면 전환 중에만 그리드 자리에 9개를 보여 준다. 첫 방문은 완성된 화면을 받는다 ([프론트 §6.2](../plan/02_frontend_plan.md#62-blog-목록), 2026-11-27 개발자 결정).

### 7.3 글 상세 `/blog/[slug]` — `2101:22009`

| 요소 | 스펙 |
|---|---|
| 레이아웃 | 800px 중앙, navbar 아래 32, 블록 간 gap 32 |
| Blog Info | Badge(solid, padding 6 12) → gap 16 → 제목 h1 36/40 → gap 20 → Author Meta(작은 사이즈) + 읽는 시간 |
| 커버 이미지 | 800×462, radius 12 |
| 본문 p | Source Serif Pro 20/32 `--color-text-body`. 문단 간격 32 (원본은 빈 줄 1개 = 32px) |
| 본문 h2 | Work Sans 600 24/28 `--color-text-strong`, 아래 본문과 gap 16 |
| 본문 h3 (추가) | Work Sans 600 20/24 |
| Quote | bg `--color-bg-subtle`, border-left 4px `--color-border`, padding 32, radius 12, Source Serif Pro Italic 24/32 `--color-text-strong` |
| 본문 이미지 | 폭 100%, radius 12, 캡션(추가) 14/20 muted 가운데 |
| 코드 블록 (추가) | 기술 블로그 필수 요소. bg `--color-code-bg`(M2-02), border 1px `--color-border`, radius 12, padding 20 24, JetBrains Mono 14/22, 우측 상단 복사 버튼 |
| 인라인 코드 (추가) | bg `--color-primary-soft`, color `--color-primary-text`(§9 강조색 글자), padding 2 6, radius 4 |
| 링크 | `--color-primary-text`(§9 강조색 글자), underline offset 3px |
| 하단 | 태그 목록(soft badge, 각각 `/blog?tag=<slug>` 링크) → Author Info Box(§6.6, 폭 800으로 축소) → 이전/다음 글 2열 카드 → 관련 글 3개(카드 그리드) |
| 목차 TOC (추가) | ≥1280px에서만 아티클 우측 sticky (폭 200, 14/20 muted, 현재 항목 primary) |

### 7.4 Projects `/projects`

1. Navbar → Page Info (“Projects”)
2. 섹션 타이틀 “PROJECTS” (gradient-orange) — 선택 사항, Page Info와 중복되면 생략
3. Project Card **3열 그리드** (1216 컨테이너, 카드 392 = 블로그 카드 폭, gap 20). tablet 2열, mobile 1열. (Home의 Featured Projects는 원본대로 810 폭 2열)
4. 기술 스택 필터 칩 (추가)

**프로젝트 상세** `/projects/[slug]`: Single Post 레이아웃을 재사용하고, 상단에 메타 테이블(기간, 역할, 기술 스택 배지, GitHub/Demo 버튼)을 추가한다.

### 7.5 About `/about`

1. Navbar
2. Author Info Box (§6.6) — 이름, 직함, 소개, 소셜
3. Tech Stack (§6.2)
4. Experience Timeline (§6.4)
5. Contact (§6.5, `id="contact"`)
6. Footer

### 7.6 Search `/search?q=`

Page Info(“Search: {q}”, 결과 개수) + 카드 그리드. 결과 없음 상태 제공.

### 7.7 404

가운데 정렬: Display/hero “404” (gradient-primary) + 설명 + Home 버튼(pill-solid).

---

## 8. 테마 (Light / Dark) 구현 규칙

1. **기본값**: 사용자 저장값(`localStorage.theme`) → 없으면 `prefers-color-scheme` → 기본 Light.
2. **FOUC 방지**: `<head>`의 인라인 스크립트가 렌더 전에 `document.documentElement.dataset.theme`를 설정한다 (Next.js라면 `next-themes` 또는 동등한 처리).
3. **토큰 정의**:
   ```css
   :root, [data-theme="light"] { --color-bg:#FFFFFF; --color-surface:#FFFFFF; --color-border:#E8E8EA; --color-text-strong:#181A2A; --color-text-body:#3B3C4A; /* … §3.3 */ }
   [data-theme="dark"]         { --color-bg:#181A2A; --color-surface:#181A2A; --color-border:#242535; --color-text-strong:#FFFFFF;  --color-text-body:#BABABF; /* … */ }
   ```
   컴포넌트에는 시맨틱 토큰만 쓴다. Hex 하드코딩은 금지한다.
4. **전환 애니메이션**: `background-color, color, border-color` 200ms ease. `prefers-reduced-motion`이면 생략한다.
5. **에셋**: 로고는 Light/Dark 2종이거나 `currentColor` SVG. 기술 스택/소셜 아이콘은 `currentColor`. 코드 하이라이트 테마도 2종 (Light: github-light, Dark: github-dark-dimmed 계열).
6. `color-scheme: light dark`를 선언해 스크롤바와 폼 컨트롤도 테마를 따르게 한다.

---

## 9. 접근성 & 품질 기준

- 색 대비 WCAG AA: 모든 텍스트 4.5:1 이상 (큰 텍스트 3:1). 날짜·작성자 같은 메타 텍스트도 정보를 전달하므로 예외가 아니다.
  - **결정**: Light 모드의 `--color-text-muted`를 원본 `#97989F`(on `#FFFFFF` ≈2.9:1, 미달)에서 **`#696A75`(≈5.4:1)** 로 바꾼다. §11 디자인 검수에서 허용 차이로 취급한다.
  - Dark 모드는 원본 `#97989F` on `#181A2A`(≈5.9:1)로 기준을 충족하므로 그대로 둔다.
  - **placeholder도 텍스트이므로 대비 기준(4.5:1) 대상이다.** 원본 Light 검색 placeholder `#A1A1AA` on `#F4F4F5`는 ≈2.3:1로 미달이라 **`#696A75`(≈4.9:1)** 로 바꾼다. Dark는 `#97989F` on `#242535`(≈5.3:1)로 충족한다. `aria-label`은 접근 가능한 이름을 위한 것이며 시각적 대비 요구를 대신하지 않는다.
  - **강조색 글자 대비 (2026-11-22 개발자 결정, M1-08)**: 원본 `#4B6BFB`는 흰 글자를 올리면 4.38:1, 흰 배경 위 글자로 4.38:1, Dark 배경 위 글자로 3.93:1로 미달이다. 그래서 `#4B6BFB`(`--color-primary`)는 **글자가 아닌 용도**(테두리·포커스 링·토글 트랙·큰 장식, 비텍스트 기준 3:1)에만 쓰고, 채운 배경 위 흰 글자는 `--color-primary-strong`(`#4361EE`), 강조색 글자는 `--color-primary-text`(Light `#4361EE` / Dark `#7B93FF`)를 쓴다.
  - 원본 대비 색상 변경은 이 세 가지(메타 텍스트, placeholder, 강조색 글자·채운 배경)뿐이다.
- 그라디언트 텍스트는 Light 배경에서 대비가 낮아질 수 있다. Display 사이즈(≥24px 굵게, 기준 3:1)로만 쓴다.
- 포커스 링: `outline: 2px solid var(--color-primary); outline-offset: 2px` (모든 인터랙티브 요소).
- 테마 토글: `role="switch"`, `aria-checked`, `aria-label="다크 모드 전환"`.
- 이미지: 모든 썸네일에 `alt`. 장식 이미지는 `alt=""`.
- 성능: 썸네일은 `next/image` 등으로 반응형 srcset + lazy-load. 폰트는 `font-display: swap`, 필요한 weight만 subset.

---

## 10. 미확정 항목 – 후속 확인 필요

Figma MCP 호출 한도(Starter 플랜) 때문에 다음 값은 추정치다. 구현 착수 전 Figma Dev Mode 또는 MCP 재호출로 확정한다.

| # | 항목 | 확인할 노드 | 현재 처리 |
|---|---|---|---|
| 1 | 포트폴리오 폰트 패밀리/사이즈 | `CoblNV…` `19:109`, `19:110`, `19:105`, `19:107` | Poppins 추정 |
| 2 | 그라디언트 3종 stop 값 | 포트폴리오 변수 `Orange/Blue/Primary Gradient` | §3.4 추정값 |
| 3 | 프로젝트 카드 radius/정보바 패딩 | `19:102` | 12 / 12·16 추정 |
| 4 | CTA 버튼 크기/보더 두께 | `19:99` | h52, border 2 추정 |
| 5 | Dark navbar (메뉴 색, 검색 bg, 토글 상태) | 블로그 `2147:4046` | §3.3 추정값 |
| 6 | Light footer 배경/링크 색 | 블로그 `2101:21809` | `#F6F6F7` / `#3B3C4A` 추정 |
| 7 | Page Info / Breadcrumb 상세 | 블로그 `2101:21310` | §5.7 |
| 8 | Outline 버튼 보더 색 | 블로그 `2147:4287` | `--color-border-strong` 추정 |
| 9 | Dark 본문 텍스트 색 | 블로그 Single Post Dark `2143:5373` | `#BABABF` 추정 |

---

## 11. 구현 후 디자인 검수 (원본 대비 차이 수정 프로세스)

구현이 끝나면 아래 절차로 원본과 비교하고 차이를 수정한다. 결과는 작업별 기록(`docs/work/<마일스톤>/tasks/<작업ID>.md`의 인계 노트)과 마일스톤 결과(`docs/work/<마일스톤>/report.md`)에 남긴다 ([협업 아키텍처 §9](../plan/05_collaboration_architecture.md#9-정보-전달-방식)). 실행은 Test Agent, 차이 수정은 Frontend Agent가 맡는다.

1. **스크린샷 캡처**: Playwright로 각 페이지를 1920 / 1440 / 1024 / 768 / 375 폭, Light/Dark로 캡처한다.
2. **원본 비교**
   - 블로그 유래 페이지: 1920 Light/Dark 캡처 ↔ `references/blog-*.png` (또는 Figma `get_screenshot` 재추출)
   - 포트폴리오 유래 섹션: 1440 Dark 캡처 ↔ `references/portfolio-home.png`
   - 오버레이 diff(`pixelmatch` 등)로 차이 영역을 시각화한다.
3. **체크리스트** (컴포넌트별 ✅/❌)
   - [ ] 색상: 배경/텍스트/보더가 §3.3 토큰과 일치 (DevTools computed 값 확인)
   - [ ] 폰트: family / weight / size / line-height가 §3.5와 일치
   - [ ] 간격: 컨테이너 1216, 카드 392×488, gap 20, 섹션 간격 80, 패딩 16/8/40/48/64
   - [ ] Radius 6/12, shadow-md
   - [ ] 레이아웃: 요소 순서, 정렬, 줄바꿈 위치
   - [ ] 반응형: 브레이크포인트별 열 수와 타이포 축소, 가로 스크롤 없음
   - [ ] 테마: 토글 동작, 새로고침 시 유지, FOUC 없음, 모든 컴포넌트 Dark 대응
4. **검수 기준은 대상에 따라 둘로 나눈다.** 이 프로젝트는 두 템플릿을 재구성하므로, 원본 페이지와 통째로 픽셀 비교할 수 없다.

   | 대상 | 예시 | 기준 |
   |---|---|---|
   | **A. 원본에 그대로 있는 컴포넌트** | Navbar, PostCardGrid, FeaturedHeroCard, PostCardOverlay, Article 본문, AuthorInfoBox, Footer, ProfileHero(문구 제외), TechLogoRow, ExperienceItem | 같은 뷰포트(1920 또는 1440)에서 **컴포넌트 단위로 잘라** Figma 원본과 비교. 위치/크기 **±2px**, 색상 정확히 일치. 폰트 렌더링 차이는 제외 |
   | **B. 재구성·변경한 부분** | Home 섹션 조합, `/projects` 3열, ProjectCard 정보 바 확장, Hero 보조 링크, 카테고리/태그 칩, 코드블록, TOC, 관리자 화면 | 픽셀 비교 대신 **규칙 준수** 확인: 사용한 색·폰트·간격·radius가 모두 §3 토큰인지, 섹션 간격(80)·그리드 gap·컨테이너 폭이 §4를 따르는지. 확인 후 승인한 스크린샷을 **기준 이미지**로 확정하고, 이후 변경은 시각 회귀(Playwright)로 검사 |
   | **의도된 차이 목록** | Light `--color-text-muted` `#97989F`→`#696A75`, Light 검색 placeholder `#A1A1AA`→`#696A75`, 강조색 채운 배경·글자 `#4B6BFB`→`#4361EE`(Dark 글자 `#7B93FF`, §9), Hero CTA 문구, ProjectCard 정보 바 확장, 광고 영역 제거 | 차이로 보고하지 않는다. 목록에 없는 차이만 수정 대상이다 |

5. **수정 → 재캡처 → 재비교**를 A는 허용 오차 이내가 될 때까지, B는 규칙 위반이 없을 때까지 반복한다.
6. **시각 회귀 운용** (2026-11-24 개발자 승인, M1-05·M1 report §9). 운용 절차는 [협업 §4.3-a](../plan/05_collaboration_architecture.md#43-a-테스트-환경-책임-c16)를 따른다.
   - **실행 환경**: 고정 컨테이너(`scripts/visual/`)에서 실행한다.
     - Playwright 공식 이미지를 태그와 digest로 고정한다.
     - Node 버전은 `.nvmrc`를 따른다.
     - 플랫폼은 **linux/amd64**로, CI 러너와 같다.
   - **명령**: `pnpm test:visual`(비교), `pnpm test:visual:update`(기준 이미지 갱신)
   - **허용 오차**: `threshold: 0`, `maxDiffPixels: 15`(`frontend/playwright.config.ts`)
     - 근거: 로컬 amd64 에뮬레이션과 CI 네이티브 실행 사이에 안티앨리어싱 차이가 최대 12픽셀 났다(CI run 45028268322).
     - 이 값에서도 시험용 변경은 검출된다. 가장 작은 변경이 245픽셀 차이였다.
     - 값을 바꾸면 이 항목을 고친다.
   - **고정할 것**:
     - 저작권 연도처럼 날짜에 따라 바뀌는 부분은 마스크로 가린다.
     - 전환 애니메이션은 끝날 때까지 기다린 뒤 캡처한다.

> **M1 한시 대체 비교** (2026-11-22 개발자 결정, M1 계획 G1): Figma MCP 한도로 원본 재추출이 안 되는 동안 A 대상은 로컬 참고 스크린샷(`references/`, 원본 1920px의 축소본)과 비교한다. 캡처를 참고 스크린샷 폭으로 축소해 같은 영역을 비교하고, 위치·크기는 축소 이미지 기준 ±2px, 색은 채널별 ±3 이내로 판정한다. 판정할 수 없는 항목은 "원본 확인 불가"로 기록한다. Figma 접근이 되면 위 4번의 A 기준(±2px)으로 다시 비교한다 (Issue #27).

---

## 12. 컴포넌트 목록 (구현 체크리스트)

| 분류 | 컴포넌트 | 출처 | 우선순위 |
|---|---|---|---|
| Atom | Badge(solid/soft), Button(primary/outline/icon/pill-solid/pill-outline), Avatar, Input, SearchInput, ThemeToggle, Icon | 블로그 + 포트폴리오 | P0 |
| Molecule | AuthorMeta, PostCardGrid, PostCardOverlay, ProjectCard, ExperienceItem, TechLogoRow, Newsletter/ContactCard, Breadcrumb | 혼합 | P0 |
| Organism | Navbar(+MobileMenu), Footer, FeaturedHeroCard, PostGrid, ProfileHero, ExperienceSection, ContactSection, AuthorInfoBox, Article(본문 렌더러), TOC | 혼합 | P0~P1 |
| Template | HomePage, BlogListPage, PostDetailPage, ProjectsPage, AboutPage, SearchPage, NotFound | — | P0~P1 |
