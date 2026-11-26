# Frontend unit and component tests

Run these commands from the `frontend/` directory in Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:coverage
npm.cmd run typecheck
npm.cmd run build
```

`npm.cmd ci` installs the exact dependency versions from `package-lock.json`. The unit/component suite uses Vitest and React Testing Library. It runs in jsdom and mocks API requests and browser/server integrations where appropriate, so the unit tests do not require a running FastAPI server or real provider API keys.

## Latest reported results

The latest results supplied for this branch were:

| Check | Result |
|---|---|
| Unit/component tests | **228 passed** |
| Test files | **16 passed** |
| Overall statements coverage | **81.31%** |
| Overall branches coverage | **82.64%** |
| Overall functions coverage | **72.30%** |
| Overall lines coverage | **81.64%** |
| TypeScript typecheck | Passed |
| Production build | Passed |

The configured minimum is 50% for statements, branches, functions, and lines. All four latest coverage results exceed that minimum.

The My Lists tests account for **37 tests** across the three files listed below. These results describe the run reported for this branch; rerun the commands above after changing code or merging additional changes.

## My Lists unit/component tests

The feature tests are in `tests/unit/saved-items/`:

| Test file | Tests | What it checks |
|---|---:|---|
| `saved-items.test.ts` | 18 | Saved-items API helpers, response validation, numeric local catalog ID validation, resolving a missing local ID through the detail endpoint, and using saved-record IDs for updates/deletes. |
| `save-button.test.tsx` | 7 | Save success, missing local ID resolution, duplicate handling, request failures, parent-provided saved state, and preventing multiple submissions while a save is pending. |
| `my-lists-client.test.tsx` | 12 | Planned and Completed lists, counts, empty states, tab selection, status changes, deletion and confirmation, retry behavior, update/delete errors, missing catalog details, and image fallback. |

Run only these tests from `frontend/`:

```powershell
npm.cmd test -- tests/unit/saved-items
```

Important integration note: the `SaveButton` component has unit tests, but in the current source it is not yet rendered by Discover cards or a Detail page. The tests verify the component in isolation; they do not prove that a user can currently save an item from those screens. The Detail page is also not implemented in this branch snapshot.

## Coverage report

Run:

```powershell
npm.cmd run test:coverage
```

Open `coverage/index.html` inside `frontend/` to view the detailed report. The configured coverage collection measures application TypeScript under `src/`, excluding generated UI components. Coverage output is generated locally and should not normally be committed.

Latest reported coverage for the main My Lists files:

| File | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `src/components/my-lists-client.tsx` | 91.46% | 82.89% | 92.30% | 95.94% |
| `src/components/save-button.tsx` | 96.42% | 92.59% | 100% | 100% |
| `src/lib/saved-items.ts` | 100% | 100% | 100% | 100% |

## Other frontend checks

Typecheck:

```powershell
npm.cmd run typecheck
```

Production build:

```powershell
npm.cmd run build
```

The latest reported runs of both commands passed.

The browser integration suite is separate from Vitest unit tests. To run it from `frontend/`:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:integration
```

See [INTEGRATION_TESTS.md](INTEGRATION_TESTS.md) for setup, scenarios, and troubleshooting. The integration suite was not included in the latest results listed above.

## Useful test commands

Run tests in watch mode:

```powershell
npm.cmd run test:watch
```

Run one test file:

```powershell
npm.cmd test -- tests/unit/saved-items/save-button.test.tsx
```

The current `package.json` does not define a `lint` script. Lint is therefore not part of the current frontend test/check commands; do not report lint as passing or include `npm.cmd run lint` in the verification steps.