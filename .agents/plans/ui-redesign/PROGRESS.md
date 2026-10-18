# UI Redesign Progress Log (Folha Óptica)

## Phase 0: Baseline & Safety Net
- **Date**: 2026-10-18
- **Base Commit**: 86be5a41a2f601aaa12841893526e0b3e70de88b
- **Branch**: `feat/ui-redesign`
- **Initial Test Suite**: 38 files / 251 tests passed
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Desktop Target Build**: `VITE_TARGET=desktop npx vite build` succeeded
- **Web Build Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 238.5 kB
  - First-load CSS (gzip): 18.1 kB
  - Total JS (gzip): 348.5 kB
  - Total CSS (gzip): 18.1 kB
  - UI Webfonts (woff2 raw): 0.0 kB

### Phase 0 Verification Answers:
1. **(a) Navigation on 375 px viewport:**
   Confirmed duplicated. `StepTabs` is rendered in `App.tsx` on `exam_step` routes without responsive hiding, while `MobileTabBar` (`md:hidden`) is fixed at the bottom. Adding `hidden md:block` to `StepTabs` will resolve duplicate navigation.
2. **(b) Correct-answer selector control in QuestionEditor:**
   Button-based (`button[type="button"]` toggling `isCorrect` with `CheckCircle2` / `Circle`). It will be styled with `Bubble` retaining button semantics with `aria-pressed`.
3. **(c) PhotoUploader states:**
   Exposes `isProcessing` (reading), `scanTarget` (`'qr' | 'sheet'`), `errorMessage`, `successMessage`, `debugResult`. Drag-and-drop state will be added cleanly to support dropzone interaction.

### Gate P0:
- Baseline verified and recorded.

## Phase 1: Foundation (Tokens, Fonts, Tailwind, Motion Runtime)
- **Date**: 2026-10-18
- **Commit SHA**: cf22bd0
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Test Suite**: 41 files / 264 tests passed (all green)
- **New Tests Added**:
  - `tests/ui-tokens.test.ts` (4 tests)
  - `tests/ui-accent-contrast.test.ts` (5 tests)
  - `tests/ui-motion-css.test.ts` (4 tests)
- **Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 248.9 kB (budget: <= baseline + 15 kB = 253.5 kB) - PASSED
  - First-load CSS (gzip): 19.5 kB (budget: <= 22 kB) - PASSED
  - Total JS (gzip): 388.0 kB
  - Total CSS (gzip): 19.5 kB
  - UI Webfonts (woff2 raw): 107.3 kB (budget: <= 110 kB) - PASSED
- **Desktop Target Build**: clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Documentation Check**: clean (`npm run docs:check` exit 0)
- **Dead-class fixes**:
  - `MobileTabBar`: `h-13` -> `h-[52px]`
  - `StepTabs`, `PhotoUploader`, `GradebookTable`: `py-0.2` -> `py-0.5`
- **Gate P1**: GREEN

## Phase 2: UI Primitives (`src/components/ui/`)
- **Date**: 2026-10-18
- **Commit SHA**: b4ef159
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Test Suite**: 42 files / 271 tests passed (all green)
- **New Tests Added**:
  - `tests/ui-primitives.test.tsx` (7 tests covering SSR, accessibility, modal closure, count-up, segmented roving focus)
- **Primitives Created**:
  - `cn.ts`, `Button.tsx`, `IconButton.tsx`, `Surface.tsx`, `Badge.tsx`, `Field.tsx` (with Input, Textarea, Select), `Segmented.tsx`, `Modal.tsx`, `Popover.tsx`, `toastStore.ts`, `Toast.tsx`, `confirmStore.ts`, `ConfirmHost.tsx`, `Alert.tsx`, `Bubble.tsx`, `BubbleLoader.tsx`, `CountUp.tsx`, `ScoreRing.tsx`, `ProgressBar.tsx`, `Skeleton.tsx`, `EmptyState.tsx`, `ScreenSkeleton.tsx`, `lazyWithRetry.ts`
  - Hooks: `useRetained.ts`, `useScrolled.ts`, `useCountUp.ts`
