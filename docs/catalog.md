# Catalog, Search, and Item Details

Owner: Nathan Patel

This document covers the public discovery features: the external provider
adapters, the normalized item format, search and filters, pagination, home page
content, item details, and what happens when a provider fails.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/home` | Public | Featured items for each category |
| GET | `/api/v1/items` | Public | Search one category or all categories |
| GET | `/api/v1/items/{category}/{external_id}` | Public | One item's details |

## External providers

| Category | Provider value | API | Authentication | Item id used as `external_id` |
| --- | --- | --- | --- | --- |
| movies | `tmdb` | The Movie Database (TMDB) v3 | Read Access Token sent as `Authorization: Bearer` | TMDB movie id (digits) |
| books | `google_books` | Google Books API v1 | API key sent as `key` (optional at low volume) | Google volume id |
| music | `musicbrainz` | MusicBrainz web service v2 | No key; a descriptive `User-Agent` is required | Release-group MBID (UUID) |
| attractions | `opentripmap` | OpenTripMap places API 0.1 | API key sent as `apikey` | OpenTripMap `xid` |

Provider notes:

- **TMDB** search uses `/search/movie`; browsing without search text uses
  `/discover/movie` sorted by popularity; the home page uses
  `/trending/movie/week`. TMDB returns fixed 20-item pages and stops at page 500.
- **Google Books** search uses `/volumes` with `startIndex` and `maxResults`
  (at most 40 per request; larger pages are split into several requests).
  Image links are upgraded from `http://` to `https://`, and HTML is removed
  from descriptions. Browsing without search text uses `subject:fiction`.
- **MusicBrainz** searches release groups (albums, EPs, singles). Requests are
  limited to about one per second, as MusicBrainz requires. Album art comes
  from the Cover Art Archive; some albums have no cover, so the frontend
  should show a placeholder if the image fails to load.
- **OpenTripMap** searches by location in two steps: the city name is turned
  into coordinates (`/geoname`), then places within 15 km are found
  (`/autosuggest` when there is search text, otherwise `/radius` limited to
  notable places). Unnamed places and duplicates are removed. Search results
  contain only a name, location, and kinds; the description and image come
  from the details endpoint (`/xid/{xid}`).

## Configuration

All provider settings are environment variables (see `.env.example`). Keys are
never committed and never appear in API responses or error messages. httpx
request logging is lowered to WARNING so URLs containing keys are not logged.

| Variable | Default | Purpose |
| --- | --- | --- |
| `TMDB_ACCESS_TOKEN` | empty | TMDB Read Access Token |
| `GOOGLE_BOOKS_API_KEY` | empty | Google Books API key |
| `OPENTRIPMAP_API_KEY` | empty | OpenTripMap API key |
| `MUSICBRAINZ_USER_AGENT` | `InterestFinder/0.1 ( repo URL )` | Identifies the app to MusicBrainz |
| `PROVIDER_TIMEOUT_SECONDS` | `5` | Timeout for each provider request |
| `MUSICBRAINZ_MIN_INTERVAL_SECONDS` | `1.0` | Minimum time between MusicBrainz requests |
| `DEFAULT_ATTRACTIONS_CITY` | `San Diego` | City used for attractions when no `city` filter is given |
| `HOME_CACHE_SECONDS` | `600` | How long home page content is reused |

## Normalized item format

Every provider response is converted into `CatalogItemOut`
(`src/app/schemas/catalog.py`). Provider-specific JSON is never returned.

| Field | Movies (TMDB) | Books (Google Books) | Music (MusicBrainz) | Attractions (OpenTripMap) |
| --- | --- | --- | --- | --- |
| `external_id` | `id` | `id` | `id` (MBID) | `xid` |
| `title` | `title` | `volumeInfo.title` | `title` | `name` |
| `description` | `overview` | `volumeInfo.description` (HTML removed) | "Album by Artist" | `wikipedia_extracts.text` (details only) |
| `image_url` | image base URL + `poster_path` | `imageLinks.thumbnail` (https) | Cover Art Archive URL | `preview.source` (details only) |
| `year_or_date` | `release_date` | `publishedDate` (may be a year only) | `first-release-date` | not provided |
| `source_rating` | `vote_average` (0-10) | `averageRating` (1-5) | `rating.value` (0-5, details only) | not provided* |
| `source_rating_count` | `vote_count` | `ratingsCount` | `rating.votes-count` | not provided |
| `details` | runtime_minutes, genres, tagline, original_language | authors, subtitle, publisher, page_count, subjects, isbn_13 | artist, release_type, tags | kinds, city, country, latitude, longitude, wikipedia_url |

\* OpenTripMap's `rate` is a popularity score, not a user rating, so it is not
reported as `source_rating`.

Rules applied to every provider:

- `external_id` is always a string.
- Empty strings from providers become `null`.
- A result without an id or a title is skipped, so one bad result never breaks
  a whole search.
- `community_rating` and `community_review_count` come from InterestFinder
  reviews, not from providers.

## Fields stored locally

When a user opens an item (`GET /items/{category}/{external_id}`), the item is
saved to the shared `CatalogItem` table (`src/app/repositories/catalog.py`).
This gives it an InterestFinder `id`, which saved items and reviews use as
`catalog_item_id`.

Stored: `category`, `provider`, `external_id`, `title`, `description`,
`image_url`, `year_or_date`, `source_rating`, `source_rating_count`, and
`updated_at`. The provider/category/external_id combination is unique, so
opening an item again updates the same row. Category `details` are currently
returned from the provider but not stored.

