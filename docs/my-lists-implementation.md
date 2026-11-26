# Sivan's My Lists implementation

This project includes the My Lists frontend feature and a backward-compatible
backend response enhancement so the frontend can display catalog details
instead of only internal item numbers.

## What the feature does

- Protects `/my-lists` with the existing session check.
- Shows the current user's Planned and Completed saved items.
- Displays catalog title, category, optional description, optional year/date,
  and optional image.
- Lets the user change Planned/Completed status and remove a saved record.
- Provides loading, empty, error, and operation feedback.
- Provides a reusable Save Button for other frontend feature pages.

## Backend response enhancement

The saved-items GET, POST, and PATCH endpoints include a nested `catalog_item`
object in each response. It contains the internal catalog ID, category,
provider, external provider ID, title, description, image URL, and year/date.
Existing saved-record fields remain unchanged, including `id`, `item_id`,
`status`, and timestamps.

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

The reusable Save Button sends the internal numeric catalog ID in the POST
body. If a caller only has a provider ID, it first calls the existing catalog
detail endpoint to resolve the internal ID. The Save Button is reusable by
other feature pages; verify its Discover and Item Detail integrations
separately before claiming those integrations are complete.

## Files in this feature

- `src/app/api/v1/saved_items.py`
- `src/app/schemas/saved_item.py`
- `tests/test_saved_items.py`
- `tests/test_my_lists_workflow.py`
- `scripts/create_test_catalog_item.py`
- `openapi.yaml`
- `docs/saved-items-api.md`
- `frontend/src/app/my-lists/page.tsx`
- `frontend/src/app/globals.css`
- `frontend/src/components/my-lists-client.tsx`
- `frontend/src/components/save-button.tsx`
- `frontend/src/lib/saved-items.ts`
- `frontend/tests/unit/saved-items/saved-items.test.ts`
- `frontend/tests/unit/saved-items/save-button.test.tsx`
- `frontend/tests/unit/saved-items/my-lists-client.test.tsx`

## Testing

Run the My Lists frontend unit/component tests from `frontend/`:

```powershell
npm.cmd test -- tests/unit/saved-items
```

The three feature test files cover API helper validation and ID resolution,
Save Button behavior, and the Planned/Completed My Lists interface, including
loading, empty, error, status-change, and deletion behavior.

Run all frontend unit/component tests and the configured coverage thresholds:

```powershell
npm.cmd test
npm.cmd run test:coverage
```

Run backend tests and validate the OpenAPI specification from the repository
root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts/export_openapi.py --check
```

For complete environment setup, browser integration tests, manual testing,
and pull request checks, see the repository [testing guide](../TESTING.md).
The broader frontend test instructions are in
[UNIT_TESTS.md](../frontend/UNIT_TESTS.md) and
[INTEGRATION_TESTS.md](../frontend/INTEGRATION_TESTS.md).

Test results are environment-dependent. Record the actual command output from
the current branch when preparing a pull request; do not treat a test file's
presence or a previous run as evidence that the current version passes.