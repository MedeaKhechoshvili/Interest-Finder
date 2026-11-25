# Running the application and integration tests

The Next.js frontend lives in `frontend/` inside the Interest-Finder repository.
Commands below use that location. Backend commands run from the repository root.

## One-time backend setup

From the repository root, use Python 3.11 or newer:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp -n .env.example .env
.venv/bin/python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Put the generated secret into `JWT_SECRET_KEY` in the root `.env`. Keep any
existing configured environment file. If your backend environment is already
installed, use it instead of creating another one.

## Run the app normally

Terminal 1, from the repository root:

```bash
.venv/bin/python -m uvicorn app.main:app --reload --app-dir src
```

API documentation: http://localhost:8000/docs

Terminal 2, from the repository root:

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
executables on Linux/macOS and Windows. To select a different environment:

```bash
TEST_PYTHON=/absolute/path/to/python npm run test:integration
```

For an already installed compatible Chromium browser, you can set
`PLAYWRIGHT_EXECUTABLE_PATH` to its executable path. Otherwise Playwright uses
the Chromium browser installed by the command above.

On Windows PowerShell, from the repository root, create and install the backend
environment if one is not already configured:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

For normal backend development, follow the root README for first-time `.env`
configuration. To start the configured normal backend, from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir src
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

Each scenario runs in a desktop browser and a mobile browser configuration:

1. Registration and login through the actual frontend forms, session cookie
   protection, account reload, protected API calls, and logout.
2. The real API's incorrect-credentials response displayed by the frontend.
3. Guest access protection and rejection of foreign-origin writes.
4. Invalid-token rejection by FastAPI and cookie removal by Next.js.
5. Responsive form overflow and the shadcn mobile navigation sheet.

The complete workflow also saves a fixture book, marks it completed, and creates
a review through the Next.js API proxy. Independent requests to FastAPI read
the saved item and review back to verify persistence and the user association.
Those screens are placeholders, so this part checks their API connection rather
than claiming their UI is implemented.

The API runs the real application, authentication, routes, and SQLAlchemy models.
No application endpoints are mocked. A catalog book with local ID 101 is seeded
in the temporary database so provider credentials and internet access are not
needed. Tests do not exercise live catalog providers or PostgreSQL.

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

These tests provide frontend-to-backend integration evidence. Unit and component
tests are separate: see [UNIT_TESTS.md](UNIT_TESTS.md) and run
`npm run test:coverage` to check the 50 percent coverage target.

## Team test folders

See [tests/README.md](tests/README.md) for feature folders, ownership, naming,
and commands for running one person's tests. Each member adds tests alongside
their assigned feature work.
