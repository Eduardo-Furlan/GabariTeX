# Question Bank Progress Log

## Phase 0: Baseline & Recon
- **Date**: 2026-10-20
- **Base Commit**: 8f634271b7675d449b2ce47d47b6248b1098ccfc
- **Branch**: `feat/question-bank`
- **TypeScript Check**: clean (`npx tsc --noEmit` exit 0)
- **Unit Test Suite**: 50 files / 300 tests passed (all green)
- **Web Build**: clean (`npm run build` exit 0)
- **Desktop Target Build**: clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Documentation Check**: clean (`npm run docs:check` exit 0, 26 screenshots verified)
- **Rust Unit Tests**: clean (`cargo test --manifest-path src-tauri/Cargo.toml` exit 0, 19 tests passed)
- **Bundle Metrics** (`.agents/plans/ui-redesign/measure-bundle.mjs dist` on web build):
  - First-load JS (gzip): 300.7 kB
  - First-load CSS (gzip): 20.2 kB
  - Total JS (gzip): 410.7 kB
  - Total CSS (gzip): 20.2 kB
  - UI Webfonts (woff2 raw): 107.3 kB

### Phase 0 Verification Answers:
1. **(a) IndexedDB test harness:**
   `tests/profileStore.test.ts` instantiates `IndexedDbProfileStore`, but in the Node/Vitest test environment, `typeof indexedDB === 'undefined'`. `IndexedDbProfileStore.isSupported()` returns `false`, causing it to delegate all operations to an internal in-memory fallback store (`MemoryProfileStore`). Thus, real IndexedDB behavior and database schema upgrades are currently untested in the automated test suite. Phase 3 step 2 will add `fake-indexeddb` as an exact-pinned `devDependency` to test real IndexedDB v1 -> v2 upgrades.
2. **(b) QuestionEditor composability & question validation:**
   - Composable UI in `src/components/editor/QuestionEditor.tsx`: LaTeX prompt textarea with formula insertion shortcuts and `MathView` preview; `ImageUploader` (imageUrl, imageCaption); question type toggle (`objective` vs `subjective`); objective alternative list with `Bubble` for correct answer selection, text input with live `MathView` rendering, add/remove option buttons; subjective `linesForAnswer` input; points input.
   - Question validation currently happens inline in `QuestionEditor` handlers (clamping options between 2 and 5, defaulting to 4 options with option A correct when switching to objective, ensuring exactly one option is marked correct when deleting options, defaulting subjective lines to 8 clamped 3..30). For the bank, validation rules will be centralized in pure domain module `src/utils/bank/questions.ts`.
3. **(c) Handling of unknown routes by `examSync`:**
   In `src/router/examSync.ts`, `decideRouteSync` explicitly checks if `route.type === 'exam_step'` (handling exam selection or redirecting to exams if the exam does not exist), or `route.type === 'scanner'` (returns `noop` and clears `lastSyncedExamId`). For all other routes (`exams`, `classes`, and future routes `bank` and `bank_generate`), line 48 falls through to return `{ action: { type: 'noop' }, nextLastSyncedExamId: null }`. Thus, unknown routes are ignored by `examSync` and do not cause unwanted redirects or state mutations.
4. **(d) 5th item fit at 375 px in MobileTabBar:**
   Yes. `MobileTabBar` currently already renders 5 items in a `grid-cols-5` layout (`Criar`, `Versões`, `Imprimir`, `Corrigir`, `Notas`) within a `52px` tall bar, where each item occupies 75 px at 375 px viewport width with small 10px text and 16px icons. For the top-level areas (Provas, Turmas, Banco), desktop uses `AppHeader` nav pills, while mobile accesses top-level sections via the hamburger dropdown in `AppHeader`.
5. **(e) Snapshot data collection:**
   In `src/platform/snapshots.ts`, `triggerDesktopSnapshot` receives a `ProfileData` object, serializes it by calling `buildProfileZip(profileData)` (which packages `profile.json` and externalized `assets/`), and sends the resulting ZIP binary buffer to the Tauri backend via `invoke('snapshot_write', zipBytes, ...)`. Adding `bank` to `ProfileData` and updating `buildProfileZip` automatically ensures desktop snapshots contain the question bank.
