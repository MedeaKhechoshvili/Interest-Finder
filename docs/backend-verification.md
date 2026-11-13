# InterestFinder backend verification — issue #25

Team: Medea Khechoshvili, Sivan Garcia, Yousuf Shaaya, Nathan Patel, Bishal Chaudhari.

## Scope and result

This report records verification of the combined FastAPI backend based on main commit `49fcef76ed02b016635d2fda0e08164b2e00c257`, plus the changes in this pull request. The baseline suite passed 195 tests. The final suite passes **228 tests**, with one existing Starlette/httpx deprecation warning. Tests ran on Python 3.12/Linux with isolated SQLite databases and mocked provider responses. Passing tests demonstrate the covered behavior; they are not a production security audit or a live-provider availability guarantee.

## Issue checklist and evidence

| Task | Evidence |
| --- | --- |
| Registered feature routers and Swagger | `test_catalog_app.py`, `test_openapi.py`; generated YAML includes health, authentication, home, catalog, saved items, reviews |
| Complete pytest suite | `python -m pytest -q`: 228 passed, 1 warning |
| Registration/login → save → complete → review | `test_saved_items.py`: real password hashing/JWT, isolated SQLite, response and committed-record assertions |
| Guest restrictions | `test_final_verification.py`: all eight protected operations reject missing credentials with 401 |
| Ownership restrictions | Same file: a second user cannot PATCH/DELETE another user's saved items or reviews; records stay unchanged |
| Invalid input, missing records, duplicates | Same file plus `test_review_updates.py`, `test_auth.py`: 400/401/403/404/409/422; shared errors, safe validation details, unchanged records after rejection |
| Provider failures | `test_provider_errors.py`, provider-specific tests, `test_catalog_service.py`, `test_catalog_routes.py`: mocked upstream responses, timeouts, malformed data and fallback behavior |
| Manual Swagger verification | Prior user-run local session summarized below; not rerun against live providers during this review |
| OpenAPI comparison | Comparison below; generated `openapi.yaml` validated with `openapi-spec-validator` and compared to application schema |
| Bugs and fixes | Findings below; fixes and regression tests are included in this pull request |
| README | Updated setup, credentials, provider configuration, test commands, workflow, YAML export and submission guidance |

## Findings fixed

1. Review creation previously checked item existence and duplicates but did not enforce completion. It now requires a saved record belonging to the authenticated user with status `completed`; otherwise it returns 403. A different user's completed record does not qualify.
2. Validation error details could echo submitted values, including invalid passwords. The handler now removes `input` and `ctx` while retaining useful field locations/messages. A regression test checks that the submitted password is absent.
3. Swagger did not describe the actual shared error envelopes for expected application errors; login had an uninformative generic response. OpenAPI now documents the relevant errors and a token response model. Optional review-update ratings are documented as non-null when supplied, matching runtime validation.
4. Some smoke tests could initialize the configured development database at startup. The shared test fixture disables that startup action; database tests create their own database and override the dependency. Test JWT secrets are generated independently of local credentials.

Completion is required at initial review creation. Existing reviews are retained if an item is later unsaved or reset to planned; owners may still edit/delete those reviews. This documents the implemented retention behavior.

## Manual Swagger evidence already collected

These are the results supplied from the user's local Swagger session before this final code review. They establish observed behavior at that time; they are separate from the current automated run.

| Check | Observed result |
| --- | --- |
| Health | 200 with `status: ok` and a request ID |
| Registration | 201; registering an existing email returned 409 |
| Login/authorized current-user request | User reported 200 responses |
| Music search | 200 with five MusicBrainz results and pagination metadata |
| Save item | 201 with saved record ID 1, user ID 4, catalog item ID 1, planned status |
| Mark completed | User reported 200 |
| Create/read review | Creation reported successful; GET returned 200 with review ID 1, item ID 1, rating 5 and `Test review` |
| Invalid/expired authorization | 401 with `Could not validate credentials` |
| Google Books search | 502 `PROVIDER_UNAVAILABLE`, with upstream status 429; request ID `9cb9a03d-314d-473b-bade-7b8099a59096` |