The stored copy doubles as a small cache: if the provider is down (a 502
error) and the item was opened before, the stored copy is returned instead of
an error. Search results are not stored.

## Search and filters

`GET /api/v1/items` query parameters:

| Parameter | Applies to | Rules |
| --- | --- | --- |
| `q` | all | Optional search text, up to 200 characters. Without it, popular or featured items are listed. |
| `category` | all | `movies`, `books`, `music`, or `attractions`. Omit to search all categories. |
| `page` | all | Default 1, minimum 1, maximum 500 |
| `page_size` | all | Default 20, minimum 1, maximum 50 |
| `year` | movies | Release year (1800-2100) |
| `author` | books | Author name |
| `subject` | books | Subject or genre |
| `artist` | music | Artist name |
| `city` | attractions | City to search in (default: `DEFAULT_ATTRACTIONS_CITY`) |

Category-specific filters only affect their own provider. For example,
`?author=Austen` narrows book results and is ignored by the other providers.

Searching all categories calls every provider at the same time. Each provider
returns its share of the page (`page_size` divided by 4, rounded up), and the
results are interleaved: movie, book, album, place, movie, and so on.

Invalid parameters (an unknown category, `page_size` above 50, `page` below 1)
return `422 VALIDATION_ERROR` in the standard error format. On the details
endpoint, an unknown category in the URL returns 404 because the URL does not
match any route.

## Pagination

Responses use the shared format:

```json
{
  "data": [],
  "meta": {"page": 1, "page_size": 20, "total": 100, "has_next": true},
  "request_id": "abc123"
}
```

`has_next` is `page * page_size < total`. Providers paginate differently, and
each adapter converts `page`/`page_size` to the provider's own system:

| Provider | Provider pagination | How it is converted |
| --- | --- | --- |
| TMDB | Fixed 20-item pages | The needed TMDB pages are fetched and the exact items are sliced out |
| Google Books | `startIndex` + `maxResults` (max 40) | `startIndex = (page - 1) * page_size`; large pages are split |
| MusicBrainz | `offset` + `limit` | `offset = (page - 1) * page_size` |
| OpenTripMap | `limit` only | Enough results are fetched to cover the page, then sliced |

`total` comes from each provider and is approximate for some of them:
TMDB totals are capped at what is reachable (10,000 movies), Google Books totals
are estimates, OpenTripMap totals count only the named places that were
fetched, and the all-category total is the sum of every provider's total.

## Home content

`GET /api/v1/home` returns one section per category with up to 8 items each:
trending movies (TMDB weekly trending), books (`subject:fiction`), albums,
and notable attractions in the default city. All four providers are called at
the same time, and the result is cached in memory for `HOME_CACHE_SECONDS`.

## Provider failure behavior

Every adapter makes requests through one helper (`_get_json` in
`src/app/services/providers/base.py`), so failures are handled the same way for
all providers and returned in the standard error format.

| Situation | Status | Error code |
| --- | --- | --- |
| Provider does not answer within the timeout | 502 | `PROVIDER_TIMEOUT` |
| Provider cannot be reached, or returns 401/429/5xx | 502 | `PROVIDER_UNAVAILABLE` (`details.status_code` holds the provider's status) |
| Provider returns something that is not usable JSON, or an item with no title/id | 502 | `PROVIDER_INVALID_RESPONSE` |
| Provider says the item does not exist, or the id format is invalid | 404 | `ITEM_NOT_FOUND` |
| OpenTripMap cannot find the requested city | 400 | `INVALID_FILTER` |

How failures affect each endpoint:

- **Search one category:** the provider's error is returned.
- **Search all categories:** results from the working providers are returned
  and the failure is logged. An error is returned only if every provider fails.
- **Item details:** the stored copy is returned if one exists; otherwise the
  error is returned.
- **Home:** the failed section is returned with an empty `items` list so the
  rest of the page still loads. A page with a failed section is not cached.

## Code structure

```
src/app/
  schemas/catalog.py              Normalized request/response models
  services/catalog.py             Search, pagination, details, home, partial failures
  services/providers/config.py    Provider settings from environment variables
  services/providers/base.py      Adapter interface and shared error handling
  services/providers/tmdb.py
  services/providers/google_books.py
  services/providers/musicbrainz.py
  services/providers/opentripmap.py
  repositories/catalog.py         Stores opened items in CatalogItem
  routes/catalog.py               GET /items and GET /items/{category}/{external_id}
  routes/home.py                  GET /home
scripts/try_providers.py          Manual check against the real APIs
```

## Tests

All catalog tests use saved provider responses (`tests/fixtures/`) or fake
providers, so they never call real APIs.

| File | Covers |
| --- | --- |
| `test_provider_errors.py` | Timeouts, unreachable providers, error statuses, 404s, invalid JSON, keys never leaked |
| `test_provider_tmdb.py` | Movie mapping, search, pagination across TMDB pages, details, trending |
| `test_provider_google_books.py` | Book mapping, query building, split pagination, missing key |
| `test_provider_musicbrainz.py` | Album mapping, artist credits, offsets, User-Agent, invalid ids |
| `test_provider_opentripmap.py` | City lookup, autosuggest vs radius, unnamed places, unknown cities |
| `test_catalog_service.py` | Category filtering, all-category search, partial failures, details storage and fallback, home caching |
| `test_catalog_routes.py` | Response format, validation errors, invalid categories, 404/502 responses, route conflicts |

Run them with:

```bash
pytest tests/test_provider_*.py tests/test_catalog_*.py -v
```

To check the real providers with your own keys:

```bash
python scripts/try_providers.py
```