6. **(f) Exact name and behavior of new-exam creation:**
   Name: `createExam(title?: string): Promise<Exam>` in `src/context/ProfileContext.tsx`.
   Behavior: Generates a new UUID using `crypto.randomUUID()`, creates an 8-character password via `generateExamPassword(8)`, clones `emptyExam` with `id: newId`, `password: newPass`, `header.examTitle: title ?? 'Nova Prova'`, and `updatedAt: new Date().toISOString()`. Persists to `store.putExam(newExam)`, prepends to the `exams` meta list, registers the password in `allExamPasswords`, sets `activeExamId` in settings and saves settings to store, updates `exam` state, sets `teacherPassword`, resets `activePayload`, and returns the newly created `Exam`.
7. **(g) ToastStore action buttons:**
   No. `ToastItem` in `src/components/ui/toastStore.ts` only supports `id`, `type`, `message`, `title`, and `duration`. There is no callback or action button support. Therefore, per PLAN.md §6.2, bulk deletion or dangerous actions will use modal confirmation via `confirmStore`.
8. **(h) Screen code-splitting with `lazyWithRetry` in `App.tsx`:**
   No. Currently, `App.tsx` imports all screens via static imports. The utility `lazyWithRetry` exists in `src/components/ui/lazyWithRetry.ts` but is not yet used for screens. Bank and generator screens will be lazily loaded via `lazyWithRetry` to respect the +10 kB gzip budget for first-load bundle.
9. **(i) Points validation rules in QuestionEditor:**
   In `QuestionEditor.tsx`, points are input via `<input type="number" step="0.1" min="0" ... />` parsed with `parseFloat(e.target.value) || 0`. Points cannot be negative, and decimals are allowed in steps of 0.1. Per PLAN.md §4.3, points in the bank and rules must be positive with up to 2 decimal places.
10. **(j) Local Rust test execution:**
    Yes. Running `cargo test --manifest-path src-tauri/Cargo.toml` passed with 19 passed, 0 failed.

### Gate P0:
- Baseline verified and recorded. GREEN.
- Decision on plans/progress tracking: User selected to keep `.agents/` gitignored and maintain `PROGRESS.md` purely on disk without creating git commits for plan logs.

## Phase 1: Foundations (Types and PRNG)
- **Date**: 2026-10-20
- **Commits**:
  - `49ce264`: `refactor(bank): extract mulberry32 and shuffle into utils/prng`
  - `cbabcad`: `feat(bank): add bank and blueprint types`
  - `839a10d`: `test(bank): fingerprint ignores sourceQuestionId`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 51 files / 305 tests passed (delta: +1 file, +5 tests)
- **Builds**: web clean (`npm run build` exit 0)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 300.7 kB
  - First-load CSS (gzip): 20.2 kB
  - Total JS (gzip): 410.7 kB
  - Total CSS (gzip): 20.2 kB
- **Gate P1**: GREEN

## Phase 2: Pure Domain Logic in `src/utils/bank/`
- **Date**: 2026-10-20
- **Commits**:
  - `a95a590`: `feat(bank): add id and name validation helpers`
  - `9bd9198`: `feat(bank): add group tree management logic`
  - `f456435`: `feat(bank): add tag management and merge operations`
  - `19d005d`: `feat(bank): add question conversion, validation, and filtering`
  - `5677a45`: `feat(bank): add question usage and exam exclusion indexing`
  - `3c9919c`: `feat(bank): add blueprint normalization and validation logic`
  - `c159d85`: `fix(bank): clean up unused imports and export question types`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 57 files / 369 tests passed (delta: +6 files, +64 tests across bank domain test modules)
- **Builds**: web clean (`npm run build` exit 0)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 300.7 kB (0.0 kB delta vs baseline)
  - First-load CSS (gzip): 20.2 kB (0.0 kB delta vs baseline)
  - Total JS (gzip): 410.7 kB
  - Total CSS (gzip): 20.2 kB
- **Gate P2**: GREEN

