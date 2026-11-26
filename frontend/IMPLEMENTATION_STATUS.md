# Frontend implementation status

Wednesday checkpoint. Maintained by Nathan from information each owner supplies.
Only implemented and verified work is listed as complete. Each owner should
send their row, checks, and evidence; Nathan merges them here.

## Summary by feature

| Feature                                          | Owner  | Status                                   | Evidence                                               |
| ------------------------------------------------ | ------ | ---------------------------------------- | ------------------------------------------------------ |
| Foundation, auth, layout                         | Medea  | Merged to `main`                         | Owner to supply. Existing unit suite: 71 tests passing |
| Home                                             | Medea  | Owner to supply                          | Owner to supply                                        |
| Discover, search, filters, pagination, item card | Nathan | Implemented on `feature/nathan-discover` | See below                                              |
| My Lists and save button                         | Sivan  | Owner to supply                          | Owner to supply                                        |
| Ratings and reviews                              | Yousuf | Owner to supply                          | Owner to supply                                        |
| Item Detail                                      | Bishal | Owner to supply                          | Owner to supply                                        |

## Discover (Nathan)

### Working

- `/discover` with text search, category buttons (All, Movies, Books, Music,
  Attractions), and category-specific filters: release year (movies), author
  and subject (books), artist (music), and city (attractions).
- Search, category, filters, and page are kept in the URL, so links, reloads,
  and the back/forward buttons keep the search.
- Results load through the shared `apiRequest()` helper and the Next.js proxy
  from `GET /api/v1/items`, 20 per page, with Previous/Next pagination.
- Loading, empty, error (with the provider's message and a retry button), and
  results states. An all-category search still shows results when one
  provider fails, because the backend returns the other providers' results.
- Year validation before searching (four digits, 1800 to 2100), with the
  error linked to its field for screen readers.
- A "Clear search" link, and "Remove filters" on empty filtered results.
- Shared `ItemCard` with category label, title link to Detail, category line
  (author, artist, or city plus year), provider rating with its scale and
  source (for example "8.4/10 on TMDB"), and a three-line description.
- A placeholder image when an item has no image or its image fails to load.
- Responsive layout: four or more columns on desktop, two on phones, with no
  horizontal scrolling at 390 px wide.
- Descriptions are rendered as plain text.

### Shared contracts for other owners

**Discover URL parameters** (Home links use these):

| Parameter           | Values                                                     |
| ------------------- | ---------------------------------------------------------- |
| `q`                 | Search text, up to 200 characters                          |
| `category`          | `movies`, `books`, `music`, or `attractions`. Omit for all |
| `page`              | 1 to 500. Omit for page 1                                  |
| `year`              | Movies only, four digits                                   |
| `author`, `subject` | Books only                                                 |
| `artist`            | Music only                                                 |
| `city`              | Attractions only                                           |

Examples: `/discover?category=movies`, `/discover?q=dune&category=books`.
Use `discoverUrl()` from `src/lib/catalog.ts` to build them.

**Item card** (`src/components/item-card.tsx`):

```tsx
<ItemCard item={item} actions={<SaveButton ... />} eagerImage={false} />
```

| Prop         | Type                 | Purpose                                                                                                    |
| ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `item`       | `CatalogItem`        | One item from `data` in a catalog response                                                                 |
| `actions`    | React node, optional | Controls shown under the description, such as Sivan's save button. They stay clickable above the card link |
| `eagerImage` | boolean, optional    | Load the image immediately (use for the first few cards)                                                   |

`CatalogItem`, `ItemsResponse`, `itemHref()`, and `providerRatingText()` are in
`src/lib/catalog.ts`. Detail links are `/items/{category}/{external_id}`.
Search results have `id: null` until the item's Detail page has been opened,
so save and review controls must get the local id from the Detail endpoint.

### Checks run

Run inside `frontend/` on `feature/nathan-discover` (which includes Medea's
test setup):

| Check                   | Result                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `npm test`              | 139 tests passed (68 Discover, 71 existing)                                                                                   |
| `npm run test:coverage` | Lines 91.17%, statements 91.17%, branches 93.71%, functions 83.33% for all application code. Discover files: 94 to 100% lines |
| `npm run typecheck`     | Passed                                                                                                                        |
| `npm run lint`          | Passed                                                                                                                        |
| `npm run build`         | Passed                                                                                                                        |

**Mocked vs real backend:** the Discover unit tests mock `apiRequest()`. A
separate manual browser check ran the production build against the real
FastAPI app and the real Next.js proxy, with the external providers replaced
by stand-in data (the check environment had no internet access). It covered
search, category changes, pagination, back navigation, year validation, card
links, empty results, a provider error, and partial failure in an
all-category search, on desktop (1280 px) and iPhone 13 sizes. This is not an
automated integration test.

### Unfinished and dependencies

- **Discover integration test** (`tests/integration/discover`): not written.
  The shared test API launcher does not provide catalog search data, and
  real provider calls need API keys. Needs agreement with Medea on adding a
  catalog fixture to the launcher.
- **Save button on cards**: the card has an `actions` slot, but Sivan's save
  button is not merged yet, so Discover does not show it.
- **Detail page**: card links go to `/items/{category}/{external_id}`, which
  returns 404 until Bishal's page is merged.
- **Figma comparison**: the layout follows the shared theme. It still needs a
  side-by-side check against the Discover and card Figma screens.
- **Totals**: "of N results" uses the backend's totals, which are approximate
  for some providers and for all-category searches.
