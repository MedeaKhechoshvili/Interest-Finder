# Sivan's My Lists implementation

This project includes Sivan's My Lists frontend feature and a backward-compatible
backend response enhancement so the frontend can display actual catalog titles
and images instead of only internal item numbers.

## What the feature does

- Protects `/my-lists` with the existing session check.
- Shows the current user's Planned and Completed saved items.
- Displays catalog title, category, optional description, optional year/date,
  and optional image.
- Lets the user change Planned/Completed status and remove a saved record.
- Provides loading, empty, error, and operation feedback.
- Provides a reusable Save Button for other frontend feature pages.

## Backend response enhancement

The saved-items GET, POST, and PATCH endpoints now include a nested
`catalog_item` object in each response. It contains the internal catalog ID,
category, provider, external provider ID, title, description, image URL, and
year/date. Existing saved-record fields remain unchanged, including `id`,
`item_id`, `status`, and timestamps.

The distinction between identifiers is important:

- `catalog_item.id` and `item_id` identify the catalog item.
- `id` on the outer response identifies the user's saved record.
- PATCH and DELETE continue to use the saved-record ID in the URL.

The change uses the existing `SavedItem.catalog_item` SQLAlchemy relationship.
It does not add or change database columns, tables, or constraints, so it does
not require a database migration. The GET and PATCH queries eager-load the
catalog relationship to avoid making one extra query for every saved row.

## Frontend/API contract

The Next.js `/api/backend` route forwards backend response JSON without
reshaping it. `frontend/src/lib/saved-items.ts` defines the matching
`SavedCatalogItem` and `SavedItem` TypeScript interfaces. The My Lists component
reads display fields from `item.catalog_item`.

The reusable Save Button still sends the internal numeric catalog ID in the
POST body. If a caller only has a provider ID, it first calls the existing
catalog detail endpoint to resolve the internal ID.

## Files changed

- `src/app/api/v1/saved_items.py`
- `src/app/schemas/saved_item.py`
- `tests/test_saved_items.py`
- `openapi.yaml`
- `docs/saved-items-api.md`
- `frontend/src/app/api/backend/[...path]/route.ts`
- `frontend/src/app/my-lists/page.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/components/my-lists-client.tsx`
- `frontend/src/components/save-button.tsx`
- `frontend/src/lib/saved-items.ts`

## Running and checking the project

Run the backend from the repository root with the project's virtual
environment activated:

```powershell
python -m uvicorn app.main:app --reload --app-dir src
```

Run the frontend from `frontend` in a second terminal:

```powershell
npm ci
npm run dev
```

Run the backend test suite from the repository root:

```powershell
python -m pytest
```

Check that the checked-in OpenAPI file matches the API code:

```powershell
python scripts/export_openapi.py --check
```

The test and build commands must be run in the user's configured environment.
This implementation was syntax-checked and its nested Pydantic response schema
was validated in the build environment, but the complete pytest suite and
Next.js build were not run here because required dependencies were unavailable
and network package installation was not possible.
