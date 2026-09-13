/* Fluent v9 테마 오버라이드 — web-react.md: "pre-styled를 쓴다면 최소한 색·모서리·서체·그림자를 도메인 프로필로 덮어써라".
   도메인 = government(anti-slop domain-map): 모서리 0 · 그림자 없음 · 장식 모션 없음 · 액센트 oklch(0.47 0.18 250) 하나.
   서체 = 부서 양식 3벌(typography-ko + form-spec): 제목 HY헤드라인M 계열 / 항목 명조 / 본문 맑은 고딕.
   Fluent 컨트롤의 동작(포커스·메뉴·대화상자·툴팁)은 그대로 둔다 — 명세 §1.1 B "platform convention 우선". */
import { createLightTheme, createDarkTheme, type BrandVariants, type Theme } from "@fluentui/react-components";

/* 브랜드 램프: hue 250 고정, L만 계단(color-systems.md "단일 브랜드색에서 램프"). 80이 rest, 70 hover, 60 pressed. */
export const brand: BrandVariants = {
  10:  "oklch(0.13 0.03 250)", 20:  "oklch(0.18 0.05 250)", 30:  "oklch(0.24 0.08 250)", 40:  "oklch(0.30 0.11 250)",
  50:  "oklch(0.35 0.13 250)", 60:  "oklch(0.40 0.15 250)", 70:  "oklch(0.44 0.17 250)", 80:  "oklch(0.47 0.18 250)",
  90:  "oklch(0.53 0.17 250)", 100: "oklch(0.60 0.15 250)", 110: "oklch(0.67 0.13 250)", 120: "oklch(0.74 0.11 250)",
  130: "oklch(0.81 0.09 250)", 140: "oklch(0.88 0.06 250)", 150: "oklch(0.93 0.04 250)", 160: "oklch(0.97 0.02 250)",
};

export const FONT_BODY   = '"Malgun Gothic", "맑은 고딕", "NanumGothic", "나눔고딕", sans-serif';
export const FONT_TITLE  = '"HY헤드라인M", "HYHeadLine-Medium", "HY Headline M", "NanumSquare", "나눔스퀘어", "Malgun Gothic", sans-serif';
export const FONT_MYEONGJO = '"휴먼명조", "HCR Batang", "바탕", "Batang", "NanumMyeongjo", "나눔명조", serif';

const shape: Partial<Theme> = {
  /* government: border_radius 전부 0. Fluent가 radius를 토큰으로 두는 이유가 이것이다. */
  borderRadiusNone: "0", borderRadiusSmall: "0", borderRadiusMedium: "0", borderRadiusLarge: "0", borderRadiusXLarge: "0",
  /* shadow_style: none. 층위는 경계선으로(색 절 참조). flyout·dialog만 얇은 그림자 1단 — 떠 있는 표면임을 알려야 한다(desktop.md 컨텍스트 메뉴). */
  shadow2: "none", shadow4: "none", shadow8: "none",
  shadow16: "0 0 0 1px oklch(0.75 0.005 260)", shadow28: "0 0 0 1px oklch(0.55 0.01 260)", shadow64: "0 0 0 1px oklch(0.55 0.01 260)",
  shadow2Brand: "none", shadow4Brand: "none", shadow8Brand: "none", shadow16Brand: "none", shadow28Brand: "none", shadow64Brand: "none",
  /* 모션: 장식은 0. 컨트롤 피드백(hover 색 전환)만 남긴다 — web-react.md "아무것도 안 움직이면 고장난 것". */
  durationUltraFast: "50ms", durationFaster: "80ms", durationFast: "100ms", durationNormal: "120ms",
  durationGentle: "120ms", durationSlow: "120ms", durationSlower: "120ms", durationUltraSlow: "120ms",
  /* 서체·굵기: 맑은 고딕 실체 400/700. Semibold 요청은 Bold로 보낸다(합성 굵기 방지). fontFamilyNumeric=Bahnschrift 금지. */
  fontFamilyBase: FONT_BODY, fontFamilyNumeric: FONT_BODY,
  fontWeightMedium: 400, fontWeightSemibold: 700, fontWeightBold: 700,
};

/* government 라이트: 종이는 순백, 바닥은 아주 옅은 냉색. 본문은 hue 260 근검정(순검정 금지). */
export const lightTheme: Theme = { ...createLightTheme(brand), ...shape,
  colorNeutralBackground1: "oklch(1 0 0)",
  colorNeutralBackground2: "oklch(0.975 0.004 260)",
  colorNeutralBackground3: "oklch(0.955 0.004 260)",
  colorNeutralBackground4: "oklch(0.935 0.004 260)",
  colorNeutralForeground1: "oklch(0.15 0.01 260)",
  colorNeutralForeground2: "oklch(0.30 0.01 260)",
  colorNeutralForeground3: "oklch(0.40 0.01 260)",
  colorNeutralForeground4: "oklch(0.55 0.008 260)",
  colorNeutralStroke1: "oklch(0.75 0.005 260)",
  colorNeutralStroke2: "oklch(0.86 0.004 260)",
  colorNeutralStroke3: "oklch(0.92 0.004 260)",
  colorStrokeFocus2: "oklch(0.15 0.01 260)",
};
/* 다크: color-systems.md — 순흑 금지, 층위는 밝기로, 액센트 chroma 15~25% 낮춤 */
export const darkTheme: Theme = { ...createDarkTheme({ ...brand, 80: "oklch(0.62 0.14 250)", 70: "oklch(0.56 0.13 250)", 60: "oklch(0.50 0.12 250)" }), ...shape,
  colorNeutralBackground1: "oklch(0.19 0.005 260)",
  colorNeutralBackground2: "oklch(0.15 0.005 260)",
  colorNeutralBackground3: "oklch(0.23 0.005 260)",
  colorNeutralForeground1: "oklch(0.92 0.003 260)",
  colorNeutralForeground2: "oklch(0.78 0.004 260)",
  colorNeutralForeground3: "oklch(0.65 0.005 260)",
  colorNeutralStroke1: "oklch(0.40 0.005 260)",
  colorNeutralStroke2: "oklch(0.32 0.005 260)",
  colorStrokeFocus2: "oklch(0.95 0.003 260)",
  shadow16: "0 0 0 1px oklch(0.40 0.005 260)", shadow28: "0 0 0 1px oklch(0.55 0.005 260)", shadow64: "0 0 0 1px oklch(0.55 0.005 260)",
};

/* 상태 5종 — 형태가 1차, 색은 3차. 밝기 순서 고정: cancelled < confirmed < changed < needs_attention */
export const status = {
  needs: { light: "oklch(0.45 0.15 45)", dark: "oklch(0.75 0.14 45)" },
  changed: { light: "oklch(0.50 0.12 310)", dark: "oklch(0.78 0.10 310)" },
  confirmed: { light: "oklch(0.56 0.13 150)", dark: "oklch(0.75 0.12 150)" },
  cancelled: { light: "oklch(0.70 0 0)", dark: "oklch(0.55 0 0)" },
};
