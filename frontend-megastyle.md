# Calm Style

> A complete, brand-neutral blueprint for building **enterprise analytics dashboards** that feel calm, dense, and disciplined. This document is a contract: if you follow it exactly, an AI or a human can rebuild the look-and-feel of the reference app on any brand, without referring back to the original codebase.
>
> **What "Calm" means in this system:**
> - Neutral surfaces (greys + near-whites). Never glossy, never gradient-heavy.
> - **One** signal color (the brand accent) does the loud work: focus rings, primary buttons, active nav, chart hero series, KPI highlights.
> - **One** secondary accent for connectivity / supporting series.
> - Status colors (success / warning / danger / info) are reserved for *meaning*, never decoration.
> - Information-dense, laptop-first (1366–1920px target), but degrades cleanly to mobile.
> - Hover states are subtle: 2px lift, colored border, soft shadow tinted with the accent. No bouncing, no scaling above 1.02.
> - Borders carry the structure; shadows are a finishing touch, not the main hierarchy.

---

## Table of Contents

1. [Stack & Foundations](#1-stack--foundations)
2. [Design Token System](#2-design-token-system)
3. [Typography](#3-typography)
4. [Spacing, Sizing & Radii](#4-spacing-sizing--radii)
5. [Shadows & Elevation](#5-shadows--elevation)
6. [Motion & Transitions](#6-motion--transitions)
7. [Breakpoints & Responsive Rules](#7-breakpoints--responsive-rules)
8. [App Layout — Shell, Sidebar, Header](#8-app-layout--shell-sidebar-header)
9. [Page Header](#9-page-header)
10. [Filters Bar](#10-filters-bar)
11. [KPI Cards](#11-kpi-cards)
12. [Charts](#12-charts)
13. [Lists & Top-N Tables](#13-lists--top-n-tables)
14. [Full Data Tables](#14-full-data-tables)
15. [Buttons](#15-buttons)
16. [Form Inputs, Selects, Date Pickers](#16-form-inputs-selects-date-pickers)
17. [Modals, Drawers, Confirmation Patterns](#17-modals-drawers-confirmation-patterns)
18. [Upload / File Pickers](#18-upload--file-pickers)
19. [Tags, Badges, Progress Bars](#19-tags-badges-progress-bars)
20. [Empty / Loading / Error States](#20-empty--loading--error-states)
21. [Login / Auth Pages](#21-login--auth-pages)
22. [Theme Toggle (Light/Dark)](#22-theme-toggle-lightdark)
23. [Scrollbars](#23-scrollbars)
24. [Iconography](#24-iconography)
25. [Composition Recipes (Page Layouts)](#25-composition-recipes-page-layouts)
26. [Pitfalls & Anti-Patterns](#26-pitfalls--anti-patterns)
27. [Brand-Neutral Palette Swap Guide](#27-brand-neutral-palette-swap-guide)

---

## 1. Stack & Foundations

This style is built on a specific stack. **Do not substitute** — many of the patterns rely on these libraries' tokens and behaviors.

| Layer            | Library                              | Version       | Role                                                            |
| ---------------- | ------------------------------------ | ------------- | --------------------------------------------------------------- |
| Framework        | React                                | 18.3+         | All UI.                                                         |
| Build            | Vite                                 | 5.4+          | Dev server, bundler.                                            |
| Language         | TypeScript                           | 5.6+          | Strict types everywhere.                                        |
| Component lib    | Ant Design (`antd`)                  | 5.21+         | Tables, forms, modals, layout primitives, menu, dropdown.       |
| Icons            | `@ant-design/icons`                  | 5.5+          | All icons. Outline by default, filled only for active states.   |
| Utility CSS      | Tailwind CSS                         | 4.1+          | Layout, spacing, semantic color classes via CSS vars.           |
| Charts           | ECharts via `echarts-for-react`      | 5.5+ / 3.0+   | Every chart in the app.                                         |
| Routing          | `react-router-dom`                   | 6.28+         | Top-level navigation.                                           |
| Data fetching    | `@tanstack/react-query`              | 5.59+         | All server state.                                               |
| Dates            | `dayjs`                              | 1.11+         | Always dayjs (never moment, never native Date in UI).           |
| Exports          | `xlsx`, `xlsx-js-style`              | 0.18+ / 1.2+  | Excel exports/templates.                                        |
| PDFs             | `@react-pdf/renderer`                | 4.5+          | PDF generation.                                                 |

**Hard rules:**
- React 18 + functional components only. No class components.
- Antd theme is the **primary** styling vehicle for components. Tailwind handles layout + token plumbing. Never bypass an antd component to roll your own (e.g., never write a `<button>` when `<Button>` exists).
- Charts use the centralized `getEChartsTheme(mode)` function — never inline-define colors per chart.

---

## 2. Design Token System

### 2.1 Architecture

Three layers, top to bottom:

1. **Brand anchors** — immutable hex values from a brand book. Used only by tokens.
2. **Semantic tokens** — role-based names (`canvas`, `surface`, `accent-primary`, `text-secondary`). Used only by components.
3. **CSS variables** — emitted on `<html data-theme="light|dark">`. Components reference `var(--token-name)`.

**Rule:** Components **never** reference brand anchors or raw hex. Always `var(--…)` or the corresponding Tailwind utility (`bg-surface`, `text-text-primary`).

### 2.2 Token Names (semantic)

These are the canonical names. Use them verbatim.

**App-level surfaces (the room itself):**
- `--canvas` — outermost background. The desk.
- `--shell` — app shell: sidebar bg, header bg. The walls.
- `--section` — page sections. The desk surface.
- `--divider` — hairlines between sections.

**Content surfaces (objects on the desk):**
- `--surface` — base card background.
- `--elevated` — elevated card (hover destination, focus).
- `--hover` — hover background for menu items, rows.

**Borders:**
- `--border-subtle` — default card and input borders.
- `--border-strong` — emphasized borders (focus, active dragger).

**Text:**
- `--text-primary` — titles, KPI values, table data.
- `--text-secondary` — labels, captions, secondary copy.
- `--text-muted` (alias `--text-tertiary`) — placeholder, helper text, trend captions.
- `--text-inverse` — text on filled accent backgrounds.

**Accents (the brand voice):**
- `--accent-primary` — main brand signal. Used for: primary buttons, active nav, focus rings, KPI hero icons, first chart series, progress fills.
- `--accent-primary-soft` — tinted background for icon chips and soft pills.
- `--accent-secondary` — supporting brand color. Used for: secondary KPI accent, connectivity, second chart series.
- `--accent-secondary-soft` — tinted bg for secondary icon chips.

**Status (meaning-only — never decoration):**
- `--status-success` — positive deltas, success alerts, "new" counts.
- `--status-warning` — caution, warnings, "update" counts. **Always orange, never yellow** (yellow is reserved for accent-primary in the worked example; this rule prevents collision).
- `--status-danger` — errors, negative deltas, destructive actions.
- `--status-info` — informational, neutral highlights.

**Legacy aliases (keep for compatibility):**
`--bg-base`, `--bg-container`, `--bg-elevated`, `--bg-hover`, `--border`, `--border-hover` — these alias `--canvas`, `--shell`, `--surface`, `--hover`, `--border-subtle`, `--border-strong` respectively. New code uses the semantic names.

### 2.3 Worked Palette (the reference app uses these — see §27 to swap)

**Light mode:**

```ts
export const lightTokens = {
  canvas:        '#F4F6FA',
  shell:         '#EEF2F7',
  section:       '#FFFFFF',
  divider:       '#E2E8F0',
  surface:       '#FFFFFF',
  elevated:      '#F9FAFC',
  hover:         '#EDF2FF',
  borderSubtle:  '#CBD5E1',
  borderStrong:  '#94A3B8',
  textPrimary:   '#0A0046',  // deep brand blue-purple
  textSecondary: '#1C1C1C',  // near-black
  textMuted:     '#64748B',
  textInverse:   '#FFFFFF',
  accentPrimary:        '#FFCB05',  // brand yellow
  accentPrimarySoft:    '#FFF9E6',
  accentSecondary:      '#2FB290',  // teal
  accentSecondarySoft:  '#E6F7F3',
  statusSuccess: '#42B52E',
  statusWarning: '#F97316',  // orange (NOT yellow — yellow is the brand accent)
  statusDanger:  '#DC2626',
  statusInfo:    '#01B4D2',
}
```

**Dark mode (neutral grey — NOT pure black, NOT navy):**

```ts
export const darkTokens = {
  canvas:        '#202020',
  shell:         '#2A2A2A',
  section:       '#333333',
  divider:       '#404040',
  surface:       '#2E2E2E',
  elevated:      '#383838',
  hover:         '#424242',
  borderSubtle:  '#4A4A4A',
  borderStrong:  '#5A5A5A',
  textPrimary:   '#F5F5F5',
  textSecondary: '#CCCCCC',
  textMuted:     '#999999',
  textInverse:   '#202020',
  accentPrimary:        '#FFD633',  // brighter for dark bg
  accentPrimarySoft:    '#2D2410',  // dark tinted, NOT semi-transparent overlay
  accentSecondary:      '#4ADEBD',
  accentSecondarySoft:  '#1A3D35',
  statusSuccess: '#5FE670',
  statusWarning: '#FB923C',
  statusDanger:  '#FF8A8A',
  statusInfo:    '#4DF0FF',
}
```

**Dark mode rules:**
- Surface progression is a clear ladder: `#202020 → #2A2A2A → #2E2E2E → #333333 → #383838 → #424242`. Each step is **~4–8 grey units brighter**. Don't compress this — depth perception lives in these gaps.
- Accents brighten for dark mode (`#FFCB05 → #FFD633`). Same hue, +15–25% lightness.
- Soft accent backgrounds in dark mode are **opaque dark tints**, not transparent overlays.

### 2.4 CSS Variable Emission

Variables are emitted by `[data-theme="light"]` and `[data-theme="dark"]` selectors on `<html>`. The toggle flips `data-theme` and Antd's `ConfigProvider.algorithm` simultaneously.

```css
html[data-theme="light"] {
  --canvas: #F4F6FA;
  --shell: #EEF2F7;
  /* ...all tokens... */
  --scrollbar-track: #F4F6FA;
  --scrollbar-thumb: #CBD5E1;
  --scrollbar-thumb-hover: #94A3B8;
}
html[data-theme="dark"] {
  --canvas: #202020;
  /* ...all tokens... */
  --scrollbar-track: #2E2E2E;
  --scrollbar-thumb: #4A4A4A;
  --scrollbar-thumb-hover: #5A5A5A;
}
```

### 2.5 Tailwind Bridge

Map every semantic token to a Tailwind utility class so layouts can compose without inline styles:

```js
// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas:   'var(--canvas)',
        shell:    'var(--shell)',
        section:  'var(--section)',
        divider:  'var(--divider)',
        surface:  'var(--surface)',
        elevated: 'var(--elevated)',
        hover:    'var(--hover)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        'text-primary':   'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted':     'var(--text-muted)',
        'text-inverse':   '#FFFFFF',
        'accent-primary':        'var(--accent-primary)',
        'accent-primary-soft':   'var(--accent-primary-soft)',
        'accent-secondary':      'var(--accent-secondary)',
        'accent-secondary-soft': 'var(--accent-secondary-soft)',
        'status-success': 'var(--status-success)',
        'status-warning': 'var(--status-warning)',
        'status-danger':  'var(--status-danger)',
        'status-info':    'var(--status-info)',
      },
      boxShadow: {
        'calm-sm': '0 1px 2px 0 rgba(10, 0, 70, 0.08)',
        'calm-md': '0 4px 6px -1px rgba(10, 0, 70, 0.12), 0 2px 4px -1px rgba(10, 0, 70, 0.08)',
        'calm-lg': '0 10px 15px -3px rgba(10, 0, 70, 0.15), 0 4px 6px -2px rgba(10, 0, 70, 0.08)',
        'calm-xl': '0 20px 25px -5px rgba(10, 0, 70, 0.15), 0 10px 10px -5px rgba(10, 0, 70, 0.08)',
        'calm-accent': '0 6px 20px rgba(90, 139, 255, 0.15)',
      },
      fontFamily: {
        sans: ['-apple-system','BlinkMacSystemFont','Segoe UI','Roboto','Helvetica Neue','Arial','sans-serif'],
      },
    },
  },
}
```

---

## 3. Typography

### 3.1 Family

**Exact stack — do not change order:**
```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

No custom web fonts. The system stack is intentional — it feels native on every OS and avoids the "design system in a Google font" tell.

### 3.2 Base size & line-height

| Token              | Value     |
| ------------------ | --------- |
| Base font size     | **14px**  |
| Base line-height   | **1.5714** (= 22px) |
| Smoothing          | `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;` |

This is **laptop-first**. 14px reads correctly at typical viewing distance for a 1366–1920px display. Never set the body to 16px — it breaks the density.

### 3.3 Size scale (Antd-aligned)

| Use                       | Size    | Weight | Color              |
| ------------------------- | ------- | ------ | ------------------ |
| `fontSizeXL`              | 20px    | 600    | `--text-primary`   |
| `fontSizeLG`              | 16px    | 500/600| `--text-primary`   |
| `fontSize` (body)         | 14px    | 400    | `--text-primary`   |
| `fontSizeSM` (caption)    | 12px    | 400/500| `--text-secondary` |
| Micro label (uppercase)   | 11px    | 500    | `--text-secondary` |
| Brand attribution         | 10px    | 500    | `--text-secondary` |

### 3.4 Heading scale

| Level | Size | Line-height | Use                                     |
| ----- | ---- | ----------- | --------------------------------------- |
| H1    | 32px | 1.25        | Page title (rare — use H2 for pages).   |
| H2    | 24px | 1.33        | **Page title via `<PageHeader title>`.**|
| H3    | 20px | 1.40        | Section title.                          |
| H4    | 18px | 1.50        | Sub-section, modal title.               |
| H5    | 16px | 1.50        | Card title, sidebar title, label group. |

Responsive scaling for page titles via media queries:
- ≥1600px: 32px
- 1200–1599px: 28px
- 992–1199px: 26px
- 768–991px: 24px
- <768px: 20px (575px: 18px)

### 3.5 Special typography rules

1. **KPI value** — `28px / 700 / line-height: 1.2 / font-variant-numeric: tabular-nums`. Tabular nums is non-negotiable: numbers must align vertically in grids.
2. **KPI label** — `11px / 500 / uppercase / letter-spacing: 0.8px / --text-secondary`. The wide tracking + uppercase is the visual cue that this is a label, not data.
3. **Brand attribution label** ("powered by …") — `10px / 500 / uppercase / letter-spacing: 0.5px / --text-secondary`.
4. **Chart title** — `16px / 600 / --text-primary`.
5. **Trend delta** — `11px / 600`, colored `--status-success` or `--status-danger`. Followed by `10px / 400 / --text-muted` caption "vs last period".
6. **Inline code** (in instructions, errors) — `<Text code>` from antd. Slightly larger than body: `15px` in modal instructions, `14px` otherwise.

### 3.6 Color application

- Primary text (titles, KPI values, table cell content): `--text-primary`.
- Secondary text (labels, captions, helper): `--text-secondary`.
- Muted text (placeholder, trend caption, footer attribution): `--text-muted`.
- **Never** use opacity for hierarchy. Always use the correct text token.
- Status text uses status tokens directly: `color: var(--status-success)` for positive.

---

## 4. Spacing, Sizing & Radii

### 4.1 Spacing scale (matches Antd)

```ts
export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
}
```

**Antd token defaults this style sets:**
```ts
padding:    16,
paddingLG:  24,
paddingSM:  12,
paddingXS:  8,
paddingXXS: 4,
margin:     16,
marginLG:   24,
marginSM:   12,
marginXS:   8,
marginXXS:  4,
```

### 4.2 Border radii

```ts
borderRadius:   8,    // default — buttons, inputs, selects, date pickers, small cards
borderRadiusLG: 12,   // cards, modals, chart containers, data table containers
borderRadiusSM: 6,    // small chips, tooltip, insight items, segmented small
borderRadiusXS: 4,    // tags, scrollbar thumb
```

**Component-specific radii:**
- KPI card: **10px** (between SM and LG — its own thing).
- Buttons: 8px.
- Tooltips: 6px.
- Tags: 4px.
- Mobile card breakpoints (≤767px): drop card radius to 8px.

### 4.3 Control heights

```ts
controlHeight:   32,   // Antd default
controlHeightLG: 40,
controlHeightSM: 24,

// Button overrides:
Button.controlHeight:   36,
Button.controlHeightLG: 40,
Button.controlHeightSM: 32,

// Input/Select/DatePicker:
Input.controlHeight:   36,
Select.controlHeight:  36,
DatePicker.controlHeight: 36,
```

### 4.4 Layout dimensions

| Element                       | Size                                |
| ----------------------------- | ----------------------------------- |
| Sidebar expanded width        | **220px**                           |
| Sidebar collapsed width       | **72px**                            |
| Mobile drawer width           | **260px**                           |
| Header height                 | **64px**                            |
| Header padding inline         | matches content padding (responsive)|
| Filters bar height            | ~56px (12px padding + 36px controls)|
| Filters bar sticky top        | 64px (under header)                 |
| Sidebar menu item height      | **44px**                            |
| Sidebar menu icon size        | **18px**                            |
| User avatar size              | default (32px) on md+, small (24px) on smaller |
| Max content width (ultrawide) | **1920px** — center beyond this     |

### 4.5 Card padding

| Breakpoint              | Card padding |
| ----------------------- | ------------ |
| ≥1200px                 | 24px         |
| 992–1199px              | 20px         |
| 768–991px               | 16px         |
| <768px                  | 12px         |

### 4.6 Grid gutters

- Default antd `Row` gutter: `[16, 16]`.
- KPI grid gap (responsive): 16px (lg), 12px (md), 10px (sm).
- Section vertical gap (between page sections): 24px (lg), 20px (md), 16px (sm). Implemented with `gap` on a flex column container, not bottom margins.

### 4.7 Content padding (page-level)

| Breakpoint | Content padding |
| ---------- | --------------- |
| ≥1200px    | 24px            |
| 992–1199px | 20px            |
| 768–991px  | 16px            |
| <768px     | 12px            |

---

## 5. Shadows & Elevation

Shadows are **tinted with the deep text color** (e.g., `rgba(10, 0, 70, 0.x)`) not neutral black. This gives them a calm, brand-coherent feel.

```ts
boxShadow: {
  'calm-sm':     '0 1px 2px 0 rgba(10, 0, 70, 0.08)',
  'calm-md':     '0 4px 6px -1px rgba(10, 0, 70, 0.12), 0 2px 4px -1px rgba(10, 0, 70, 0.08)',
  'calm-lg':     '0 10px 15px -3px rgba(10, 0, 70, 0.15), 0 4px 6px -2px rgba(10, 0, 70, 0.08)',
  'calm-xl':     '0 20px 25px -5px rgba(10, 0, 70, 0.15), 0 10px 10px -5px rgba(10, 0, 70, 0.08)',
  'calm-accent': '0 6px 20px rgba(90, 139, 255, 0.15)',  // accent-tinted lift
}
```

**Usage:**
- Cards at rest: **no shadow** — they rely on border.
- Card hover: `0 6px 20px rgba(<accent-rgb>, 0.15)` + colored border. Compute the rgba from your accent — replace the values when swapping palettes.
- Modal: Antd default (`calm-lg` equivalent).
- Dropdown / Tooltip popovers: Antd default.
- Buttons primary shadow: `0 2px 8px rgba(<primary-rgb>, 0.15)`.

---

## 6. Motion & Transitions

```ts
motionDurationFast: '0.1s',
motionDurationMid:  '0.2s',
motionDurationSlow: '0.3s',
```

**Component-level transitions (always include these):**
- Card hover: `transition: all 0.2s ease`.
- KPI card hover: `transition: all 0.2s ease` (transforms + shadow + border-color + bg).
- Body theme switch: `transition: background-color 0.3s ease, color 0.3s ease`.
- Sidebar collapse: `transition: margin-left 0.2s ease` on main content. Sider has its own internal antd transition.
- Logo hover: `transition: all 0.2s ease` with `transform: scale(1.02)` and `opacity: 0.9`.

**Hard rules:**
- **No bouncy easings.** Always `ease` or `ease-in-out`.
- **No animation longer than 0.3s** outside of route transitions.
- **Never** animate `box-shadow` and `transform` separately — `all` covers both cleanly.
- Hover translateY is **always -2px**, never more.

---

## 7. Breakpoints & Responsive Rules

Antd breakpoints — **use these exactly**:

| Name | Min width | Device target            |
| ---- | --------- | ------------------------ |
| xs   | <576px    | Mobile portrait          |
| sm   | ≥576px    | Mobile landscape         |
| md   | ≥768px    | Tablet                   |
| lg   | ≥992px    | Laptop (priority)        |
| xl   | ≥1200px   | Desktop                  |
| xxl  | ≥1600px   | Ultrawide                |

**Derived flags (use a `useResponsive` hook):**
- `isMobile`: `< 768px`
- `isTablet`: `768–991px`
- `isLaptop`: `992–1199px`
- `isDesktop`: `1200–1599px`
- `isUltrawide`: `≥ 1600px`
- `isMobileOrTablet`: `< 992px`  ← sidebar becomes a Drawer below this.
- `isDesktopOrLarger`: `≥ 1200px` ← single-row filter bar above this.

### 7.1 `useResponsive` hook contract

Required outputs:

```ts
interface ResponsiveConfig {
  isMobile: boolean
  isTablet: boolean
  isLaptop: boolean
  isDesktop: boolean
  isUltrawide: boolean
  isMobileOrTablet: boolean
  isDesktopOrLarger: boolean

  contentPadding: number     // 24 / 20 / 16 / 12
  sectionGap:     number     // 24 / 20 / 16
  cardPadding:    number     // 24 / 20 / 16 / 12

  chartHeight:      number   // 400 / 300 / 250 / 200
  chartHeightSmall: number   // 350 / 280 / 220 / 180
  chartHeightLarge: number   // 450 / 350 / 280 / 220

  kpiMinWidth: number        // 240 / 220 / 200 / 180 / 160
  kpiGap:      number        // 16 / 12 / 10

  screens: ReturnType<typeof Grid.useBreakpoint>
}
```

Implementation (reference, drop in verbatim):

```ts
import { Grid } from 'antd'
const { useBreakpoint } = Grid

export function useResponsive(): ResponsiveConfig {
  const screens = useBreakpoint()

  const isMobile     = !screens.md
  const isTablet     = !!screens.md && !screens.lg
  const isLaptop     = !!screens.lg && !screens.xl
  const isDesktop    = !!screens.xl && !screens.xxl
  const isUltrawide  = !!screens.xxl
  const isMobileOrTablet  = !screens.lg
  const isDesktopOrLarger = !!screens.xl

  const contentPadding = screens.xl ? 24 : screens.lg ? 20 : screens.md ? 16 : 12
  const sectionGap     = screens.lg ? 24 : screens.md ? 20 : 16
  const cardPadding    = screens.xl ? 24 : screens.lg ? 20 : screens.md ? 16 : 12

  const chartHeight      = screens.xxl ? 400 : screens.lg ? 300 : screens.md ? 250 : 200
  const chartHeightSmall = screens.xxl ? 350 : screens.lg ? 280 : screens.md ? 220 : 180
  const chartHeightLarge = screens.xxl ? 450 : screens.lg ? 350 : screens.md ? 280 : 220

  const kpiMinWidth = screens.xxl ? 240 : screens.xl ? 220 : screens.lg ? 200 : screens.md ? 180 : 160
  const kpiGap      = screens.lg ? 16 : screens.md ? 12 : 10

  return { isMobile, isTablet, isLaptop, isDesktop, isUltrawide,
           isMobileOrTablet, isDesktopOrLarger,
           contentPadding, sectionGap, cardPadding,
           chartHeight, chartHeightSmall, chartHeightLarge,
           kpiMinWidth, kpiGap, screens }
}
```

### 7.2 Responsive scaling rules per element

- **Page title:** 28 → 24 → 22 → 20 → 18 (xxl→xl→lg→md→sm).
- **KPI value:** 30 → 28 → 26 → 24 → 22 → 20.
- **KPI card padding:** 16/18 → 14/16 → 12/14 → 10/12.
- **Chart container padding:** 24 → 20 → 16 → 12.
- **Data table container padding:** 24 → 20 → 16 → 12.
- **Page header bottom margin:** 24 → 16 (mobile).

### 7.3 Sidebar / drawer threshold

- ≥992px: fixed `Sider`, collapsible via button.
- <992px: replaced by an `Drawer` (left placement, 260px wide, header hidden).

### 7.4 Filter bar layout modes

- ≥1200px: single row, all controls inline, reset right-aligned via `marginLeft: 'auto'`.
- 768–1199px: two rows. Row 1 = date picker + actions. Row 2 = 3 selects in `Row gutter={[10,10]}` with `Col xs={8}`.
- <768px: fully stacked. Date full-width, country + partner half-width pair, direction + actions half-width pair.

---

## 8. App Layout — Shell, Sidebar, Header

### 8.1 The shell

Three layers, top to bottom:
1. **Fixed sidebar** (left, 220 / 72 / drawer 260).
2. **Sticky header** (64px, top: 0).
3. **Sticky filters bar** (under header at top: 64, optional per route).
4. **Scrolling content area** (max-width 1920px, centered).

```tsx
<Layout style={{ minHeight: '100vh', maxWidth: '100vw', overflow: 'hidden' }}>
  {!isMobileOrTablet && (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      width={220}
      collapsedWidth={72}
      breakpoint="lg"
      style={{
        overflow: 'hidden',
        height: '100vh',
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        zIndex: 100,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-container)',
      }}
    >
      {sidebarContent}
    </Sider>
  )}

  <Drawer
    placement="left"
    open={drawerOpen}
    onClose={() => setDrawerOpen(false)}
    width={260}
    styles={{
      body:   { padding: 0, background: 'var(--bg-container)', height: '100%' },
      header: { display: 'none' },
    }}
  >
    {sidebarContent}
  </Drawer>

  <Layout style={{
    marginLeft: isMobileOrTablet ? 0 : (collapsed ? 72 : 220),
    transition: 'margin-left 0.2s ease',
    minHeight: '100vh',
    maxWidth: isMobileOrTablet ? '100vw' : `calc(100vw - ${collapsed ? 72 : 220}px)`,
    display: 'flex',
    flexDirection: 'column',
  }}>
    <Header style={{
      padding: `0 ${contentPadding}px`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--bg-container)',
      height: 64, minHeight: 64, lineHeight: '64px',
    }}>
      {/* left: page title (16px / level 5) */}
      {/* right: ThemeToggle + user Dropdown(Avatar + username) */}
    </Header>

    {/* optional filters bar — sticky at top: 64 */}

    <Content style={{
      padding: contentPadding,
      flex: 1, overflow: 'auto',
      background: 'var(--bg-base)',
    }}>
      <div style={{ maxWidth: 1920, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </div>
    </Content>
  </Layout>
</Layout>
```

### 8.2 Sidebar internals

A **three-zone flex column**:

```
┌─────────────────────────────┐
│  Logo zone (64px, top)      │  <- borderBottom
├─────────────────────────────┤
│  Navigation menu (flex: 1)  │  <- scrolls internally
│  …                          │
├─────────────────────────────┤
│  Attribution zone (auto)    │  <- borderTop, "powered by …"
└─────────────────────────────┘
```

```css
.sidebar-container { display: flex; flex-direction: column; height: 100%; }
.sidebar-nav       { flex: 1; overflow-y: auto; overflow-x: hidden; }
.sidebar-footer    { margin-top: auto; flex-shrink: 0; padding: 16px 0; }
```

**Logo zone (64px tall, matches header):**
- Expanded: logo 40px tall, centered, click to collapse. Hover: `scale(1.02)`, opacity `0.9`.
- Collapsed: logo 32px tall, centered.
- Drawer mode: shows a small close button (×) at the right.
- Border-bottom: `1px solid var(--border)`.
- Background: `var(--bg-container)`.

**Navigation menu:**
- Antd `<Menu mode="inline" theme={dark ? 'dark' : 'light'}>`.
- `selectedKeys={[location.pathname]}` — keys are pathnames.
- `border: none`, `marginTop: 8`, `background: transparent`.
- Item height: **44px**.
- Item icon size: **18px** (collapsed icon also 18px).
- Margin block between items: 4px. Margin inline: 8px. Padding inline: 16px.
- Item color: `--text-secondary`. Hover: bg `--bg-hover`. Selected: bg `--accent-primary`, color `#FFFFFF` (or `--text-inverse`).
- Section divider supported: `{ type: 'divider' }`.

**Attribution zone:**
- `borderTop: 1px solid var(--border)`.
- Expanded: small "powered by" label (10px uppercase) + logo image 24px tall.
- Collapsed: 32×32 icon only, opacity 0.85.
- Dark mode: apply `filter: brightness(1.2)` to logo images here.

### 8.3 Header internals

**Left side:** page title only.
- Antd `<Title level={5}>` with custom `fontSize: 16` and color `--text-primary`.
- Title text resolved from `location.pathname` (no breadcrumbs — flat).

**Right side:** `<Space size="middle">` containing:
1. `ThemeToggle` (40×40 ghost button with bulb icon — see §22).
2. User dropdown — `<Dropdown trigger={['click']} placement="bottomRight">`:
   - Avatar (filled with `--accent-primary`, icon color `#000`).
   - Username text (14px, `--text-primary`) — hidden below `sm`.
   - Dropdown items: Settings, divider, Logout (danger).

### 8.4 Drawer mode (mobile/tablet)

- Hamburger lives where? **Nowhere visible.** The logo itself toggles the sidebar.
- In drawer mode, the user opens the drawer by tapping the MTN logo (or whatever logo) which is wrapped in a `role="button"` div. Inside drawer, a close × appears at the right of the logo row.
- Drawer auto-closes on route change.
- Below 992px, on first render: `setCollapsed(true)` and `setDrawerOpen(false)`.

### 8.5 Z-index ladder

| Layer            | z-index |
| ---------------- | ------- |
| Sidebar (Sider)  | 100     |
| Header           | 50      |
| Filters bar      | 40      |
| (Antd modal)     | 1000+   |

---

## 9. Page Header

The page header is **simple and quiet** — title, optional subtitle, optional extra (right-side action).

```tsx
function PageHeader({ title, subtitle, extra }: { title: string; subtitle?: string; extra?: ReactNode }) {
  return (
    <div className="page-header" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space direction="vertical" size={4}>
          <Title level={2} style={{ margin: 0, color: 'var(--text-primary)' }}>{title}</Title>
          {subtitle && <Text type="secondary" style={{ fontSize: 14 }}>{subtitle}</Text>}
        </Space>
        {extra && <div>{extra}</div>}
      </div>
    </div>
  )
}
```

Rules:
- `marginBottom: 24` (16 on mobile).
- Title = H2 (24–32px responsive). No icon. No background. No accent line.
- Subtitle = 14px secondary text, gap 4px under title.
- Extra slot is right-aligned and may contain a button or button group.

**When to omit:** pages with their own filters bar (e.g., the dashboard pages) sometimes skip the page header entirely — the layout's header title is enough.

---

## 10. Filters Bar

A **global, sticky, responsive** filter row. It's the personality of the dashboards.

### 10.1 Structure

Three layouts based on width — pick one branch per render:

**Desktop (≥1200px) — single row:**
```
[Filters icon] [Date range] [Country▼] [Partner▼] [Direction▼] ────── [⟳] [Reset]
```
- `display: flex; align-items: center; gap: 10; flex-wrap: nowrap;`
- Actions pushed right with `marginLeft: auto`.
- Label "Filters" with `<FilterOutlined>` (12px) prefix, 13px / 500 weight, `--text-secondary`.

**Tablet (768–1199px) — two rows:**
- Row 1: `[Filters] [Date range, max 280px]  …  [⟳] [Reset]`
- Row 2: 3 selects in `<Row gutter={[10,10]}><Col xs={8}>…`.

**Mobile (<768px) — stacked:**
- Date range: `<Col span={24}>`.
- Country + Partner: `<Col span={12}>` each.
- Direction + Actions: `<Col span={12}>` each. Actions full-width.

### 10.2 Controls

- **Date range:** Antd `RangePicker` with `format="YYYY-MM-DD"` (or `"MM-DD"` on mobile), `allowClear: false`, fixed width 240px (desktop) / 280 max (tablet) / 100% (mobile). Presets: Today, Yesterday, Last 7/14/30 Days, This Month, Last Month.
- **Country select:** width 130px, `showSearch`, `optionFilterProp="label"`, prepended with `{ value: 'all', label: 'All Countries' }`.
- **Partner select:** width 150px, same pattern.
- **Direction select:** width 120px. Options: `all` / `incoming` / `outgoing`.
- All selects use `size="middle"` (36px).
- All controls share `borderRadius: 8`.

### 10.3 Action buttons

- **Refresh** (`<ReloadOutlined />`): icon-only button wrapped in `<Tooltip title="Refresh data">`. On click: `queryClient.invalidateQueries()`.
- **Reset**: text button "Reset" wrapped in `<Tooltip title="Reset filters">`.
- Both `size="middle"`.

### 10.4 State management

- Filters live in **URL query params** via a custom `useFilters` hook (single source of truth).
- The hook exposes `filters`, `filterOptions`, `optionsLoading`, `setFilter`, `setDateRange`, `resetFilters`.
- Some pages may own their own filter state (`useRevenueFilters`, `useTrafficFilters`, etc.) — these mirror the same shape and never write to global state.

### 10.5 Wrapper (sticky placement)

When the filters bar sits in the layout (not owned by the page), it's wrapped in:

```tsx
<div style={{
  position: 'sticky',
  top: 64,                              // under header
  background: 'var(--bg-container)',
  borderBottom: '1px solid var(--border)',
  padding: '12px 16px',
  zIndex: 40,
}}>
  <FiltersBar />
</div>
```

---

## 11. KPI Cards

The KPI card is the most important component — most dashboards open with a row of 4–8 of them. **Get the proportions exactly right.**

### 11.1 Anatomy

```
┌─────────────────────────────────────┐
│ ┌──┐  TITLE (11px caps, tracked)    │
│ │◐ │  $12.4M                        │  <- 28px value
│ └──┘  ▲ 4.2% vs last period         │  <- trend
└─────────────────────────────────────┘
```

- **Icon chip:** 36×36, border-radius 8, background `--accent-primary-soft`, icon 18px in `--accent-primary`. Optional. Centered both axes.
- **Title:** 11px / 500 / uppercase / letter-spacing 0.8px / `--text-secondary`. `marginBottom: 6`.
- **Value:** 28px / 700 / `line-height: 1.2` / `--text-primary` / `font-variant-numeric: tabular-nums`. `marginBottom: 6` when trend present.
- **Suffix (e.g., "%"):** 16px / 500 / `--text-secondary`, `marginLeft: 4`.
- **Trend:** `<ArrowUp/DownOutlined />` + percent (11px / 600 in success/danger token) + caption "vs last period" (10px / `--text-muted`).

### 11.2 Container styling

```ts
{
  background: 'var(--bg-elevated)',
  border:     '1px solid var(--border)',
  borderRadius: 10,
  transition: 'all 0.2s ease',
  padding:    '16px 18px',  // body padding override
  height:     '100%',
}
```

**Hover state (use mouse handlers, not CSS — for parameterized accents):**
```ts
onMouseEnter: () => {
  transform: 'translateY(-2px)',
  boxShadow: '0 6px 20px rgba(<accent-rgb>, 0.15)',
  borderColor: 'var(--accent-primary)',  // or accentType-mapped
  background: 'var(--bg-hover)',
}
onMouseLeave: () => reset to rest.
```

### 11.3 AccentType variants

KPI cards accept an `accentType: 'primary' | 'secondary' | 'info' | 'success'` prop. The icon chip and hover border use the corresponding token:

```ts
const accentMap = {
  primary:   { bg: 'var(--accent-primary-soft)',   fg: 'var(--accent-primary)'   },
  secondary: { bg: 'var(--accent-secondary-soft)', fg: 'var(--accent-secondary)' },
  info:      { bg: 'rgba(56,232,255,0.12)',         fg: 'var(--status-info)'      },
  success:   { bg: 'rgba(78,217,100,0.12)',         fg: 'var(--status-success)'   },
}
```

### 11.4 Grid

KPI cards live in a CSS grid with `auto-fit, minmax(kpiMinWidth, 1fr)`:

```tsx
<div style={{
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fit, minmax(${adjustedMinWidth}px, 1fr))`,
  gap: kpiGap,
}}>
  <KpiCard ... />
  ...
</div>
```

- `kpiMinWidth`: 240/220/200/180/160 across xxl/xl/lg/md/sm.
- When sidebar is expanded on lg, subtract 30 from minWidth (floor 180) to prevent wrapping.
- `kpiGap`: 16/12/10 across lg/md/sm.

### 11.5 Loading state

Use Antd `<Card loading>` — it renders skeleton bars in the same shape. Don't roll a custom skeleton.

### 11.6 Reference component (drop-in)

```tsx
import { Card, Typography } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
const { Text } = Typography

interface KpiCardProps {
  title: string
  value: number | string
  prefix?: string
  suffix?: string
  precision?: number
  trend?: number
  trendLabel?: string
  loading?: boolean
  icon?: ReactNode
  accentType?: 'primary' | 'secondary' | 'info' | 'success'
}

export function KpiCard({
  title, value, prefix, suffix, precision = 0,
  trend, trendLabel = 'vs last period',
  loading = false, icon, accentType = 'primary',
}: KpiCardProps) {
  const isUp = trend !== undefined && trend >= 0
  const accent = ACCENTS[accentType]

  return (
    <Card
      loading={loading}
      style={{
        height: '100%',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        transition: 'all 0.2s ease',
      }}
      styles={{ body: { padding: '16px 18px' } }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,203,5,0.15)'
        e.currentTarget.style.borderColor = accent.fg
        e.currentTarget.style.background = 'var(--bg-hover)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--bg-elevated)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: accent.bg, color: accent.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>{icon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text style={{
            fontSize: 11, fontWeight: 500,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.8px',
            display: 'block', marginBottom: 6,
          }}>{title}</Text>

          <div style={{
            fontSize: 28, fontWeight: 700, lineHeight: 1.2,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            marginBottom: trend !== undefined ? 6 : 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {prefix}
            {typeof value === 'number' ? value.toFixed(precision).toLocaleString() : value}
            {suffix && (
              <span style={{ fontSize: 16, fontWeight: 500, marginLeft: 4, color: 'var(--text-secondary)' }}>
                {suffix}
              </span>
            )}
          </div>

          {trend !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text style={{
                color: isUp ? 'var(--status-success)' : 'var(--status-danger)',
                fontSize: 11, fontWeight: 600,
              }}>
                {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(trend).toFixed(1)}%
              </Text>
              <Text style={{ fontSize: 10, color: 'var(--text-muted)' }}>{trendLabel}</Text>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
```

---

## 12. Charts

### 12.1 Library & wrapper

Every chart is **ECharts** via `echarts-for-react`, wrapped in `<ChartWrapper>` which:
- Renders an Antd `<Card>` with title (16px / 600).
- Merges the centralized theme (`getEChartsTheme(mode)`) with chart-specific options.
- Handles loading (`<Spin size="large" />`) and empty (`<Empty />`) states inside a fixed-height area.
- Default height: 350px (responsive via `useResponsive.chartHeight`).

```tsx
<Card
  title={title}
  style={{
    background: 'var(--elevated)',
    borderRadius: 12,
    border: '1px solid var(--border-subtle)',
    transition: 'all 0.2s ease',
  }}
  styles={{
    header: {
      borderBottom: '1px solid var(--border-subtle)',
      color: 'var(--text-primary)',
      fontSize: 16, fontWeight: 600,
    },
    body: { padding: loading || empty ? 24 : 16 },
  }}
>
  {loading ? <Spin size="large" /> : empty ? <Empty description={emptyText} /> :
    <ReactECharts option={themed} style={{ height }} opts={{ renderer: 'canvas' }} />
  }
</Card>
```

### 12.2 Chart color palette

Highly distinguishable, accent-first sequence. **First color is always the brand accent.**

```ts
const chartColors = {
  light: [
    '#FFCB05',  // accent-primary
    '#F97316',  // orange
    '#10B981',  // green
    '#8B5CF6',  // purple
    '#EF4444',  // red
    '#06B6D4',  // cyan
    '#8B5CF6',  // purple (alt)
    '#EC4899',  // pink
  ],
  dark: [
    '#FFD633',  // accent-primary (bright)
    '#FB923C',
    '#34D399',
    '#A78BFA',
    '#F87171',
    '#22D3EE',
    '#A78BFA',
    '#F472B6',
  ],
}
```

### 12.3 Centralized ECharts theme rules

- `backgroundColor: 'transparent'` — never paint the chart's own background.
- `textStyle.color: tokens.textSecondary` — chart text defaults to secondary.
- `title.textStyle: { color: tokens.textPrimary, fontWeight: 600 }`.
- **Line series:** `lineStyle.width: 2`, `symbolSize: 6`, `symbol: 'circle'`, `smooth: true`. On mobile, drop `showSymbol: false`.
- **Bar series:** `barBorderWidth: 0`.
- **Pie series:** `borderWidth: 0`.
- **Category axis:** axis line shown, ticks hidden, split lines hidden.
- **Value axis:** axis line hidden, ticks hidden, split lines shown in `tokens.divider`.
- **Tooltip:** `backgroundColor: rgba(18,12,61,0.95)` (dark) or `rgba(255,255,255,0.95)` (light), border `tokens.borderSubtle`, `borderWidth: 1`.
- **DataZoom:** handle color = accent, filler color = `${accent}33` (20% alpha).
- **Legend:** text color = `tokens.textSecondary`.

### 12.4 Area gradients (hero series only)

For the leading line series ("Revenue", "Total Traffic", etc.), apply a soft area gradient from `${color}4D` (30% alpha) at top to `${color}00` at bottom. Other series have **no area fill** — just the line.

```ts
areaStyle: {
  color: {
    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: `${colors[0]}4D` },
      { offset: 1, color: `${colors[0]}00` },
    ],
  },
}
```

### 12.5 Mobile adjustments per chart

- `axisLabel.fontSize`: 10 (mobile) / 12 (else).
- `xAxis.axisLabel.rotate`: 45 (mobile) / 0 (else).
- `legend.itemWidth`: 12 (mobile) / 20 (else).
- `legend.itemGap`: 8 (mobile) / 16 (else).
- `grid.top`: `'15%'` (mobile) / `'12%'` (else).
- `lineStyle.width`: 2 (mobile, even on hero) / 3 (else, hero only).
- `showSymbol`: false (mobile) / true (else).

### 12.6 Tooltip formatter pattern

```ts
formatter: (params) => {
  const items = params as { seriesName: string; value: number; axisValue: string }[]
  if (!items.length) return ''
  let html = `<div style="padding:8px"><div style="font-weight:bold;margin-bottom:8px">${items[0].axisValue}</div>`
  items.forEach(item => {
    const color = /* map seriesName -> color */
    html += `<div style="display:flex;justify-content:space-between;gap:16px">
      <span style="color:${color}">${item.seriesName}:</span>
      <span style="font-weight:bold">${formatValue(item.value)}</span>
    </div>`
  })
  return html + '</div>'
}
```

---

## 13. Lists & Top-N Tables

These are the "Top Countries / Top Partners" style cards: **a Card titled with an icon, containing a small Table** (size="small", pagination=false, scoped sort).

### 13.1 Pattern

```tsx
<Card
  title={
    <span>
      <GlobalOutlined style={{ marginRight: 8, color: 'var(--accent-primary)' }} />
      Top Countries by Revenue
    </span>
  }
  loading={loading}
  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
  styles={{
    header: { borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
    body:   { padding: 0 },  // table fills body edge-to-edge
  }}
>
  <Table
    columns={columns}
    dataSource={data?.data || []}
    rowKey="name"
    size="small"
    pagination={false}
    style={{ background: 'var(--bg-elevated)' }}
  />
</Card>
```

### 13.2 Column patterns

- **Name column:** `<Text strong style={{ color: 'var(--text-primary)' }}>{name}</Text>`. Left-aligned.
- **Numeric (revenue/count):** `align: 'right'`, sortable, default sort `descend`. Color: `--status-success` if a positive financial metric, else `--text-primary`. Font weight 500.
- **Share column:** Antd `<Progress>` inline, width 150, size="small", `format={() => '${percent}%'}`, `strokeColor: 'var(--accent-primary)'`, `trailColor: 'var(--border)'`.
- **Duration / time:** right-aligned, `${value.toFixed(1)}s` format.
- **Total row count caption** is not shown (these are top-N, count is implicit).

### 13.3 Layout

Two top-N cards live in a `<Row gutter={[16,16]}>` with `<Col xs={24} xl={12}>` each. Below xl they stack.

---

## 14. Full Data Tables

For deep data exploration. Heavier than top-N lists.

### 14.1 Container

```tsx
<Card title={title}
  style={{
    background: 'var(--bg-elevated)',
    borderRadius: 12,
    border: '1px solid var(--border)',
  }}
  styles={{
    header: { borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' },
    body:   { padding: 0 },
  }}
>
  <Table
    dataSource={data}
    columns={columns}
    loading={loading}
    pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `Total ${t} records` }}
    scroll={{ x: 'max-content' }}
    size="middle"
  />
</Card>
```

### 14.2 Antd Table theme tokens

```ts
Table: {
  colorBgContainer: 'var(--bg-elevated)',
  headerBg:         'var(--bg-hover)',
  headerColor:      'var(--text-primary)',
  rowHoverBg:       'var(--bg-hover)',
  borderColor:      'var(--border)',
  headerBorderRadius: 8,
  cellPaddingBlock:  12,
  cellPaddingInline: 16,
}
```

### 14.3 Rules

- Default `size="middle"`. Use `size="small"` only inside Top-N lists.
- `scroll={{ x: 'max-content' }}` for horizontal overflow. Add `y` scroll only if the design specifies a fixed-height container.
- Pagination: default `pageSize: 10`, show size changer, show total. Place pagination inside the card.
- Sortable columns get `sorter` and a `defaultSortOrder` where meaningful.
- Numeric columns: `align: 'right'`.
- Status/category columns: render as a `<Tag color="…">` (see §19).
- Error rows: apply class `upload-error-row` — the CSS tints the row red.

```css
.upload-error-row td {
  background: rgba(220, 38, 38, 0.08) !important;
  border-bottom-color: rgba(220, 38, 38, 0.25) !important;
}
html[data-theme="dark"] .upload-error-row td {
  background: rgba(255, 138, 138, 0.08) !important;
  border-bottom-color: rgba(255, 138, 138, 0.20) !important;
}
```

### 14.4 Wrapping a table without a Card

If you want to dress a bare table:

```css
.data-table-container {
  background: var(--bg-elevated);
  border-radius: 12px;
  padding: 24px;
  border: 1px solid var(--border);
  overflow-x: auto;
}
```

---

## 15. Buttons

### 15.1 Antd token overrides

```ts
Button: {
  borderRadius:     8,
  controlHeight:    36,
  controlHeightLG:  40,
  controlHeightSM:  32,
  paddingInline:    16,
  paddingInlineLG:  20,
  paddingInlineSM:  12,
  fontWeight:       500,
  primaryShadow:    '0 2px 8px rgba(<accent-primary-rgb>, 0.15)',
}
```

### 15.2 Variants

- **`type="primary"`** — solid `--accent-primary` background, **`color: #000`** on the worked yellow palette (because yellow needs dark text for contrast). For darker accent colors (blue/purple), use `color: #FFFFFF`. Always check contrast ratio ≥ 4.5:1.
- **`type="default"`** — `--surface` background, `--border-subtle` border, `--text-primary` text. Hover: `--accent-primary` border.
- **`type="text"`** — no background. Hover: `--bg-hover` background.
- **`type="link"`** — `--accent-primary` text, no underline at rest.
- **`danger`** — overrides primary/default to use `--status-danger`.

### 15.3 Sizes & shapes

- Default = 36px height. Use this for filters bar, modal footers, page actions.
- `size="large"` = 40px. Use only for hero CTAs (Login submit, file upload primary action).
- `size="small"` = 32px. Use inside dense rows or list cells.
- `shape="circle"` = round icon-only button. Used for the (?) help button.
- Icon-only buttons set `icon` prop, no children. They wrap in `<Tooltip>`.

### 15.4 Long-action buttons (upload, export)

Long-purpose primary actions get `style={{ minWidth: 200 }}` to keep label legible and avoid awkward shrink.

### 15.5 Loading state

`loading` prop swaps the leading icon for a spinner. Don't show extra text changes.

---

## 16. Form Inputs, Selects, Date Pickers

### 16.1 Common tokens

```ts
Input:      { borderRadius: 8, controlHeight: 36, paddingInline: 12 },
Select:     { borderRadius: 8, controlHeight: 36 },
DatePicker: { borderRadius: 8, controlHeight: 36 },
```

### 16.2 Input field rules

- Default size = 36px. Use `size="large"` (40px) inside auth/login forms (more touch-friendly hero).
- Always include `prefix` icon when contextually obvious (`<UserOutlined />`, `<LockOutlined />`, `<SearchOutlined />`, `<MailOutlined />`). Icon color: `rgba(255,255,255,0.45)` on dark forms, `--text-muted` on light.
- Placeholder: short, sentence-case ("Username", not "Enter your username here").

### 16.3 Select rules

- `showSearch` whenever the option list could exceed 8 items.
- `optionFilterProp="label"` (always — labels are what users see).
- Always provide an "All …" option as the first entry when filtering by attribute (`{ value: 'all', label: 'All Countries' }`).
- Loading state: `loading={optionsLoading}` while async-fetched option lists load.
- Width is fixed on desktop layouts, `100%` on mobile/tablet.
- `placeholder` is set even when a value is bound, as a fallback.

### 16.4 DatePicker / RangePicker

- `format="YYYY-MM-DD"` everywhere except mobile (use `"MM-DD"`).
- `allowClear={false}` for filter bars — clearing breaks data fetches.
- **Always provide presets** for RangePicker (Today, Yesterday, Last 7/14/30 Days, This Month, Last Month).
- `dayjs` only — never pass native Date.

### 16.5 Form composition

- Antd `<Form size="large">` for login/auth.
- Antd `<Form size="middle">` (default) for in-page edit forms.
- Validation messages: short, sentence-case, no trailing period if the field is required ("Please enter your username").

---

## 17. Modals, Drawers, Confirmation Patterns

### 17.1 Modal tokens

```ts
Modal: {
  colorBgElevated: 'var(--bg-elevated)',
  borderRadiusLG:  12,
}
```

### 17.2 Standard modal styles (apply to every modal)

```ts
const themedModalStyles = {
  content: { background: 'var(--bg-elevated)', border: '1px solid var(--border)' },
  header:  { background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' },
  body:    { background: 'var(--bg-elevated)', color: 'var(--text-primary)' },
  footer:  { background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' },
  mask:    { background: 'rgba(0, 0, 0, 0.55)' },
} as const
```

Pass via `<Modal styles={themedModalStyles}>`. This single object replaces what would otherwise be five separate prop sets.

### 17.3 Modal widths

- **Confirmation**: 520px.
- **Standard form / instructions**: 560–600px.
- **Preview / multi-step / data review**: 860px.
- Never wider than 960px. Use a Drawer if you need more.

### 17.4 Title bar

Always icon + text in a `<Space>`:

```tsx
<Modal
  title={
    <Space>
      <CloudUploadOutlined style={{ color: 'var(--accent-primary)' }} />
      <span style={{ color: 'var(--text-primary)' }}>Upload Rates — {partner}</span>
    </Space>
  }
  ...
/>
```

Title icon color is **the semantic match** for the action:
- `--accent-primary` for primary actions (upload, confirm).
- `--status-warning` for caution (invalid input).
- `--status-danger` for destructive.
- `--accent-primary` for informational ✱.

### 17.5 Footer

A right-aligned `<Space>` of buttons:
- Cancel (default type) on left.
- Primary action on right (`type="primary"`).
- Destructive actions get `danger` instead.

### 17.6 Multi-step modals

Use Antd `<Steps size="small">` at the top of the body, `style={{ marginBottom: 24 }}`. Always 3 steps: "Select … → Preview … → Done".

### 17.7 Confirmation pattern (Confirm-before-action)

For irreversible actions, the primary modal opens a **second, smaller confirmation modal**. Layout of the confirmation body:

```tsx
<div style={{
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 16,
  color: 'var(--text-primary)',
}}>
  <p>You are about to upload <Text strong style={{ color: 'var(--accent-primary)' }}>{rowCount} rows</Text> …</p>
  <ul style={{ paddingLeft: 18, listStyle: 'disc' }}>
    <li><Text style={{ color: 'var(--status-success)' }}>{n}</Text> new zones will be inserted</li>
    <li><Text style={{ color: 'var(--text-secondary)' }}>{n}</Text> existing zones will be skipped</li>
    <li><Text style={{ color: 'var(--status-warning)' }}>{n}</Text> existing rates will be updated</li>
  </ul>
  <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
    This action can be rolled back from the upload history.
  </Text>
</div>
```

### 17.8 Error & rejection modals

When a file or input is rejected:

```tsx
<div style={{
  background: 'rgba(220, 38, 38, 0.10)',
  border: '2px solid var(--status-danger)',
  borderRadius: 10,
  padding: '16px 20px',
  display: 'flex', alignItems: 'center', gap: 12,
  marginBottom: 16,
}}>
  <StopOutlined style={{ fontSize: 28, color: 'var(--status-danger)' }} />
  <div>
    <Text style={{ color: 'var(--status-danger)', fontSize: 17, fontWeight: 700, display: 'block' }}>
      File Not Uploaded — Wrong Data
    </Text>
    <Text style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
      {n} rows have issues. Fix the highlighted rows and re-upload.
    </Text>
  </div>
</div>
```

For two-column compare ("Wrong example" / "Correct example"):

```tsx
<div style={{ padding: 12, borderRadius: 8,
              background: 'rgba(220,38,38,0.14)',
              border: '1px solid var(--status-danger)' }}>
  <Text style={{ color: 'var(--status-danger)', fontWeight: 600 }}>Wrong file name</Text>
  <Text code>RandomName.xlsx</Text>
</div>
<div style={{ padding: 12, borderRadius: 8,
              background: 'rgba(66,181,46,0.14)',
              border: '1px solid var(--status-success)' }}>
  <Text style={{ color: 'var(--status-success)', fontWeight: 600 }}>Correct example</Text>
  <Text code>partner_outgoing_may2026.xlsx</Text>
</div>
```

### 17.9 Drawer

Used **only** for: mobile/tablet sidebar, full-page detail edits.
```ts
Drawer: { colorBgElevated: 'var(--bg-container)' }
```
- Width 260px when used as nav drawer; 480–600px for content drawers.

---

## 18. Upload / File Pickers

### 18.1 Drag-and-drop dragger

```tsx
<Upload.Dragger
  name="file"
  accept=".xlsx,.xls"
  showUploadList={false}
  beforeUpload={(f) => { handleFileChange(f); return false }}  // never auto-upload
  style={{ padding: '24px 0' }}
>
  <p className="ant-upload-drag-icon"><InboxOutlined /></p>
  <p className="ant-upload-text">Click or drag an Excel file here</p>
  <p className="ant-upload-hint">Required columns: code, destination, vsdate, rate, pulse</p>
</Upload.Dragger>
```

Rules:
- Always `beforeUpload={() => false}` to take control of the lifecycle.
- Three lines: icon, action ("Click or drag …"), hint with required schema/format.
- Dragger gets `padding: '24px 0'` to give it presence.

### 18.2 File validation cycle

`select → previewing → preview | rejected → uploading → done`.

- `previewing` and `uploading` render a centered `<Spin size="large" />` with `marginTop: 16` secondary text.
- `done` renders a centered "Upload complete!" then auto-closes after 1500ms.

### 18.3 Preview meta

Use Antd `<Descriptions size="small" bordered column={2}>` to show parsed counts (rows, new zones, existing zones, new rates, updates).

### 18.4 Template downloads

Provide a **Download Template** button next to the upload action. The template is a styled XLSX (bold header, thin black borders, light-grey fill `F2F2F2`, explicit column widths). Implementation uses `xlsx-js-style`.

---

## 19. Tags, Badges, Progress Bars

### 19.1 Tags

```ts
Tag: { borderRadiusSM: 4 }
```

Antd built-in color names map to semantic meanings — use them consistently:
- `color="gold"` (or your accent-primary) — neutral count / informational.
- `color="green"` — success / positive count.
- `color="red"` — alerts / errors.
- `color="orange"` — warnings.
- `color="blue"` — info.

Tags appear in **card extras** (`<Card extra={<Tag …>}>`) and inline in table cells. Always sentence-case content ("3 insights" not "3 INSIGHTS").

### 19.2 Progress (inline within tables)

```tsx
<Progress
  percent={percent}
  size="small"
  format={() => `${percent.toFixed(1)}%`}
  strokeColor="var(--accent-primary)"
  trailColor="var(--border)"
/>
```

For full-row progress bars, use `size="default"`.

### 19.3 Borderless callout pills

For inline insights (numbered tips, market leaders), use a **left-border accent block** pattern:

```tsx
<div style={{
  padding: '8px 12px',
  marginBottom: 8,
  background: 'var(--bg-container)',
  borderRadius: 6,
  borderLeft: '3px solid var(--accent-primary)',
}}>
  <Text style={{ color: 'var(--text-primary)' }}>
    <span style={{ color: 'var(--accent-primary)', marginRight: 8 }}>{index + 1}.</span>
    {text}
  </Text>
</div>
```

Border-left color switches by intent: accent for info, success for positive, warning/danger for alerts.

### 19.4 Statistic

For inline Antd `<Statistic>` use:
```ts
Statistic: { contentFontSize: 28, titleFontSize: 14 }
```

---

## 20. Empty / Loading / Error States

### 20.1 Empty

Use Antd `<Empty>` with `image={Empty.PRESENTED_IMAGE_SIMPLE}` (the small inline outline drawing — never the big illustration).

```tsx
<Empty
  description="No traffic insights available"
  image={Empty.PRESENTED_IMAGE_SIMPLE}
/>
```

Wrapped in a Card or a centered div with padding 48px (mobile: 24px).

### 20.2 Loading

- **Card-scope:** `<Card loading={isLoading}>` — antd renders skeleton bars in shape.
- **Block-scope:** `<Skeleton active paragraph={{ rows: 4 }} />` for body-only loads.
- **Full-block:** `<div style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>`.
- **Chart-scope:** `<Spin size="large" />` in a centered flex container at the chart's height.

### 20.3 Errors

- Form-level errors: Antd `<Alert message type="error" showIcon closable>`.
- Field-level errors: Antd form validation (red text under input).
- Toast (transient feedback): `message.success | warning | error | info` from antd. Keep messages to one short sentence.

### 20.4 Success affirmation block

When an action succeeds and you want a green confirmation panel (not just a toast):

```tsx
<div style={{
  padding: 20,
  textAlign: 'center',
  background: 'rgba(82, 196, 26, 0.1)',
  borderRadius: 6,
}}>
  <Text style={{ color: 'var(--status-success)' }}>
    ✓ No alerts — All metrics within normal thresholds
  </Text>
</div>
```

---

## 21. Login / Auth Pages

A **centered Card** on the canvas background. Single column. No marketing, no graphics.

```tsx
<div style={{
  minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-base)',
  padding: 20,
}}>
  <Card style={{
    width: '100%', maxWidth: 420,
    background: 'var(--bg-container)',
    borderColor: 'var(--border)',
  }}>
    {/* Logo block */}
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <img src={logo} style={{ height: 60, marginBottom: 16 }} />
      <Title level={3} style={{ margin: 0 }}>{AppName}</Title>
    </div>

    {/* Error alert (conditional) */}
    {error && <Alert message="Login Failed" description={error} type="error" showIcon closable
                     onClose={() => setError(null)} style={{ marginBottom: 24 }} />}

    {/* Form */}
    <Form size="large" onFinish={handleSubmit}>
      <Form.Item name="username" rules={[{ required: true, message: 'Please enter your username' }]}>
        <Input prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />} placeholder="Username" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
        <Input.Password prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />} placeholder="Password" />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" loading={loading} block style={{
          background: 'var(--accent-primary)',
          borderColor: 'var(--accent-primary)',
          color: '#000',          // <- adjust per contrast
          fontWeight: 600,
        }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </Form.Item>
    </Form>

    {/* Footer */}
    <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
      <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{Brand} © {year}</Text>
    </div>
  </Card>
</div>
```

Rules:
- Card max-width: **420px**.
- Logo: 60px tall, 16px bottom margin, app name as H3 below.
- Form `size="large"` — 40px controls, more breathing room than in-app forms.
- Submit button is `block` (full-width) with the accent background.
- Footer is small, separated by a top border, with copyright in muted text.

---

## 22. Theme Toggle (Light/Dark)

A 40×40 `type="text"` button in the header. Wrap in `<Tooltip>` indicating the **target** mode.

```tsx
<Tooltip title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
  <Button
    type="text"
    icon={theme === 'dark' ? <BulbOutlined /> : <BulbFilled />}
    onClick={toggleTheme}
    style={{
      fontSize: 18,
      width: 40, height: 40,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  />
</Tooltip>
```

Rules:
- Bulb outline in dark mode (showing what you'd switch to), filled in light mode.
- The toggle sits in the header's right-side `<Space size="middle">` next to the user dropdown.
- Toggling flips `data-theme` on `<html>` AND swaps Antd's `ConfigProvider.algorithm` between `theme.darkAlgorithm` and `theme.defaultAlgorithm`.
- Persist user choice in `localStorage` (key `theme`, values `light`/`dark`).
- Default = system preference via `matchMedia('(prefers-color-scheme: dark)')`.

---

## 23. Scrollbars

Custom thin scrollbars in both themes. WebKit only — no special handling needed for Firefox.

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track  { background: var(--scrollbar-track); }
::-webkit-scrollbar-thumb  { background: var(--scrollbar-thumb); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
```

Variables emitted per theme:
- Light: track `#F4F6FA`, thumb `#CBD5E1`, thumb hover `#94A3B8`.
- Dark:  track `#2E2E2E`, thumb `#4A4A4A`, thumb hover `#5A5A5A`.

Global rule on `<html>`: `overflow-x: hidden; scroll-behavior: smooth;` — never accept a horizontal scroll on the root.

---

## 24. Iconography

- **Library:** `@ant-design/icons` exclusively. No emoji icons, no Heroicons, no SVG one-offs.
- **Default variant:** Outline (`*Outlined`). Use Filled (`*Filled`) only for the active state of the theme toggle and selected sidebar items.
- **Sizes:**
  - Menu / sidebar icon: 18px.
  - KPI icon chip glyph: 18px (chip is 36×36).
  - Card title prefix icon: 14–16px, with `marginRight: 8`.
  - Filter label icon (`<FilterOutlined>`): 12px.
  - Form input prefix icon: inherits input size.
  - Theme toggle: 18px.
- **Color:** Icons in card titles are colored by intent:
  - `--accent-primary` — neutral / informational / primary.
  - `--status-success` — success cards.
  - `--status-warning` — warnings.
  - `--status-danger` — alerts.

Common icons & their meanings (use these consistently):

| Icon                       | Use                          |
| -------------------------- | ---------------------------- |
| `DashboardOutlined`        | Traffic dashboard            |
| `DollarOutlined`           | Revenue / financial          |
| `LineChartOutlined`        | Insights / analytics         |
| `FileTextOutlined`         | Reports                      |
| `FilePdfOutlined`          | PDF / billing                |
| `PercentageOutlined`       | Rates / margins              |
| `TeamOutlined`             | Users / admin                |
| `UserOutlined`             | Single user / profile        |
| `SettingOutlined`          | Settings                     |
| `LogoutOutlined`           | Logout (always with `danger`)|
| `BulbOutlined / Filled`    | Theme toggle                 |
| `ReloadOutlined`           | Refresh data                 |
| `FilterOutlined`           | Filter label                 |
| `CloudUploadOutlined`      | Upload action                |
| `CloudDownloadOutlined`    | Download from cloud          |
| `DownloadOutlined`         | Local download / template    |
| `InboxOutlined`            | Drag-drop zone               |
| `QuestionCircleOutlined`   | Help                         |
| `ExclamationCircleOutlined`| Confirmation / warning       |
| `StopOutlined`             | Reject / hard error          |
| `ArrowUp/DownOutlined`     | Trend deltas                 |
| `RiseOutlined / FallOutlined` | Positive / negative metric|
| `TrophyOutlined`           | Leader / winner              |
| `WarningOutlined`          | Alerts                       |
| `GlobalOutlined`           | Country / geo                |
| `PhoneOutlined`            | Telephony / traffic          |
| `ClockCircleOutlined`      | Time / duration              |
| `CalculatorOutlined`       | Computed metric              |

---

## 25. Composition Recipes (Page Layouts)

### 25.1 Standard analytics page

```
PageHeader (optional — many pages use the layout header)
FiltersBar (sticky if global; inline if page-owned)
KPI grid (CSS auto-fit, 4–8 cards)
Trends chart (full-width, height ≈ 300–400px)
Top-N row (2 cards side-by-side at xl, stack below)
[optional] Data table (full-width card with paginated table)
```

Each section is separated by `gap: 24px` (responsive 20/16 below xl/md). Use a flex column:

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
  <FiltersBar />
  <KpiGrid />
  <TrendsChart />
  <Row gutter={[16,16]}>
    <Col xs={24} xl={12}><TopList1 /></Col>
    <Col xs={24} xl={12}><TopList2 /></Col>
  </Row>
</div>
```

### 25.2 Upload / data-management page

```
Section card 1: Upload (partner selector, upload buttons, download template, help)
Section card 2: History (full data table — paginated, sortable)
```

Each section is a top-level `<Card title>` with `Title level={5}` inside. `marginBottom: 24` between sections.

### 25.3 Insights / mixed-card page

```
PageHeader
FiltersBar
2×2 grid of Cards (Traffic Insights, Revenue Insights, Market Leaders, Alerts)
  Each Card: title with intent-colored icon, optional Tag in extra, body = list of callout pills.
[optional] Trends chart below.
```

Use `<Row gutter={[16,16]}>` with `<Col xs={24} lg={12}>` for the 2-column quadrant.

### 25.4 Users / admin / settings page

```
PageHeader
[optional] Action row (Create User button — right aligned)
Full data table (sortable, paginated, with row actions)
```

Row-level actions go in the rightmost column as small icon buttons or a `<Dropdown>`.

---

## 26. Pitfalls & Anti-Patterns

These are easy ways to lose the "calm" feel — avoid them:

1. **Do not use bright body backgrounds.** The canvas is `#F4F6FA` (light) or `#202020` (dark) — never white, never black, never branded.
2. **Do not stack two accent colors.** Yellow + teal works because they're on different roles (primary/secondary). Don't add a third "accent purple" — pick a chart palette instead.
3. **Do not use gradients on cards or buttons.** Gradients are reserved for hero header banners (rarely used).
4. **Do not animate beyond `transform: translateY(-2px)` and `box-shadow`.** No rotations, no scale > 1.02, no slide-ins on hover.
5. **Do not use Google Fonts.** System stack only — it's part of the identity.
6. **Do not use yellow as a warning color** in a brand that uses yellow as the primary accent. Use orange (`#F97316`) for warnings.
7. **Do not pad cards inconsistently.** 24/20/16/12 per breakpoint, body padding override of `16px 18px` for KPI cards specifically.
8. **Do not nest cards inside cards.** If you need grouping inside a card, use the left-border callout pill pattern.
9. **Do not use Antd `<Statistic>` for KPI values directly.** Wrap it in the KpiCard pattern — bare Statistic loses the title + trend composition.
10. **Do not put modals wider than 960px.** Switch to a Drawer for wider content.
11. **Do not introduce a third radius scale.** 8 / 10 / 12 with 4 and 6 for small chips. That's the entire scale.
12. **Do not use horizontal scroll on the body.** `overflow-x: hidden` on `<html>` and `<body>` is non-negotiable.
13. **Do not hardcode hex values in components.** Every color must come from a CSS variable.
14. **Do not skip the tabular-nums on numeric KPI values.** They will visibly wobble when data updates if you forget.
15. **Do not use Antd's full-bg `<Spin>` overlay** for inline loading. Use the card's `loading` prop or a scoped `<Spin>` inside a fixed-height div.
16. **Do not let the sidebar logo collapse without changing height.** 40px expanded, 32px collapsed — both centered.
17. **Do not hide attribution.** The "powered by …" block at the sidebar bottom is part of the identity; do not omit even when re-skinning.
18. **Do not center text in tables.** Left-align names, right-align numbers. Period.
19. **Do not use modal masks lighter than `rgba(0,0,0,0.55)`.** The contrast against the elevated content matters.
20. **Do not show large illustrations for empty states.** `Empty.PRESENTED_IMAGE_SIMPLE` only.

---

## 27. Brand-Neutral Palette Swap Guide

To re-skin this style for a different brand, **change only the accent and brand-anchor values**. The semantic tokens, sizes, spacing, radii, and behaviors stay identical.

### 27.1 Pick four hex values

1. `accentPrimary` — your **brand signal color**. The single loudest color in the app. Pick something that's recognizable in a 24×24 chip on white AND on `#2E2E2E`.
2. `accentPrimarySoft` — a very pale tint of the primary for light mode (e.g., 8–12% of full saturation), and a **dark opaque tint** for dark mode (don't use alpha — use a real near-black with a hue lean).
3. `accentSecondary` — a connectivity / supporting color, distinguishable from `accentPrimary` at small sizes. Test together at icon chip size.
4. `accentSecondarySoft` — same as primary-soft logic.

Optional: tune `textPrimary` to lean into the brand (e.g., navy for finance, deep purple for telecom). Don't go below `#1C1C1C` lightness or above `#3A3A3A` for readability.

### 27.2 Swap recipe

```ts
// 1. Replace these in lightTokens:
accentPrimary:        '#YOURPRIMARY',
accentPrimarySoft:    '#PALEYOURPRIMARY',
accentSecondary:      '#YOURSECONDARY',
accentSecondarySoft:  '#PALEYOURSECONDARY',
// Optional, only if it improves brand fit:
textPrimary:          '#YOURDEEPBRAND',

// 2. Replace these in darkTokens (brighten primary ~+15%, secondary ~+15%):
accentPrimary:        '#BRIGHTERYOURPRIMARY',
accentPrimarySoft:    '#DARKTINTEDYOURPRIMARY',
accentSecondary:      '#BRIGHTERYOURSECONDARY',
accentSecondarySoft:  '#DARKTINTEDYOURSECONDARY',

// 3. Update the chart palette first slot (chart series #1):
chartColors.light[0] = '#YOURPRIMARY'
chartColors.dark[0]  = '#BRIGHTERYOURPRIMARY'

// 4. Update shadow tints (replace 10,0,70 with your textPrimary RGB):
boxShadow['calm-md'] = '0 4px 6px -1px rgba(R,G,B,0.12), 0 2px 4px -1px rgba(R,G,B,0.08)'
// ... and the calm-accent shadow's rgb() to match accentPrimary.

// 5. Update primary button text color:
// If accent is light/yellow/lime: color: '#000' (button text dark)
// If accent is dark/blue/red/purple: color: '#FFFFFF'

// 6. Update brand contrast in primaryShadow:
Button.primaryShadow: '0 2px 8px rgba(YOURPRIMARYRGB, 0.15)'
```

### 27.3 Worked alternative palettes (drop-in)

**Cobalt (telecom / finance):**
```
light: { accentPrimary: '#2563EB', accentPrimarySoft: '#E7EEFE',
         accentSecondary: '#06B6D4', accentSecondarySoft: '#E2FBFF' }
dark:  { accentPrimary: '#60A5FA', accentPrimarySoft: '#0E2447',
         accentSecondary: '#22D3EE', accentSecondarySoft: '#0A2E36' }
button primary color: '#FFFFFF'
```

**Crimson (retail / consumer):**
```
light: { accentPrimary: '#DC2626', accentPrimarySoft: '#FEE7E7',
         accentSecondary: '#F59E0B', accentSecondarySoft: '#FEF4E2' }
dark:  { accentPrimary: '#F87171', accentPrimarySoft: '#2A1010',
         accentSecondary: '#FBBF24', accentSecondarySoft: '#2A2010' }
button primary color: '#FFFFFF'
warning color must move away from amber → use '#0EA5E9' for info if needed.
```

**Forest (sustainability / health):**
```
light: { accentPrimary: '#059669', accentPrimarySoft: '#DCFCE7',
         accentSecondary: '#0EA5E9', accentSecondarySoft: '#E0F2FE' }
dark:  { accentPrimary: '#34D399', accentPrimarySoft: '#0F2E20',
         accentSecondary: '#38BDF8', accentSecondarySoft: '#0E2336' }
button primary color: '#FFFFFF'
```

**Aubergine (luxury / B2B SaaS):**
```
light: { accentPrimary: '#7C3AED', accentPrimarySoft: '#EDE9FE',
         accentSecondary: '#EC4899', accentSecondarySoft: '#FCE7F3' }
dark:  { accentPrimary: '#A78BFA', accentPrimarySoft: '#2A1A4A',
         accentSecondary: '#F472B6', accentSecondarySoft: '#3A1A2A' }
button primary color: '#FFFFFF'
```

In every alternate palette: **the calm style remains identical** — only the brand voice changes.

---

## Appendix A — Antd Theme Object (Drop-In)

```ts
import { theme } from 'antd'
import type { ThemeConfig } from 'antd'

export const baseTokens = {
  fontSize: 14,
  fontSizeHeading1: 32, fontSizeHeading2: 24, fontSizeHeading3: 20,
  fontSizeHeading4: 18, fontSizeHeading5: 16,
  fontSizeLG: 16, fontSizeSM: 12, fontSizeXL: 20,
  lineHeight: 1.5714,
  lineHeightHeading1: 1.25, lineHeightHeading2: 1.33,
  lineHeightHeading3: 1.4,  lineHeightHeading4: 1.5,
  lineHeightHeading5: 1.5,
  borderRadius: 8, borderRadiusLG: 12, borderRadiusSM: 6, borderRadiusXS: 4,
  padding: 16, paddingLG: 24, paddingSM: 12, paddingXS: 8, paddingXXS: 4,
  margin:  16, marginLG:  24, marginSM:  12, marginXS:  8, marginXXS:  4,
  controlHeight: 32, controlHeightLG: 40, controlHeightSM: 24,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  motionDurationFast: '0.1s', motionDurationMid: '0.2s', motionDurationSlow: '0.3s',
}

export const baseComponents = {
  Layout: { siderBg: 'var(--shell)', headerBg: 'var(--shell)', bodyBg: 'var(--canvas)',
            headerPadding: '0 24px', headerHeight: 64 },
  Menu:   { itemSelectedColor: '#FFFFFF', itemHeight: 44, itemMarginBlock: 4,
            itemMarginInline: 8, itemPaddingInline: 16, iconSize: 18, collapsedIconSize: 18 },
  Card:   { paddingLG: 24, borderRadiusLG: 12, headerFontSize: 16, headerFontSizeSM: 14 },
  Table:  { headerBorderRadius: 8, cellPaddingBlock: 12, cellPaddingInline: 16 },
  Button: { borderRadius: 8, controlHeight: 36, controlHeightLG: 40, controlHeightSM: 32,
            paddingInline: 16, paddingInlineLG: 20, paddingInlineSM: 12, fontWeight: 500 },
  Input:      { borderRadius: 8, controlHeight: 36, paddingInline: 12 },
  Select:     { borderRadius: 8, controlHeight: 36 },
  DatePicker: { borderRadius: 8, controlHeight: 36 },
  Modal:      { borderRadiusLG: 12 },
  Tooltip:    { borderRadius: 6, paddingXS: 8, paddingSM: 12 },
  Tag:        { borderRadiusSM: 4 },
  Statistic:  { contentFontSize: 28, titleFontSize: 14 },
  Segmented:  { borderRadius: 8, borderRadiusSM: 6 },
}

export const lightTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: { ...baseTokens },
  components: baseComponents,
}

export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: { ...baseTokens },
  components: baseComponents,
}
```

---

## Appendix B — Global CSS (Drop-In)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* { margin: 0; padding: 0; box-sizing: border-box; }

html { overflow-x: hidden; scroll-behavior: smooth; }
html, body, #root { height: 100%; width: 100%; max-width: 100vw; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: 14px;
  line-height: 1.5714;
  overflow-x: hidden;
  background-color: var(--canvas);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

::-webkit-scrollbar          { width: 8px; height: 8px; }
::-webkit-scrollbar-track    { background: var(--scrollbar-track); }
::-webkit-scrollbar-thumb    { background: var(--scrollbar-thumb); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }

.ant-card { border: 1px solid var(--border-subtle); background: var(--surface);
            transition: border-color 0.3s ease, background-color 0.3s ease; }
.ant-card:hover { border-color: var(--accent-primary); }
.ant-select-dropdown { max-width: calc(100vw - 24px); }

.kpi-card {
  background: var(--elevated); border: 1px solid var(--border-subtle);
  border-radius: 10px; padding: 16px 18px;
  transition: all 0.2s ease; height: 100%;
}
.kpi-card:hover {
  border-color: var(--accent-primary);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 203, 5, 0.15);   /* swap to your accent rgb */
  background: var(--hover);
}
.kpi-value {
  font-size: 28px; font-weight: 700; color: var(--text-primary);
  margin-bottom: 4px; line-height: 1.2; font-variant-numeric: tabular-nums;
}
.kpi-label {
  font-size: 11px; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.8px; font-weight: 500;
}
.kpi-trend { font-size: 11px; margin-top: 6px; }
.kpi-trend.positive { color: var(--status-success); }
.kpi-trend.negative { color: var(--status-danger); }

.chart-container {
  background: var(--elevated); border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 24px;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}
.chart-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 16px; }

.page-header   { margin-bottom: 24px; }
.page-title    { font-size: 28px; font-weight: 700; color: var(--text-primary);
                 margin-bottom: 8px; line-height: 1.3; }
.page-subtitle { font-size: 14px; color: var(--text-secondary); }

.data-table-container {
  background: var(--elevated); border: 1px solid var(--border-subtle);
  border-radius: 12px; padding: 24px; overflow-x: auto;
}

.empty-state    { text-align: center; padding: 48px; color: var(--text-secondary); }
.loading-container { display: flex; justify-content: center; align-items: center; min-height: 200px; }

/* Sidebar */
.sidebar-container { display: flex; flex-direction: column; height: 100%; }
.sidebar-nav       { flex: 1; overflow-y: auto; overflow-x: hidden; }
.sidebar-footer    { margin-top: auto; flex-shrink: 0; padding: 16px; }

/* Utility */
.text-ellipsis  { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.section-spacing { margin-bottom: 24px; }

@media (max-width: 991px)  { .section-spacing { margin-bottom: 20px; } }
@media (max-width: 767px)  { .section-spacing { margin-bottom: 16px; } }

/* Responsive scaling — typography & padding */
@media (min-width: 1600px) { .kpi-value { font-size: 30px; } .page-title { font-size: 32px; } }
@media (min-width: 1200px) and (max-width: 1599px) {
  .kpi-value { font-size: 28px; } .page-title { font-size: 28px; }
}
@media (min-width: 992px) and (max-width: 1199px) {
  .kpi-value { font-size: 26px; } .page-title { font-size: 26px; }
  .kpi-card { padding: 14px 16px; }
  .chart-container, .data-table-container { padding: 20px; }
}
@media (min-width: 768px) and (max-width: 991px) {
  .kpi-value { font-size: 24px; } .page-title { font-size: 24px; }
  .kpi-card { padding: 12px 14px; }
  .chart-container, .data-table-container { padding: 16px; }
}
@media (max-width: 767px) {
  .kpi-value { font-size: 22px; } .page-title { font-size: 20px; }
  .page-subtitle { font-size: 13px; }
  .kpi-card { padding: 12px 14px; border-radius: 8px; }
  .kpi-label { font-size: 10px; }
  .chart-container, .data-table-container { padding: 12px; border-radius: 8px; }
  .page-header { margin-bottom: 16px; }
  .empty-state { padding: 24px; }
}
@media (max-width: 575px) {
  .kpi-value { font-size: 20px; } .page-title { font-size: 18px; }
  .kpi-card  { padding: 10px 12px; }
}
```

---

## Appendix C — Quick Reference Cheat Sheet

| What                    | Value                                       |
| ----------------------- | ------------------------------------------- |
| Base font               | 14px                                        |
| Line-height             | 1.5714                                      |
| Font family             | System stack (Apple → Win → Linux fallback) |
| Page title (H2)         | 24px / 700 desktop, scales down per BP      |
| KPI value               | 28px / 700 / tabular-nums                   |
| KPI label               | 11px / 500 / uppercase / 0.8px tracking     |
| Card radius             | 12px (10px for KPI card)                    |
| Button / input radius   | 8px                                         |
| Button height           | 36px (40 large, 32 small)                   |
| Input / Select height   | 36px                                        |
| Sidebar expanded width  | 220px                                       |
| Sidebar collapsed width | 72px                                        |
| Mobile drawer width     | 260px                                       |
| Header height           | 64px                                        |
| Menu item height        | 44px                                        |
| Card padding (lg)       | 24px → 20 → 16 → 12 (xl/lg/md/sm)           |
| KPI card body padding   | 16px 18px (override)                        |
| Section gap (lg)        | 24px → 20 → 16                              |
| Content max width       | 1920px                                      |
| Drawer/Sidebar break    | < 992px (lg)                                |
| Filter bar single-row   | ≥ 1200px (xl)                               |
| Hover lift              | translateY(-2px), accent border, soft shadow|
| Card hover shadow       | `0 6px 20px rgba(<accent>, 0.15)`           |
| Theme transition        | 0.3s ease (bg + color only)                 |
| Card transition         | 0.2s ease (all)                             |
| Modal mask              | `rgba(0,0,0,0.55)`                          |
| Scrollbar               | 8px, var-driven track + thumb               |
| Z-index ladder          | sidebar 100 / header 50 / filters 40 / modal 1000+|
| Tabular nums            | mandatory on every KPI value                |
| Yellow                  | reserved for accent — warnings use orange   |

---

*End of Calm Style spec. Pair this document with a concrete brand palette (see §27) and the Antd + Tailwind setup in Appendices A & B, and you have everything needed to rebuild this look on any project.*
