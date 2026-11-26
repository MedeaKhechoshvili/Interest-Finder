# Running the application and integration tests

The Next.js frontend lives in `frontend/` inside the Interest-Finder repository.
Commands below use that location. Backend commands run from the repository root.

## One-time backend setup

Install [uv](https://docs.astral.sh/uv/) first (see the
[root README](../README.md#local-setup-with-uv)). Then, from the repository root:

```bash
uv sync
cp -n .env.example .env
uv run python -c "import secrets; print(secrets.token_urlsafe(32))"
```

`uv sync` creates `.venv` with the exact package versions from `uv.lock`. Put the
generated secret into `JWT_SECRET_KEY` in the root `.env`. Keep any existing
configured environment file.

## Run the app normally

Terminal 1, from the repository root:

```bash
uv run uvicorn app.main:app --reload --app-dir src
```

API documentation: http://localhost:8000/docs

Terminal 2, from the repository root (Node.js 26.13.1 and npm 12.2.3; see
`frontend/.nvmrc` and `packageManager` in `package.json`):

```bash
cd frontend
npm ci
cp -n .env.example .env.local
npm run dev
```

Frontend: http://localhost:3000

Use `BACKEND_API_URL=http://127.0.0.1:8000/api/v1` and
`APP_ORIGIN=http://localhost:3000` in the frontend environment file.

## Run the integration tests

In another terminal, from the repository root:

```bash
cd frontend
npx playwright install chromium
npm run test:integration
```

The browser installation is needed only once per Playwright version. If Linux
reports missing browser system libraries, install them with
`npx playwright install --with-deps chromium`.

The tests automatically start and stop their own servers:

| Service       | Address               | Storage                   |
| ------------- | --------------------- | ------------------------- |
| Test frontend | http://localhost:3001 | `.next-integration/`      |
| Test FastAPI  | http://127.0.0.1:8001 | Temporary SQLite database |

You can run the tests without starting the normal app. You can also leave the
normal app running on ports 3000 and 8000. Keep ports 3001 and 8001 free; tests
refuse to reuse an existing server to avoid modifying another database.

The runner finds the backend repository by looking for `src/app/main.py`. Keep
the frontend inside that repository. It detects `venv` and `.venv` Python
executables on Linux/macOS and Windows, including the `.venv` created by
`uv sync`. To select a different environment:

```bash
TEST_PYTHON=/absolute/path/to/python npm run test:integration
```

For an already installed compatible Chromium browser, you can set
`PLAYWRIGHT_EXECUTABLE_PATH` to its executable path. Otherwise Playwright uses
the Chromium browser installed by the command above.

On Windows PowerShell, from the repository root, install the backend
environment if it is not already set up:

```powershell
uv sync
```

For normal backend development, follow the root README for first-time `.env`
configuration. To start the configured normal backend, from the repository root:

```powershell
uv run uvicorn app.main:app --reload --app-dir src
```

For Playwright checks, from the repository root:

```powershell
cd frontend
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run test:integration
```

Integration tests generate their own signing secret and database configuration;
no real provider credentials or new development `.env` are needed for those tests.
Use `Copy-Item .env.example .env.local` inside `frontend/` only for first-time
normal frontend configuration; do not overwrite an existing configured file.
To select a custom Python on Windows, set `$env:TEST_PYTHON` to its full path
before running the integration command.

## What is checked

Each of the twelve scenarios runs in a desktop browser (Desktop Chrome) and a mobile
browser (Pixel 7), for 24 tests in total:

1. Registration and login through the actual frontend forms, session cookie
   protection, account reload, protected API calls, and logout
   (`workflows/account-to-review.spec.ts`).
2. The real API's incorrect-credentials response displayed by the frontend.
3. Guest access protection and rejection of foreign-origin writes.
4. Invalid-token rejection by FastAPI and cookie removal by Next.js.
5. Desktop and mobile layouts of the login and registration pages, with no page
   overflow, plus the shadcn mobile navigation sheet (`layout/responsive.spec.ts`).
6. The guest login prompt: it opens from a private action, fits the screen,
   closes with Escape and returns focus, and its links return to the original page
   after a real login (`auth/prompt.spec.ts`).
7. Guest navigation without My Lists links or buttons (`auth/prompt.spec.ts`).
8. Home loads the real `/home` response through the Next.js proxy, shows eight
   cards in two rows, links cards to Detail, loads every image, and fits the screen
   (`home/home.spec.ts`).
9. Home search and category links open Discover with `q` and `category`.
10. A missing image shows an accessible "No image available" fallback.
11. A guest's bookmark opens the login prompt, and after a real login the user
    returns to Home.
12. Home has no horizontal overflow at 320 px and 768 px widths.

Latest local run (Windows, Node.js 26.13.1): 24 of 24 passed. The development
database was unchanged. In an earlier run, the mobile login scenarios were also
repeated five times (`--project=mobile --repeat-each=5`) and passed 15 of 15.

### Catalog fixture

The test API replaces the live movie, book, music, and attraction providers with
`tests/fixtures/home/response.json`. Home, search, and item details all read
these eight test items, so the tests need no provider keys or internet access.
Fixture images in `tests/fixtures/home/images/` are served by the Home tests
through Playwright's request routing. This data is only used by tests.

### Waiting for hydrated forms

An earlier mobile run registered successfully but stayed on the login page with
an empty email field. The test had typed into the server-rendered form before
React hydrated it, and hydration reset the field. The forms now stay disabled
until hydration finishes. Before typing, tests wait for
`toBeEditable()`, and they check the entered values with `toHaveValue()` before
submitting. There are no fixed sleeps. Use the same pattern in new tests that
fill in forms.

The complete workflow also saves a fixture book, marks it completed, and creates
a review through the Next.js API proxy. Independent requests to FastAPI read
the saved item and review back to verify persistence and the user association.
Those screens are placeholders, so this part checks their API connection rather
than claiming their UI is implemented.

The API runs the real application, authentication, routes, and SQLAlchemy models.
No application endpoints are mocked; only the external catalog providers are
replaced by the fixture described above. A catalog book with local ID 101 is
also seeded in the temporary database for the save and review workflow. Tests do
not exercise live catalog providers or PostgreSQL.

Each run generates its own signing secret and test accounts. The temporary
database is removed on normal shutdown. The development database and root `.env`
are not changed. The test startup overrides configuration before importing the API.

## Reports and debugging

```bash
npm run test:integration:report
npm run test:integration:ui
npm run test:integration -- --project=desktop
npm run test:integration -- --headed
```

The HTML report is in `playwright-report/`. Failed runs save screenshots and
traces in `test-results/`. Both folders are ignored by Git. Stop a run with Ctrl+C.

Because the test frontend runs `next dev`, Next.js 16 may create `frontend/AGENTS.md`
(instructions for AI coding tools). It is not a test result. Setting `agentRules: false` in
`next.config.ts` turns it off.

These tests provide frontend-to-backend integration evidence. Unit and component
tests are separate: see [UNIT_TESTS.md](UNIT_TESTS.md) and run
`npm run test:coverage` to check the 50 percent coverage target.

## Team test folders

See [tests/README.md](tests/README.md) for feature folders, ownership, naming,
and commands for running one person's tests. Each member adds tests alongside
their assigned feature work.