- **Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 248.9 kB (budget: <= baseline + 30 kB = 268.5 kB) - PASSED
  - First-load CSS (gzip): 20.6 kB (budget: <= 24 kB) - PASSED
  - Total JS (gzip): 388.0 kB
  - Total CSS (gzip): 20.6 kB
  - UI Webfonts (woff2 raw): 107.3 kB
- **Gate P2**: GREEN

## Phase 3: App Shell & Navigation
- **Date**: 2026-10-18
- **Commit SHA**: 0a51bc0
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Test Suite**: 42 files / 271 tests passed (all green)
- **Features Implemented**:
  - Unified sticky chrome (`chrome-surface`, `useScrolled(4)`, `--chrome-h` published via ResizeObserver)
  - `AppHeader`: Folha Óptica brand mark, wordmark in `font-display`, sliding `m.span layoutId="header-nav-pill"`, animated autosave checkmark
  - `ContextBar`: One-line chips with `Popover` accessible listbox menus
  - `StepTabs`: Step markers as `Bubble`s, sliding `layoutId="step-pill"`, `hidden md:block` responsive hiding (duplicate mobile navigation eliminated)
  - `MobileTabBar`: `h-[52px]` + safe area inset, 2px sliding accent bar `layoutId="tab-pill"`, retained `min-h-[44px]`
  - `ProfileMenu`: Converted dropdown to `Popover` and About dialog to `Modal`
  - `ThemeSelector` & `ThemeToggle`: 220ms icon cross-fade / sliding pill while preserving radiogroup contracts
  - Boot screen: `BubbleLoader` with exact text `Carregando avaliações e perfil...`
  - `UpdatePrompt`: Restyled as toast-like card with `AnimatePresence` and `Button`s
  - Exam-switch prompt in `App.tsx`: Converted to `Modal` with `useRetained`
  - Route direction: `data-nav-dir` directional enter-x transitions on `<main>`
  - Mounted `<ToastHost />` and `<ConfirmHost />`
- **Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 270.2 kB
  - First-load CSS (gzip): 20.6 kB
  - Total JS (gzip): 407.9 kB
  - Total CSS (gzip): 20.6 kB
  - UI Webfonts (woff2 raw): 107.3 kB
- **Desktop Target Build**: clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Gate P3**: GREEN

---

### Phase 4: Library Screen (ExamsScreen)
- **Commit SHA**: 6cff213 (feature), 980f6ad (gate green)
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Test Suite**: 43 files / 273 tests passed (all green)
- **Features Implemented**:
  - `ExamsScreen` title in `font-display text-headline font-bold text-slate-900`
  - Header actions: `Nova Prova` (`Button` primary), `Importar Perfil` (`Button` secondary), `Modelo Matemática` (`Button` ghost)
  - Search field with clear button (`X`), search count using `tabular-nums` and `aria-live="polite"`
  - Exam cards using `Surface` (`rounded-card`, hover border/shadow without lift)
  - Active exam visual cues: `rail={isActive}` (3px accent left edge) and `Prova Ativa` badge
  - Meta row: question count, notes graded with signature `Bubble` check indicator, edit date
  - Row actions (rename, duplicate, export ZIP, delete) as `IconButton`s: accessible touch hit areas (`coarse:` / below `md` always visible; hover/focus-within on fine desktop)
  - Card entry stagger (≤ 320ms) on session first mount only via module-level flag `hasMountedExamsScreen`; `AnimatePresence mode="popLayout"` with `layout="position"` for filtering
  - Inline rename: 140ms cross-fade between title and text input with Enter/Escape handling
  - Empty states: `EmptyState` with `BubbleGridIllustration` and action cards for zero exams; search empty state with clear button
  - Delete confirmation dialog: converted inline overlay to `Modal size="sm"` with `useRetained`
  - Added `tests/ui-exams-screen.test.tsx` verifying SSR rendering, empty/populated states, active rail, and accessibility
- **Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 271.5 kB
  - First-load CSS (gzip): 20.7 kB
  - Total JS (gzip): 409.2 kB
  - Total CSS (gzip): 20.7 kB
  - UI Webfonts (woff2 raw): 107.3 kB
