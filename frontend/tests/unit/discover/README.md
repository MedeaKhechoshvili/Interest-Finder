# Discover unit tests

Owner: Nathan.

These tests use mocked API responses. They do not need the backend.

| File                        | What it checks                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `catalog.test.ts`           | URL parameter reading and limits, URL and API path building, detail links, rating scale labels, category subtitles, year validation |
| `item-card.test.tsx`        | Detail link, displayed fields, plain-text descriptions, image fallback (missing and failed images), action slot, image loading      |
| `discover-form.test.tsx`    | Search submission, category buttons, category-specific filters, year validation and error wiring, clearing, following URL changes   |
| `discover-results.test.tsx` | API request path, loading, results summary, empty results, provider errors and retry, stale responses, pagination links and limits  |
| `discover-page.test.tsx`    | The page passes the URL search to the form and results                                                                              |

`fixtures.ts` builds catalog items and responses in the backend format.

Run only these tests from `frontend/`:

```bash
npm test -- tests/unit/discover
```

See [the team testing guide](../../README.md) for shared rules.