## Phase 3: Persistence and Provider
- **Date**: 2026-10-20
- **Commits**:
  - `ea9f314`: `feat(bank-store): extend ProfileStore with bank operations`
  - `6ded1d4`: `feat(bank-store): add indexeddb v2 stores for question bank`
  - `589f164`: `feat(tauri): allow bank-meta and bank/<id> store keys`
  - `92d5868`: `feat(bank-store): implement bank operations in tauri store`
  - `00a0805`: `feat(bank): add BankProvider and BankManager`
  - `6171247`: `feat(bank-store): include bank in desktop snapshots`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 59 files / 386 tests passed (delta: +9 files, +86 tests vs baseline)
- **Builds**:
  - web clean (`npm run build` exit 0)
  - desktop clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Rust Unit Tests**: clean (`cargo test --manifest-path src-tauri/Cargo.toml` exit 0, 20 tests passed)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 307.2 kB (+6.5 kB vs baseline)
  - First-load CSS (gzip): 20.2 kB (+0.0 kB vs baseline)
  - Total JS (gzip): 417.2 kB
  - Total CSS (gzip): 20.2 kB
- **Gate P3**: GREEN

## Phase 4: Bank Screen
- **Date**: 2026-10-20
- **Commits**:
  - `0ee002d`: `feat(router): add bank routes and nav entries`
  - `aa68395`: `feat(bank-ui): group tree with create, rename, move, delete`
  - `32ac06c`: `feat(bank-ui): question list with search, tag and type filters`
  - `d66b9bd`: `feat(bank-ui): question editor panel`
  - `ee764a2`: `feat(bank-ui): bulk actions bar`
  - `5d081e6`: `feat(bank-ui): empty states, sorting, mobile drawer`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 64 files / 403 tests passed (delta: +14 files, +103 tests vs baseline)
- **Builds**:
  - web clean (`npm run build` exit 0)
  - desktop clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Rust Unit Tests**: clean (`cargo test --manifest-path src-tauri/Cargo.toml` exit 0, 20 tests passed)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 308.2 kB (+7.5 kB vs baseline, within +10 kB budget)
  - First-load CSS (gzip): 20.9 kB (+0.7 kB vs baseline)
  - Total JS (gzip): 435.6 kB
  - Total CSS (gzip): 20.9 kB
  - UI Webfonts (woff2 raw): 107.3 kB (0 delta)
  - Lazy BankScreen chunk: 17.98 kB gzip
- **Gate P4**: GREEN

## Phase 5: Editor Integration
- **Date**: 2026-10-20
- **Commits**:
  - `9336289`: `feat(editor): add from bank modal`
  - `034e41d`: `feat(editor): send questions to bank`
  - `5850290`: `feat(bank-ui): show usage counts and "do banco" markers`
  - `ddcdd51`: `perf(editor): lazy load bank modals to stay within first-load budget`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 66 files / 411 tests passed (delta: +16 files, +111 tests vs baseline)
- **Builds**:
  - web clean (`npm run build` exit 0)
  - desktop clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Rust Unit Tests**: clean (`cargo test --manifest-path src-tauri/Cargo.toml` exit 0, 20 tests passed)
- **Docs Check**: clean (`npm run docs:check` exit 0)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 309.1 kB (+8.4 kB vs baseline, within +10 kB budget)
  - First-load CSS (gzip): 21.0 kB (+0.8 kB vs baseline)
  - Total JS (gzip): 443.2 kB
  - Total CSS (gzip): 21.0 kB
  - UI Webfonts (woff2 raw): 107.3 kB (0 delta)
  - Lazy BankScreen chunk: 16.06 kB gzip
  - Lazy AddFromBankModal chunk: 3.08 kB gzip
  - Lazy SendToBankModal chunk: 2.33 kB gzip
- **Gate P5**: GREEN

## Phase 6: Rule Engine (Solver)
- **Date**: 2026-10-20
- **Commits**:
  - `a7ca219`: `feat(bank-solver): availability analysis`
  - `4393784`: `feat(bank-solver): seeded generation with flow, coverage, and xor resolution`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 67 files / 429 tests passed (delta: +17 files, +129 tests vs baseline)
