# Project testing guide

This document describes the automated and manual checks for Interest Finder. It covers the backend, frontend unit/component tests, browser integration tests, and the additional checks to run before opening a pull request.

Use the commands for your operating system and run them from the directory shown. Do not report a check as passing unless it has completed successfully in your environment.

## Backend tests

From the repository root, using the project's configured Python environment:

```powershell
uv run pytest -q
uv run python scripts/export_openapi.py --check
```

The backend test suite uses isolated test databases and mocked provider responses. Real provider credentials are not required for automated tests. The OpenAPI check verifies that `openapi.yaml` matches the application's current routes and schemas.

For the My Lists workflow, `tests/test_my_lists_workflow.py` covers the saved-items API, including authentication, empty results, creating saved records, duplicate saves, status changes, deletion, ownership enforcement, and catalog details in saved-item responses. `tests/test_saved_items.py` contains additional saved-items endpoint checks.

The latest reported backend run completed **236 passed and 1 warning**. The warning is a Starlette deprecation notice about its current `httpx` test-client integration; it did not fail the suite. The OpenAPI check also passed: `openapi.yaml matches the application.`

## Frontend unit and component tests

Run from `frontend/`:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:coverage
npm.cmd run typecheck
npm.cmd run build
```

The Vitest configuration runs tests under `tests/unit/**/*.test.{ts,tsx}` in jsdom. API requests, server-only modules, and browser-dependent behavior are mocked where appropriate, so these tests do not require the API server.

The latest reported frontend run completed **228 tests across 16 test files**. The three My Lists test files account for 37 tests. Overall coverage was 81.31% statements, 82.64% branches, 72.30% functions, and 81.64% lines. Each metric exceeds the configured 50% minimum. Typechecking and the production build also passed.

The frontend `package.json` does not define a `lint` script. Lint is not part of the current reported checks.

### My Lists test files

The My Lists tests are located in `frontend/tests/unit/saved-items/`:

| Test file | Tests | Coverage |
|---|---:|---|
| `saved-items.test.ts` | 18 | Saved-items API helpers, response validation, numeric catalog ID validation, resolving a missing local ID through the detail endpoint, and using saved-record IDs for updates/deletes. |
| `save-button.test.tsx` | 7 | Successful saves, missing local ID resolution, duplicate handling, request failures, parent-provided saved state, and preventing multiple submissions while a save is pending. |
| `my-lists-client.test.tsx` | 12 | Planned and Completed lists, counts, empty states, tab selection, status changes, deletion and confirmation, retry behavior, update/delete errors, missing catalog details, and image fallback. |

Run only the My Lists tests from `frontend/`:

```powershell
npm.cmd test -- tests/unit/saved-items
```

These frontend tests mock the API helper functions. They verify the component and helper behavior but do not replace manual frontend/backend integration testing.

### Coverage requirements

The Vitest coverage configuration includes application TypeScript under `frontend/src/`, excludes generated shadcn components under `src/components/ui/`, and sets a 50 percent minimum for each of lines, statements, branches, and functions.

Run:

```powershell
npm.cmd run test:coverage
```

The command must complete successfully to claim that all configured coverage thresholds have passed. Review `frontend/coverage/index.html` for the detailed report. Coverage output is generated locally and should not normally be committed.

Latest My Lists file coverage:

| File | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `components/my-lists-client.tsx` | 91.46% | 82.89% | 92.30% | 95.94% |
| `components/save-button.tsx` | 96.42% | 92.59% | 100% | 100% |
| `lib/saved-items.ts` | 100% | 100% | 100% | 100% |

## Browser integration tests

The Playwright integration suite runs from `frontend/`:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:integration
```

The integration runner starts its own test frontend and FastAPI server, uses a temporary SQLite database, and cleans up the test environment. It exercises real application routes and authentication rather than mocking the API. See [frontend/INTEGRATION_TESTS.md](../frontend/INTEGRATION_TESTS.md) for setup, test scenarios, troubleshooting, and report commands. The integration suite was not included in the latest results listed above.

## Manual My Lists workflow

For manual end-to-end testing, start the normal backend from the repository root:

```powershell
uv run uvicorn app.main:app --reload --app-dir src
```

In a second terminal, start the frontend:

```powershell
cd frontend
npm.cmd run dev
```

Open `http://localhost:3000`, sign in, and visit `/my-lists`.

To create a local catalog fixture, run this from the repository root:

```powershell
uv run python scripts/create_test_catalog_item.py
```

The script creates or reuses a test book and prints its local numeric catalog ID. Creating the catalog item does not itself save it to a user's list.

In this branch snapshot, the reusable `SaveButton` component is implemented and unit-tested, but it is not yet rendered by Discover cards or a Detail page. To seed a saved record for manual My Lists testing, use Swagger at `http://localhost:8000/docs` or an authenticated API client to call `POST /api/v1/saved-items/`, documented in [docs/saved-items-api.md](saved-items-api.md). The request body must use the numeric local catalog ID printed by the script, not the provider's external ID. Once the Save button is wired into a page, add a separate manual test for saving directly from that page.

Verify the following manually:

1. The protected My Lists page requires a signed-in user.
2. Planned and Completed lists show the correct saved items and counts.
3. Empty lists display an appropriate empty state.
4. An item can move from Planned to Completed and back.
5. Removing an item deletes the saved record after confirmation.
6. Changes persist after refreshing the page.
7. Loading and operation errors are displayed and can be retried where applicable.
8. A second account cannot update or delete the first account's saved record.
9. The page remains usable at desktop and mobile viewport sizes.

Use `http://localhost:8000/docs` to inspect the API schemas and authenticate Swagger requests. PATCH and DELETE use the saved-item record ID; POST uses the catalog item ID. These are different identifiers.

## Pull request checks

Before opening a pull request, run the relevant backend and frontend checks, review the changed files, and ensure that local secrets and generated files are excluded.

From the repository root:

```powershell
git status
git diff --check
git diff --name-status origin/main...HEAD
git diff --stat origin/main...HEAD
```

Do not commit `.env`, `.venv/`, `frontend/node_modules/`, local databases, Python caches, `frontend/.next/`, or generated coverage and Playwright output. Keep `.env.example`.

For feature-specific implementation and API details, see [docs/my-lists-implementation.md](my-lists-implementation.md) and [docs/saved-items-api.md](saved-items-api.md). Frontend-wide unit and integration test instructions are in [frontend/UNIT_TESTS.md](../frontend/UNIT_TESTS.md) and [frontend/INTEGRATION_TESTS.md](../frontend/INTEGRATION_TESTS.md).