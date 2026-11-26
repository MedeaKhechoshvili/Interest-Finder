# Saved Items API response update

The saved-items API now returns the related catalog item's display information
inside a `catalog_item` object. This is a response-only enhancement: the
`SavedItem` and `CatalogItem` database tables and their relationships do not
change, so no database migration is required.

## Endpoints

- `GET /api/v1/saved-items/` — returns the current user's saved records.
- `POST /api/v1/saved-items/` — creates a saved record from `{ "item_id": 123 }`.
- `PATCH /api/v1/saved-items/{saved_item_id}` — changes its status.
- `DELETE /api/v1/saved-items/{saved_item_id}` — deletes the saved record (204).

The GET, POST, and PATCH response bodies include the existing saved-record
fields plus:

```json
{
  "catalog_item": {
    "id": 123,
    "category": "books",
    "provider": "google_books",
    "external_id": "provider-item-id",
    "title": "Example title",
    "description": "Optional description",
    "image_url": "https://example.invalid/image.jpg",
    "year_or_date": "2024"
  }
}
```

The nested object is called `catalog_item` to distinguish the catalog row from
the saved-record `id`. `item_id` remains in the response for backward
compatibility and still contains the internal catalog ID. The path parameter
`saved_item_id` still identifies the saved record for PATCH and DELETE.

The Next.js `/api/backend` proxy forwards these response fields without
reshaping them. The frontend TypeScript `SavedItem` type mirrors the new
contract, and My Lists reads its title, category, description, date, and image
from `item.catalog_item`.