- **Builds**: web clean (`npm run build` exit 0)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 309.1 kB (+8.4 kB vs baseline, within +10 kB budget)
  - First-load CSS (gzip): 21.0 kB (+0.8 kB vs baseline)
  - Total JS (gzip): 443.2 kB
  - Total CSS (gzip): 21.0 kB
  - UI Webfonts (woff2 raw): 107.3 kB (0 delta)
- **Gate P6**: GREEN

## Forward-Compatibility (1.3.0 Figures Isolation)
- **Date**: 2026-10-20
- **Commits**:
  - `9c884e5`: `refactor(bank): isolate question figures and forward-compat duplicate key`
- **Scope & Changes**:
  - Created [src/utils/bank/figures.ts](file:///home/salty/Documents/forks/GabariTeX/src/utils/bank/figures.ts) as the sole boundary module reading/writing figure/image fields (`getQuestionFigures`, `setQuestionFigures`, `collectQuestionImageRefs`, `figureKey`).
  - Derived `BankQuestion` type from `Question` via `Omit<Question, 'annulled' | 'sourceQuestionId'> & BankQuestionFields` in [src/types/bank.ts](file:///home/salty/Documents/forks/GabariTeX/src/types/bank.ts).
  - Updated `questionDuplicateKey` in [src/utils/bank/questions.ts](file:///home/salty/Documents/forks/GabariTeX/src/utils/bank/questions.ts) to include `figureKey(q)`; questions differing only by figure are not flagged as duplicates.
  - Updated `toExamQuestion`, `fromExamQuestion`, and bank question asset zip handling in [src/utils/profileZip.ts](file:///home/salty/Documents/forks/GabariTeX/src/utils/profileZip.ts) to use `figures.ts` abstractions.
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 68 files / 436 tests passed (100% green, +1 file, +7 tests)

## Phase 7: Text Language (Query)
- **Date**: 2026-10-20
- **Commits**:
  - `8cb50d1`: `feat(bank-query): text query language lexer, parser, printer, and suggest`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 69 files / 455 tests passed (delta: +19 files, +155 tests vs baseline)
- **Builds**:
  - web clean (`npm run build` exit 0)
  - desktop clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Rust Unit Tests**: clean (`cargo test --manifest-path src-tauri/Cargo.toml` exit 0, 20 tests passed)
- **Docs Check**: clean (`npm run docs:check` exit 0)
- **Audit**: clean (`node scripts/audit-dark-classes.mjs` exit 0, 0 offenders)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 309.2 kB (+8.5 kB vs baseline, strictly within +10 kB budget)
  - First-load CSS (gzip): 21.0 kB (+0.8 kB vs baseline)
  - Total JS (gzip): 443.3 kB
  - Total CSS (gzip): 21.0 kB
  - UI Webfonts (woff2 raw): 107.3 kB (0 delta)
- **Gate P7**: GREEN

## Phase 8: Generator UI
- **Date**: 2026-10-20
- **Commits**:
  - `ebcbda3`: `feat(generator): blueprint CRUD and models tab`
  - `535c99e`: `feat(generator): visual rule builder with live availability`
  - `5294731`: `feat(generator): text editor view with diagnostics and autocomplete`
  - `a9b252c`: `feat(generator): preview with lock, swap and re-roll`
  - `bf266c5`: `feat(generator): create exam or append to current exam`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 74 files / 466 tests passed (100% green)
- **Builds**:
  - web clean (`npm run build` exit 0)
  - desktop clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Rust Unit Tests**: clean (`cargo test --manifest-path src-tauri/Cargo.toml` exit 0, 20 tests passed)
- **Docs Check**: clean (`npm run docs:check` exit 0)
- **Audit**: clean (`node scripts/audit-dark-classes.mjs` exit 0, 0 offenders)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 309.6 kB (+8.9 kB vs baseline, strictly within +10 kB budget)
  - First-load CSS (gzip): 21.0 kB (+0.8 kB vs baseline)
- **Gate P8**: GREEN

## Phase 9: Import/Export and Sharing
- **Date**: 2026-10-20
- **Commits**:
  - `290a44e`: `refactor(bank-zip): extract shared zip helpers`
  - `f0fa650`: `feat(bank-zip): include bank in profile export and import`
  - `9b9b0b8`: `feat(bank-zip): share and import a group subtree`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 76 files / 478 tests passed (100% green, +2 files, +12 tests)
- **Builds**:
  - web clean (`npm run build` exit 0)
  - desktop clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Rust Unit Tests**: clean (`cargo test --manifest-path src-tauri/Cargo.toml` exit 0, 20 tests passed)
- **Docs Check**: clean (`npm run docs:check` exit 0, 26 screenshots verified)
- **Audit**: clean (`node scripts/audit-dark-classes.mjs` exit 0, 0 offenders; `tests/rule09-neutrals.test.ts` passed)
- **Bundle Metrics** (web build):
  - First-load JS (gzip): 307.6 kB (+6.9 kB vs baseline, strictly within +10 kB budget)
  - First-load CSS (gzip): 21.2 kB (+1.0 kB vs baseline)
  - Total JS (gzip): 467.7 kB
  - Total CSS (gzip): 21.2 kB
  - UI Webfonts (woff2 raw): 107.3 kB (0 delta)
- **Gate P9**: GREEN

## Phase 10: Documentation
- **Date**: 2026-10-21
- **Commits**:
  - `34e6430`: `docs(bank): add Banco de Questões user guide`
  - `95472c5`: `docs(bank): update criar-prova, perfis-backup, index and README`
  - `7750146`: `docs(bank): add screenshot manifest entries and demo bank`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 76 files / 478 tests passed (100% green)
- **Docs Check**: clean (`npm run docs:check` exit 0, 31 manifest entries verified, 0 warnings on new docs)
- **Docs Build**: clean (`npm run docs:build` exit 0, VitePress static build succeeded)
- **Checklist**: clean (`npm run docs:screenshots` generated `CHECKLIST.md`, 5 documented placeholders in manifest)
- **Gate P10**: GREEN

## Phase 11: Hardening and Release Prep
- **Date**: 2026-10-21
- **Commits**:
  - `8f2f1eb`: `test(bank): performance gate for 2000 questions and 5000 solver`
  - `db9713d`: `chore(release): v1.2.0`
- **tsc**: clean (`npx tsc --noEmit` exit 0)
- **Tests**: 77 files / 481 tests passed (100% green, +27 files / +181 tests vs baseline)
- **Builds**:
  - web clean (`npm run build` exit 0)
  - desktop clean (`VITE_TARGET=desktop npx vite build` exit 0)
- **Rust Unit Tests**: clean (`cargo test --manifest-path src-tauri/Cargo.toml` exit 0, 20 tests passed)
- **Docs Check**: clean (`npm run docs:check` exit 0, 31 manifest entries verified, 0 warnings on new docs)
- **Docs Build**: clean (`npm run docs:build` exit 0, VitePress static build succeeded)
- **Version Consistency**: clean (`npm run check:version` exit 0, v1.2.0 across all 6 target files)
- **Audit**: clean (`node scripts/audit-dark-classes.mjs` exit 0, 0 offenders; `tests/rule09-neutrals.test.ts` passed)
- **Bundle Metrics** (`.agents/plans/ui-redesign/measure-bundle.mjs dist` on web build):
  - First-load JS (gzip): 307.6 kB (+6.9 kB vs 300.7 kB baseline, strictly within +10 kB budget)
  - First-load CSS (gzip): 21.2 kB (+1.0 kB vs 20.2 kB baseline)
  - Total JS (gzip): 467.7 kB
  - Total CSS (gzip): 21.2 kB
  - UI Webfonts (woff2 raw): 107.3 kB (0 delta)
- **Performance Gate Measurements**:
  - 2,000 questions filter/search: 0.20 ms (budget < 50 ms)
  - 5,000 questions solver benchmark: 26.44 ms (budget < 100 ms)
  - 50 lines query parser: 2.72 ms (budget < 10 ms)
- **Gate P11**: GREEN

---

## Pull Request Description

### Summary

This release introduces the **Banco de Questões** (Question Bank) and **Sorteio Automatizado de Provas** (Automated Exam Generation) in GabariTeX `v1.2.0`.

#### Key Features:
1. **Taxonomia em Árvore & Etiquetas Livres**:
   - Árvore hierárquica de grupos taxonômicos (até 12 níveis de profundidade) com contadores dinâmicos agregados.
   - Reorganização via arrastar-e-soltar e atalhos de teclado (F2 para renomear inline, Delete para exclusão segura com migração de itens).
   - Sistema de etiquetas transversais coloridas com gerenciamento centralizado (criação, edição de cores, exclusão com desvinculação limpa e fusão de marcadores).

2. **Gestão de Questões do Acervo**:
   - Questões de múltipla escolha (2 a 5 alternativas) com definição de gabarito e dissertativas com pauta dimensionável de linhas.
   - Renderização nativa de equações matemáticas em LaTeX via KaTeX no enunciado, alternativas e resolução comentada.
   - Anexo de figuras com legenda integrada e abstração de isolamento de imagens (forward-compatible com v1.3.0).
   - Arquivamento de itens históricos e atribuição de pontuação padrão.

3. **Integração com o Editor de Provas**:
   - Botão **Adicionar do Banco** no editor com modal de busca, filtros taxonômicos e marcação "Já na Prova" (respeitando o teto de 40 questões por avaliação).
   - Botão **Salvar no Banco** na prova com detecção automática de duplicadas (enunciado normalizado + alternativas + hash de imagem).

4. **Gerador de Provas & Modelos (Blueprints)**:
   - Construtor visual interativo com blocos de regras e operadores lógicos de origem (`OU` / `OR`, `E` / `AND`, `XOU` / `XOR`, `EXCETO` / `EXCEPT`).
   - Linhas de cotas por etiquetas, tipos e pontos com cálculo em tempo real de questões disponíveis e detecção de escassez e conflitos concorrentes.
   - Editor em modo texto (DSL formal com suporte bilíngue PT/EN, autocompletar inteligente e diagnósticos de sintaxe com posição de cursor).
   - Sorteio determinístico reproduzível via semente (*seed*), pré-visualização interativa com travas (*lock*) e substituições (*swap*), e opção de evitar repetição de questões de provas anteriores.

5. **Compartilhamento e Backups**:
   - Exportação e importação de subárvores isoladas em pacotes compactados `.gabaritex-bank.zip`.
   - Inclusão automática e deduplicada do acervo no backup integral de perfil (.zip) e nos snapshots diários do desktop.

### Downgrade Note

O banco de dados IndexedDB na versão web foi atualizado para a versão 2 (`DB_VERSION = 2`) para adicionar as novas *object stores* (`bank_groups`, `bank_tags`, `bank_questions`, `bank_blueprints`). Navegadores que executarem a versão 1.2.0 não poderão ter seus dados locais lidos diretamente por versões legadas 1.1.x sem limpeza prévia dos dados do navegador ou restauração via arquivo de backup `.zip`.

### Test Counts & Quality Verification

- **Vitest**: 77 arquivos de teste / 481 testes passando (100% green, +27 arquivos / +181 testes vs v1.1.1).
- **Rust / Tauri**: 20 testes unitários passando.
- **Orçamento de Bundle**: First-load JS gzip em 307.6 kB (+6.9 kB vs baseline 300.7 kB; estritamente dentro do limite orçado de +10 kB / 310.7 kB).
- **Dark Mode Audit**: 0 pendências encontradas em toda a base de código.
- **Performance Gate**:
  - Filtro e busca sobre 2.000 questões: 0.20 ms (orçamento: < 50 ms)
  - Solver sobre 5.000 questões: 26.44 ms (orçamento: < 100 ms)
  - Parser de 50 linhas de regras: 2.72 ms (orçamento: < 10 ms)
- **Documentação**: Manual completo em `docs/banco-de-questoes.md`, atualizações no `README.md` e guias existentes, e manifesto de screenshots validado.

### How to Verify

1. `npm test` para executar a suíte completa de testes unitários.
2. `npm run check:version` para validar consistência de versão v1.2.0.
3. `npm run build` e `node .agents/plans/ui-redesign/measure-bundle.mjs dist` para conferir métricas do bundle.
4. `npm run docs:check` e `npm run docs:build` para validar integridade da documentação.
5. `cargo test --manifest-path src-tauri/Cargo.toml` para executar testes de backend Rust.