- **Desktop Target Build**: clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Docs Check**: clean (`npm run docs:check` exit 0)
- **Gate P4**: GREEN

---

### Phase 5: Editor Screen & Components
- **Commit SHA**: 6396547 (feature), cec2f16 (gate green)
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Test Suite**: 44 files / 277 tests passed (all green)
- **Features Implemented**:
  - `EditorScreen`: added `screen-enter`, `EmptyState` with `BubbleGridIllustration` and action buttons when question count is zero
  - `QuestionList`: sticky summary toolbar (`top-[var(--chrome-h,96px)] z-20 chrome-surface`) with objective/subjective counts in `tabular-nums`, total points via `CountUp`, and `ProgressBar` for limit (neutral → amber at ≥ 36 → rose at 40)
  - `QuestionList`: `Alert` components for limit reached and approaching limit warnings
  - `QuestionList`: list animation with `m.div layout="position"` with `layoutDependency={orderKey}` and `AnimatePresence initial={false}`; 600ms accent ring flash and nearest scroll on reorder
  - `QuestionEditor`: number badge circle, objective/subjective segmented switch, points input with `tabular-nums`
  - `QuestionEditor`: correct-answer selector restyled as Folha Óptica `Bubble` with `aria-pressed` and filled states
  - `QuestionEditor`: move-up, move-down, duplicate, delete action `IconButton`s with 44px coarse hit targets
  - `ExamHeaderEditor`: grouped `Surface` layout, password regeneration prompt converted to `Modal size="sm"`
  - `ImageUploader`: dropzone states for idle, drag-over (accent dashed border, scale 1.01), and upload preview; removed raw hex colors
  - `ImportQuestionsModal`: converted to `Modal size="xl"` with selectable question rows, `Badge` count indicator, and `Button`s
  - Added `tests/ui-editor-screen.test.tsx` verifying SSR rendering, sticky toolbar, CountUp, ProgressBar, Bubble selector, and header controls
- **Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 272.4 kB
  - First-load CSS (gzip): 20.7 kB
  - Total JS (gzip): 410.1 kB
  - Total CSS (gzip): 20.7 kB
  - UI Webfonts (woff2 raw): 107.3 kB
- **Desktop Target Build**: clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Docs Check**: clean (`npm run docs:check` exit 0, 0 bold label warnings)
- **Gate P5**: GREEN

---

### Phase 6: Versions & Print Screens
- **Commit SHA**: 1c1575f (feature), 7dbd4ae (gate green)
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Test Suite**: 45 files / 279 tests passed (all green)
- **Features Implemented**:
  - `VersionsScreen`: grouped `Surface` layout, `Segmented` control for version selection with count badges, `Bubble` answer-key matrix cells, `Badge` "Protegido por Senha", directional enter animations
  - `PrintScreen`: grouped `Surface` sidebar layout, `Segmented` print-mode selector (standard vs per-student), `Button` primary for print action, inline disabled reason hints
  - `PrintScreen`: sheet-count warning using `Alert`, `.desk-surface` class applied to `.print-area-wrapper` maintaining all child layouts and `.a4-page-separator` untouched
  - Added `tests/ui-versions-print.test.tsx` verifying SSR rendering, Segmented controls, Bubble answer-key grid, and desk-surface styling
- **Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 272.8 kB
  - First-load CSS (gzip): 20.7 kB
  - Total JS (gzip): 410.5 kB
  - Total CSS (gzip): 20.7 kB
  - UI Webfonts (woff2 raw): 107.3 kB
- **Desktop Target Build**: clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Docs Check**: clean (`npm run docs:check` exit 0, 0 bold label warnings)
- **Gate P6**: GREEN

---

