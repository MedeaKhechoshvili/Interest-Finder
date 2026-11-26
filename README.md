# InterestFinder

COMPE 561 term project for discovering and organizing interests across movies, books, music, and attractions.

## Project Overview

InterestFinder helps users discover things they may enjoy, save items for later, track completed items, and share ratings and reviews.

The approved interface includes:

- Home
- Discover
- Detail
- My Lists
- Log In
- Sign Up

Users can organize saved items into planned and completed lists. Completed items can be rated and reviewed.

## Design Direction

The interface follows a forest-green and cream editorial visual identity. The desktop and responsive mobile designs were created in Figma and guide the Next.js implementation.

## Development Plan

1. Front-end design and responsive layout
2. Next.js frontend implementation
3. Backend development
4. Database and API integration
5. Testing and deployment

## Team Workflow

Work is organized through GitHub Issues, milestones, and the Interest Finder Project Board. Feature work should be completed on a separate branch and submitted through a pull request for review before merging into the main branch.

## Backend Development

The backend uses FastAPI, SQLAlchemy, SQLite, Pydantic, and JWT authentication. It implements registration/login, public catalog discovery and details, personal planned/completed items, and public ratings/reviews. Routes are under `/api/v1`.

### Local setup with uv

The backend uses [uv](https://docs.astral.sh/uv/) to manage Python and its packages. `pyproject.toml` lists the dependencies, and `uv.lock` pins their exact versions. Python 3.11 or newer is required.

Install uv once. On Windows:

```powershell
winget install --id=astral-sh.uv -e
```

On macOS/Linux:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Open a new terminal afterward so the `uv` command is available. Then run these commands in the repository folder:

```powershell
uv sync
Copy-Item .env.example .env
uv run python -c "import secrets; print(secrets.token_urlsafe(32))"
```

`uv sync` creates `.venv` and installs the exact versions from `uv.lock`, including the test tools. On macOS/Linux, use `cp .env.example .env` instead of `Copy-Item`.

Copy the generated value into `JWT_SECRET_KEY` in your private `.env`. Only copy `.env.example` when first setting up: do not overwrite an existing configured `.env`. Never commit `.env`, tokens, passwords, or SQLite database files.

Start the server:

```powershell
uv run uvicorn app.main:app --reload --app-dir src
```

`uv run` runs a command inside the project's environment, so there is no need to activate `.venv` first.

#### Without uv

`requirements.txt` remains available as an alternative. It lists version ranges, so installed versions can differ from `uv.lock`.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir src
```

On macOS/Linux, use `python3 -m venv .venv` and `.venv/bin/python` in place of `.\.venv\Scripts\python.exe`.

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>
- Generated OpenAPI: <http://localhost:8000/openapi.json>
- Health: <http://localhost:8000/api/v1/health>

The `/` path has no route and returns 404. Startup creates registered tables in `interestfinder.db`; it does not migrate existing table definitions. SQLite foreign-key enforcement is enabled on new SQLite connections. Keep development databases separate from tests.

### Provider configuration

| Category | Adapter | Private `.env` configuration |
|---|---|---|
| Movies | TMDB | `TMDB_ACCESS_TOKEN` |
| Books | Google Books | `GOOGLE_BOOKS_API_KEY`; leave empty if testing without a key, rather than sending the example placeholder |
| Music | MusicBrainz | `MUSICBRAINZ_USER_AGENT`; no API key used by this adapter |
| Attractions | OpenTripMap | `OPENTRIPMAP_API_KEY`, optionally `DEFAULT_ATTRACTIONS_CITY` |

Replace example credentials before live testing. Provider access and quotas depend on the provider account; a working test suite does not guarantee live availability. Automated tests use mocked providers and require no real API credentials.

A provider timeout or upstream failure, including quota errors, is normally returned as `502 PROVIDER_UNAVAILABLE`. A stored item detail can be returned during a provider outage. All-category search can return results from the providers that succeeded, and Home leaves unavailable sections empty. Successful Home results are cached for `HOME_CACHE_SECONDS` (default 600). See the verification report for the observed Google Books quota failure.

### Manual workflow in Swagger

1. Register a test account with `POST /api/v1/auth/register` (201).
2. Click **Authorize**. Use the account email as `username`, enter its password, and leave client ID/secret empty. Login uses form data; other write endpoints use JSON. Tokens expire after 30 minutes by default, so authorize again after expiry.
3. Search with `GET /api/v1/items?category=music&page=1&page_size=5` and copy an `external_id`.
4. Call `GET /api/v1/items/music/{external_id}`. Copy its numeric `data.id`, the local catalog item ID. Search results may have `id: null` until details are stored.
5. `POST /api/v1/saved-items/` with `{"item_id": <catalog ID>}` returns 201. Copy the returned `id`, the saved-item record ID.
6. `PATCH /api/v1/saved-items/{saved-item ID}` with `{"status":"completed"}` returns 200.
7. `POST /api/v1/reviews/` with `{"item_id": <catalog ID>, "rating":5, "review_text":"Test review"}` returns 201.
8. `GET /api/v1/reviews/?item_id=<catalog ID>` returns the review. Use the review's own `id` for editing/deleting it.

The catalog item ID, saved-item ID, review ID, and user ID are different identifiers even if some example numbers happen to match. Read **Server response**, not the example responses below it, to determine the actual result. A duplicate save/review returns 409. Creating a review requires the current user's completed saved item; unsaved/planned items return 403. Other users' private records cannot be modified. Existing reviews remain after unsaving or changing back to planned, and their authors can still edit/delete them.

### Tests and API specification

From the repository root:

```powershell
uv run pytest -q
uv run python scripts/export_openapi.py --check
```

The latest reported backend run completed with **236 passed and 1 warning**. The warning is a Starlette deprecation notice about its current `httpx` test-client integration; it did not fail the suite. The OpenAPI check also passed: `openapi.yaml matches the application.` The tests use isolated databases, generated test JWT secrets, and mocked providers. Coverage includes authentication, catalog behavior, saved-item workflows, access control, error cases, provider behavior, and OpenAPI validation. Rerun the checks in your own environment after installing dependencies.

Frontend checks (type checking, unit tests with coverage, the production build, and browser tests) all pass, and coverage meets the 50% minimum. The current numbers are kept in [frontend/UNIT_TESTS.md](frontend/UNIT_TESTS.md#latest-results) and [frontend/INTEGRATION_TESTS.md](frontend/INTEGRATION_TESTS.md#what-is-checked). The frontend has no `lint` script for now, because ESLint does not support TypeScript 7 yet; see the [frontend README](frontend/README.md#build-and-check-types).

`openapi.yaml` describes the implemented API and can be imported into Swagger Editor. After changing routes or schemas, regenerate and retest:

```powershell
uv run python scripts/export_openapi.py
uv run pytest -q
```

The export command reads the application schema without starting Uvicorn or initializing a database. Tests validate the YAML and compare it with the application's generated schema. Dependency upgrades may change the generated schema; review the diff before committing it.

To check that `uv.lock` still matches `pyproject.toml` without changing it, run `uv lock --check`. After changing dependencies in `pyproject.toml`, run `uv lock` and commit the updated `uv.lock`.

See [Backend verification and contract comparison](docs/backend-verification.md) for issue #25 evidence, known limitations, and differences from the original design. Success response shapes currently differ between route groups; clients should follow `openapi.yaml`. Errors use a shared envelope with a top-level request ID.

### Submission

Include source code, tests, `requirements.txt`, `pyproject.toml`, `uv.lock`, this README, `openapi.yaml`, and the verification report in the submission ZIP. Exclude `.venv`, `.env`, database files, caches, and Git metadata. `requirements.txt` lists dependencies; the virtual environment itself is not a submission artifact.

## Frontend

The Next.js frontend lives in [`frontend/`](frontend/README.md) and uses TypeScript, shadcn/ui, and Tailwind CSS. All planned pages are on `main`: Home (search, category links, featured items, and saving from the bookmark), Discover (search, filters, and pagination), Detail (item information, the Save button, and reviews), My Lists (Planned and Completed lists), Log In, Sign Up, and the shared guest login prompt.

My Lists provides a protected `/my-lists` page with Planned and Completed lists, saved-item counts, status changes, deletion, and loading/error states. The shared Save button is used on Detail, and Home's bookmark uses the same saved-items helpers. Known gaps planned for the final project, such as save buttons on Discover cards and links from My Lists to Detail, are listed in the [frontend README](frontend/README.md#known-gaps).

See the [frontend README](frontend/README.md) for setup, [project testing guide](docs/testing.md) for backend/frontend commands and manual My Lists checks, [frontend unit tests](frontend/UNIT_TESTS.md) and [frontend integration tests](frontend/INTEGRATION_TESTS.md) for frontend testing details, and the [frontend work division](frontend/InterestFinder_Frontend_Role_Division.md) for feature ownership. My Lists implementation details are documented in [docs/my-lists-implementation.md](docs/my-lists-implementation.md), and the saved-items API contract is in [docs/saved-items-api.md](docs/saved-items-api.md). Third-party UI license notices are in [frontend/THIRD_PARTY_NOTICES.md](frontend/THIRD_PARTY_NOTICES.md).