The Google Books result is an external quota/rate-limit failure, not a successful live books test. Provider failure handling is tested with mocks. A later live books success requires valid configuration and available provider quota. No live success is claimed here for movies or attractions.

## Original design versus implemented contract

Comparison baseline: the earlier assignment's OpenAPI 3.0.3 YAML (version dated 2026-10-12). The repository's new OpenAPI 3.1 YAML is generated from the implementation. This comparison records differences; it does not imply that the earlier design was implemented exactly or that the team has approved every deviation.

All paths below are relative to `/api/v1`.

| Area | Earlier design | Current implementation / frontend impact |
| --- | --- | --- |
| Saved-item URLs | `/me/saved-items` | `/saved-items/`; PATCH/DELETE use `/saved-items/{saved_item_id}` |
| Save request | Category, provider, external ID | Numeric `item_id`; fetch catalog details first to persist the item and obtain `data.id` |
| Review collection | GET/POST `/items/{item_id}/reviews` | GET/POST `/reviews/`; item ID is a GET query parameter or POST body field; GET `/reviews/{review_id}` also exists |
| Review eligibility | Completed saved item required | Now enforced at creation with 403 on failure |
| Saved/review responses | `data` envelope, richer nested item/author information | Bare rows or arrays; reviews return `user_id`, saved rows return `item_id`; clients need catalog data separately |
| Saved/review pagination | Page/page-size metadata | Not implemented; saved lists accept status, review lists accept item/user filters |
| Catalog category | Includes `all` | Omit category to search all; accepted category values are movies/books/music/attractions |
| Catalog filters | Sorting, genres, year ranges, languages and other category filters | q/category/page/page_size plus year (movies), author/subject (books), artist (music), city (attractions); other proposed filters are not implemented |
| Catalog pagination | Paginated results | Implemented; page 1–500, page_size 1–50 |
| Detail response | Source URL and category-specific typed detail schemas | Generic `details` object; source URL is not exposed; local numeric ID returned after storage |
| Home | Popular, recommended, category highlights; optional personalization | Public `data.sections`; no user personalization |
| Registration | Password confirmation and richer user output | Confirmation is not an API field; UI must confirm before submission. Public response has id/full_name/email/is_active |
| Login | OAuth password flow | Form-encoded username=email/password; token response explicitly documented |
| Errors | Request ID nested inside error | Top-level `request_id`, error code/message/details; validation details omit submitted values |
| Success envelope | Consistent `data` wrapper | Health/home/catalog use wrappers; auth/saved/reviews use direct objects/arrays |
| Community aggregates | Average rating and review count | Catalog fields remain placeholders; they are not calculated from local reviews |
| Timestamp representation | ISO 8601 | Serialized datetime strings; SQLite may return naive timestamps without a UTC offset |

## Remaining limitations and follow-up decisions

- Frontend integration must use the implemented paths and bodies above, or the team must explicitly choose to restore the original contract. A synchronized YAML records actual behavior but does not implement missing design features.
- Saved/review list pagination, community aggregates, advanced filters, personalization and consistent success envelopes remain design gaps. They are recorded follow-up work rather than silently claimed as complete.
- API credentials and provider quota must be checked for a live demonstration. Automated provider tests are deliberately independent of external services.
- The existing Starlette/httpx deprecation warning does not fail the suite. Dependency upgrades should be tested together; this change does not replace the HTTP client stack.
- This local class backend has no login rate limiter, refresh-token/revocation flow, or admin moderation routes. Use a strong private JWT secret; production rejects known example placeholders. Deployment hardening is outside the verification completed here.

Issue #25 can be closed after the verification pull request is reviewed and merged, with the above deviations retained in the project record. If the instructor requires exact conformity to the earlier contract, the corresponding design gaps need implementation before claiming that broader requirement is complete.