### Phase 7: Scanner / Corrigir (Hero Flow)
- **Commit SHA**: cc463c4 (feature), 2713e37 (gate green)
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Test Suite**: 46 files / 286 tests passed (all green)
- **Features Implemented**:
  - `ScannerScreen`: unified "Sessão de Correção" `Surface` panel with context chips (exam, class, version lock), `Segmented` mode toggle (Individual vs Em Lote), phone-camera `animate-pulse-ring` chip, quiet desktop promo card at bottom for web users; preserved exact docs bold labels ("Sessão de Correção · Corretor Óptico em 2 Passos", "Baixar GabariTeX Desktop (GitHub Releases)")
  - `GradingModal`: converted to `Modal size="xl"` with sticky header/footer, `ScoreRing` + `CountUp` on Nota Final (700ms), 12ms bubble stagger (<= 480ms), `Segmented` filter for doubt review, animated `Alert` for duplicate record conflict, zoom modal via `Modal size="xl"`
  - `PhotoUploader`: preserved `hidden-qr-reader` id and refs, dropzone states (idle, drag-over scale 1.01, reading with `animate-scan-sweep` line), `Alert` banners, `Modal size="xl"` for debug zoom
  - `BatchGrader`: `ProgressBar` + `CountUp` summary header, `m.ul` and `m.li layout="position"` queue items, `Bubble` and `BubbleLoader` status indicators, `Modal` for confirmation, `IconButton` actions
  - `AnswerChoiceGroup`: bubble options with radiogroup semantics, touch-accessible hit targets, Branco & Rasura buttons
  - `SubjectiveScoreInput`: clean typography, template literals for SSR consistency, `tabular-nums`
  - `StudentPicker`: `Segmented` toggle between list search and manual entry, clean input styles
  - `PasswordModal` & `RemoteCameraPanel`: converted to `Modal` dialogs
  - `ErrorBoundary`: restyled with `rounded-card`, `Button`s, preserved class structure with `{ hasError, error, errorInfo, copied }`, `fallbackTitle`, and `error.message`
  - Added `tests/ui-scanner.test.tsx` verifying SSR rendering, Sessão de Correção panel, and modal integrity
- **Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 270.4 kB
  - First-load CSS (gzip): 20.1 kB
  - Total JS (gzip): 408.1 kB
  - Total CSS (gzip): 20.1 kB
  - UI Webfonts (woff2 raw): 107.3 kB
- **Desktop Target Build**: clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Docs Check**: clean (`npm run docs:check` exit 0, 0 bold label warnings)
- **Gate P7**: GREEN

---

### Phase 8: Gradebook & Classes
- **Commit SHA**: c456cb1 (feature), 964c3cb (gate green)
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Test Suite**: 47 files / 291 tests passed (all green)
- **Features Implemented**:
  - `GradebookTable`: animated stats cards with `ScoreRing` and `CountUp` on class average and hit-rate; item-analysis bars using `ProgressBar` with 600ms `scaleX` transitions; sticky header (`top-[var(--chrome-h,96px)]`), `Segmented` view toggle (Notas vs Análise por Questão), sortable columns with 140ms rotating indicator, sticky first column on horizontal scroll below `md`, row hover `bg-indigo-50`, row add/remove animation with `AnimatePresence initial={false}`; modals converted to `Modal` (size="md" for missing students, size="lg" for regrade confirmation); `toast.success` notifications for CSV export and slip generation
  - `ClassroomManager`: defensive `asScreen` mode without modals or portaling; modal mode and its 2 inner overlays (deleting class confirmation and mass import) converted to `Modal`; student rows animate add/remove with `AnimatePresence`; import and registration flows preserved
  - `GradebookScreen` & `ClassesScreen`: added `screen-enter` animation wrapper
  - Added `tests/ui-gradebook-classes.test.tsx` verifying SSR rendering, stats cards, sort headers, and classroom resilience
- **Bundle Metrics** (`measure-bundle.mjs dist`):
  - First-load JS (gzip): 270.7 kB
  - First-load CSS (gzip): 20.1 kB
  - Total JS (gzip): 408.4 kB
  - Total CSS (gzip): 20.1 kB
  - UI Webfonts (woff2 raw): 107.3 kB
- **Desktop Target Build**: clean (`VITE_TARGET=desktop npm run build` exit 0)
- **Docs Check**: clean (`npm run docs:check` exit 0, 0 bold label warnings)
- **Gate P8**: GREEN

