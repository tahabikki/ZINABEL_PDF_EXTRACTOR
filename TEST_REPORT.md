# Test Audit Report — ZINAPDFANALYZER

Date: 2026-04-07
Author: Senior tester (audit performed by automated inspection + local runs)

---

## Summary

- **Unit tests:** Ran `npm test` (Vitest). Result: **13 tests, 13 passed, 0 failed**. (See test output in terminal.)
- **Type check:** Ran `npx tsc -p tsconfig.json --noEmit` — **no TypeScript errors**.
- **Lint:** Ran `npm run lint` — **68 problems** (50 errors, 18 warnings). Key categories: hooks rules, many `any` usages, empty-blocks, stylistic/react-refresh warnings.
- **Build:** Ran `npm run build` — **build succeeded**, but produced large chunks (warnings). Notable assets: `index-DwWFLpSx.js` (~747.4 kB) and `html2pdf-B3kO98OT.js` (~975.8 kB) before gzip.
- **Runtime warnings observed during tests:** pdfjs warnings recommending the `legacy` build; validateDOMNesting warning for nested `<button>`.

---

## Actions performed

Commands executed (local workspace):

```bash
npm test --silent
npx tsc -p tsconfig.json --noEmit
npm run lint --silent
npm run build --silent
```

Also performed codebase scans (grep) and manual inspection of key components: `OrderTable.tsx`, `OrderView.tsx`, `OrderAnalytics.tsx`, `filterUtils.ts`, `pdfParser.ts`, `ui/button.tsx`, plus Tailwind config and build output.

---

## High-level findings (priority)

