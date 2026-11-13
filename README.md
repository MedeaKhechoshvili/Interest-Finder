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

The interface follows a forest-green and cream editorial visual identity. The desktop and responsive mobile designs were created in Figma and will guide the React implementation.

## Development Plan

1. Front-end design and responsive layout
2. React implementation
3. Backend development
4. Database and API integration
5. Testing and deployment

## Team Workflow

Work is organized through GitHub Issues, milestones, and the Interest Finder Project Board. Feature work should be completed on a separate branch and submitted through a pull request for review before merging into the main branch.

## Backend Development

The backend uses FastAPI, SQLAlchemy, SQLite, Pydantic, and JWT authentication. It implements registration/login, public catalog discovery and details, personal planned/completed items, and public ratings/reviews. Routes are under `/api/v1`.

### Local setup (Windows PowerShell)

Run these commands in the repository folder. Using the virtual environment's Python directly avoids PowerShell activation-policy problems.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy the generated value into `JWT_SECRET_KEY` in your private `.env`. Only copy `.env.example` when first setting up: do not overwrite an existing configured `.env`. Never commit `.env`, tokens, passwords, or SQLite database files.

On macOS/Linux, use `python3 -m venv .venv`, `.venv/bin/python -m pip install -r requirements.txt`, and `cp .env.example .env`; use `.venv/bin/python` for the remaining Python commands. An alternative installation is `python -m pip install -e ".[dev]"` inside an activated environment. Python 3.11 or newer is required.

Start the server:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --app-dir src
```

- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>
- Generated OpenAPI: <http://localhost:8000/openapi.json>
- Health: <http://localhost:8000/api/v1/health>

The `/` path has no route and returns 404. Startup creates registered tables in `interestfinder.db`; it does not migrate existing table definitions. SQLite foreign-key enforcement is enabled on new SQLite connections. Keep development databases separate from tests.

### Provider configuration

| Category | Adapter | Private `.env` configuration |
| --- | --- | --- |
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

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts/export_openapi.py --check
```

The final verification run recorded **228 passed**, with one dependency deprecation warning from Starlette's use of `httpx`. This run used Python 3.12 on Linux; rerun on your own environment after installing dependencies. The tests use isolated databases, generated test JWT secrets, and mocked providers. Coverage includes the full registration → login → save → complete → review workflow, access control, error cases, provider behavior, and OpenAPI validation.

`openapi.yaml` describes the implemented API and can be imported into Swagger Editor. After changing routes or schemas, regenerate and retest:

```powershell
.\.venv\Scripts\python.exe scripts/export_openapi.py
.\.venv\Scripts\python.exe -m pytest -q
```

The export command reads the application schema without starting Uvicorn or initializing a database. Tests validate the YAML and compare it with the application's generated schema. Dependency upgrades may change the generated schema; review the diff before committing it. `uv.lock` is included for teams using uv.

See [Backend verification and contract comparison](docs/backend-verification.md) for issue #25 evidence, known limitations, and differences from the original design. Success response shapes currently differ between route groups; clients should follow `openapi.yaml`. Errors use a shared envelope with a top-level request ID.

### Submission

Include source code, tests, `requirements.txt`, `pyproject.toml`, `uv.lock`, this README, `openapi.yaml`, and the verification report in the submission ZIP. Exclude `.venv`, `.env`, database files, caches, and Git metadata. `requirements.txt` lists dependencies; the virtual environment itself is not a submission artifact.