- **Master-filter toggle (`Retirer validés`) does not change the table view**: The UI exposes a `removeValidatedFromMaster` checkbox but the filtering/rendering code does not reference it. Evidence: state defined at [src/components/OrderTable.tsx](src/components/OrderTable.tsx#L176) but not used in the filter/visibleRows logic ([src/components/OrderTable.tsx](src/components/OrderTable.tsx#L1228)).
  - Severity: High (broken/absent feature relative to UI control).
  - Reproduce (code inspection): open `OrderTable.tsx` and observe `removeValidatedFromMaster` is only used as the `checked` value for the input; no effect on `filteredAll`/`visibleRows`.

- **React Hook rules violation (conditional hooks) in `OrderAnalytics`**: ESLint reports hooks (e.g. `useState`, `useMemo`) are called conditionally because there is an early return before the hook calls. See lint errors at [src/components/OrderAnalytics.tsx](src/components/OrderAnalytics.tsx#L53).
  - Severity: High (can cause runtime hook-order breakage when props/state change).
  - Reproduce: Lint or render `OrderAnalytics` with/without `lines` prop — hook order may differ.

- **Nested `<button>` warning (validateDOMNesting)**: Tests printed the warning "<button> cannot appear as a descendant of <button>" originating from the collapsible trigger wrapping an outer `<button>` while inner `Button` components render `<button>` elements. See UI trigger at [src/components/OrderView.tsx](src/components/OrderView.tsx#L253) and `Button` implementation at [src/components/ui/button.tsx](src/components/ui/button.tsx#L41).
  - Severity: Medium (accessibility and event propagation issues; can cause unexpected behavior).
  - Reproduce: Run unit tests (warning appeared) or open order view and inspect console for DOM nesting warnings.

- **ESLint: many `any` usages and rule errors across codebase**: Numerous `@typescript-eslint/no-explicit-any` errors reported (examples: [src/lib/filterUtils.ts](src/lib/filterUtils.ts#L6), [src/lib/pdfParser.ts](src/lib/pdfParser.ts#L448), tests under `src/lib/*.test.ts`).
  - Severity: Medium (type-safety regression; harder to maintain).
  - Files with repeated `any` usage include `src/lib/filterUtils.ts`, `src/components/OrderTable.tsx`, `src/lib/pdfParser.ts`, several test files and utility modules.

- **ESLint errors: empty block statements and unused/incorrect `eslint-disable`**: Examples in `src/components/OrderTable.tsx` (empty blocks flagged; see lines around [src/components/OrderTable.tsx](src/components/OrderTable.tsx#L223) and [src/components/OrderTable.tsx](src/components/OrderTable.tsx#L256)) and `src/components/ui/error-boundary.tsx` flagged for multiple empty blocks.
  - Severity: Medium/Low (cleanliness and potential hidden errors).

- **pdf.js / `pdfjs-dist` Node warning**: Tests log "Please use the `legacy` build in Node.js environments." The parser imports `pdfjs-dist` and sets the worker: [src/lib/pdfParser.ts](src/lib/pdfParser.ts#L1) and workerSrc at [src/lib/pdfParser.ts](src/lib/pdfParser.ts#L5).
  - Severity: Low/Medium (no test failure, but noisy runtime warnings and potential Node compatibility concerns for server environments).

- **Control-regex lint warning in `pdfParser`**: Lint reports control characters in regex at [src/lib/pdfParser.ts](src/lib/pdfParser.ts#L18) (the regex used to strip control characters).
  - Severity: Low (style/lint issue but flagged by linter).

- **Large production bundle warnings**: Build produced large chunks that exceed common thresholds. Notable outputs recorded during build:
  - `dist/assets/index-DwWFLpSx.js` — 747.39 kB (raw)
  - `dist/assets/html2pdf-B3kO98OT.js` — 975.75 kB (raw)
  - Severity: Medium (affects initial load performance; consider code-splitting/dynamic import for heavy libs like html2pdf).

- **React refresh / export warnings**: Multiple files export non-component values alongside components which triggers `react-refresh/only-export-components` warnings (e.g. `src/components/ui/badge.tsx`, `src/components/ui/button.tsx` etc.).
  - Severity: Low (affects dev fast-refresh behavior).

---

## Test outputs & notable runtime messages

- Vitest run (summary): `Test Files 11 passed (11)` / `Tests 13 passed (13)` — all tests passed. However tests output several runtime warnings (pdfjs legacy build, validateDOMNesting from tests). The validateDOMNesting occurred in tests for `OrderView` and points to nested button components.

- ESLint full run produced 68 problems (50 errors, 18 warnings). Run output excerpt (most frequent issues): hooks rules-of-hooks, `no-explicit-any`, `no-empty`, `react-refresh/only-export-components`.

- Build completed successfully, with chunk-size warnings as listed above.

---

## Reproduction steps (quick)

- To reproduce unit tests + warnings:

```bash
npm test
# observe: all tests pass, check stderr for "Please use the `legacy` build" and "validateDOMNesting" warnings
```

- To reproduce lint findings:

```bash
npm run lint
# review reported files and lines in the output
```

- To reproduce the master-filter issue (code inspection):
  1. Open `src/components/OrderTable.tsx` and find `removeValidatedFromMaster` at [src/components/OrderTable.tsx](src/components/OrderTable.tsx#L176).
  2. Search for any reference that uses this state when computing `filteredAll` or `visibleRows` — none found. `visibleRows` is computed at [src/components/OrderTable.tsx](src/components/OrderTable.tsx#L1228).
  3. Expected: toggling the checkbox should exclude validated rows when on the `principal` view. Observed: checkbox only toggles state but does not filter rows.

- To reproduce nested button warning:
  1. Open `src/components/OrderView.tsx` at the Collapsible trigger [src/components/OrderView.tsx](src/components/OrderView.tsx#L253).
  2. The outer collapsible trigger renders a `<button>` element and inner `Button` components render `<button>` elements by default ([src/components/ui/button.tsx](src/components/ui/button.tsx#L41)).
  3. Unit tests surfaced the `validateDOMNesting` warning.

---

## Recommendations & next verification steps (not remediation)

- Prioritize fixing the missing effect of `removeValidatedFromMaster` (High).
- Fix conditional-hook usage in `OrderAnalytics` to call hooks unconditionally (High).
- Address nested-button markup in `OrderView` to avoid nested `<button>`s (Medium).
- Run targeted eslint fixes and address frequent `any` usages (Medium).
- Investigate pdfjs usage and the Node `legacy` build warning (Low/Medium).
- Consider code-splitting or moving `html2pdf` to a lazy/dynamic import to reduce initial bundle size (Medium performance).

---

## Files & code links (examples)

- Master filter state: [src/components/OrderTable.tsx](src/components/OrderTable.tsx#L176)
- Computed visible rows / activeView: [src/components/OrderTable.tsx](src/components/OrderTable.tsx#L1228)
- Collapsible trigger (nested button risk): [src/components/OrderView.tsx](src/components/OrderView.tsx#L253)
- `Button` component implementation (asChild / renders `button`): [src/components/ui/button.tsx](src/components/ui/button.tsx#L41)
- Hook-order lint errors: [src/components/OrderAnalytics.tsx](src/components/OrderAnalytics.tsx#L53)
- Filter utilities (explicit `any` usage): [src/lib/filterUtils.ts](src/lib/filterUtils.ts#L6)
- PDF parser import and worker usage: [src/lib/pdfParser.ts](src/lib/pdfParser.ts#L1)

---

If you want, I can:
- produce a prioritized bug list with exact lint output clipped and line references,
- run a small Playwright script to validate responsiveness at 3 viewport sizes (needs the dev server started), or
- open and attach failing lint excerpts into a downloadable artifact.

Tell me which follow-up you'd like next.
