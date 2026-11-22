# InterestFinder Frontend Work Division

**Course:** COMPE 561
**Team:** Medea Khechoshvili, Sivan Garcia, Yousuf Shaaya, Nathan Patel, Bishal Chaudhari
**Current milestone:** Wednesday frontend implementation checkpoint

## 1. Scope and priorities

Build the InterestFinder frontend using Next.js, TypeScript, shadcn/ui, and Tailwind CSS, following the existing desktop and mobile Figma designs. Connect implemented features to the existing FastAPI backend through the shared Next.js API helpers.

## 2. Ownership summary

| Member | Implementation ownership | Additional responsibility |
| --- | --- | --- |
| Medea Khechoshvili | Frontend foundation, shared layout, authentication, API helpers, and Home | Shared frontend test configuration and coverage command |
| Sivan Garcia | My Lists, saved-item state, and shared save controls | Verify the save-to-completion workflow |
| Yousuf Shaaya | Rating and review components and actions | Coordinate and implement the combined frontend/backend user-flow integration test |
| Nathan Patel | Discover, search, supported filters, pagination, and shared item cards | Consolidate submission documentation, contribution records, and test evidence |
| Bishal Chaudhari | Item Detail and category-specific information | Integrate save/review components on Detail and coordinate the demonstration order |

Everyone writes tests for their own code, checks responsive behavior, supplies their own contribution notes, and fixes defects in their own feature. Nathan consolidates the written submission; Bishal is not responsible for documentation.

All implementation paths below are relative to `frontend/`.

## 3. Medea Khechoshvili — Foundation, authentication, and Home

### Existing work and continuing ownership

- Maintain the Next.js App Router project, TypeScript configuration, and Tailwind setup.
- Add shadcn/ui and establish the shared component conventions. Other members use those components within their own features.
- Maintain shared colors, typography, spacing, header, footer, and mobile navigation.
- Maintain registration, login, account, and logout functionality.
- Maintain server-side session cookies, session checking, protected-page access, session-expiry handling, and return navigation after login.
- Maintain the Next.js authentication handlers, API proxy, and shared request/session helpers.
- Maintain shared loading, error, and not-found screens.
- Maintain the frontend environment example and technical setup commands. Nathan consolidates these into the submission documentation.

### Remaining Home implementation

- Build Home from the supplied design.
- Load the available Home sections from the backend.
- Connect search and category links to Discover using the agreed URL parameters.
- Reuse Nathan's item card and link items to Detail.
- Handle loading, empty sections, provider failures, and missing images.
- Support desktop and mobile layouts.

### Main files

- Shared project configuration, `.env.example`, and shadcn configuration.
- `src/app/layout.tsx`, `src/app/globals.css`, and `src/app/page.tsx`.
- `src/app/login/`, `src/app/register/`, and `src/app/account/`.
- `src/app/api/`, shared files in `src/lib/`, and shared UI setup.
- Header, footer, authentication forms, and logout components.

### Testing and Wednesday handoff

- Maintain the shared unit/component test setup and coverage command.
- Test authentication validation, login/logout behavior, protected access, request helpers, navigation, and Home behavior as implemented.
- Provide working shared helpers and explain their usage to the team.
- Submit the current Home implementation and identify any unfinished sections.

## 4. Sivan Garcia — My Lists and saved-item controls

### Implementation

- Build `/my-lists` from the supplied design and retain its protected-access behavior.
- Display planned and completed items in separate views.
- Build a shared save button for item cards and Detail.
- Add saving, marking completed, moving back to planned, and removal with confirmation.
- Keep displayed state accurate after successful or failed changes.
- Handle duplicate saves, empty lists, expired sessions, and API errors.
- Add list filtering or sorting only where supported by the available API/data; label any filtering limited to currently loaded results.
- Make the page and controls responsive and keyboard accessible.

### Main files

- `src/app/my-lists/page.tsx`.
- `src/components/save-button.tsx`.
- Supporting saved-item components and tests.

### API ownership

- GET and POST `/api/v1/saved-items/`.
- PATCH and DELETE `/api/v1/saved-items/{saved_item_id}`.

### Dependencies and testing

- Agree on save-button props with Nathan and Bishal before they integrate it.
- Resolve the local catalog ID through the Detail endpoint when a search result has `id: null`; never send a null or external ID as `item_id`.
- Confirm how catalog information will be obtained for saved-item cards if saved-item responses contain only IDs and status fields. Report a missing backend lookup requirement rather than inventing an endpoint.
- Test saves, duplicate actions, status changes, removal, guest behavior, and failed-request recovery.
- For Wednesday, prioritize loading the list and completing a working save/status-change flow; list any remaining controls.

## 5. Yousuf Shaaya — Ratings, reviews, and integration testing

### Implementation

- Build a reusable review panel for Bishal's Detail page.
- Display the item's public reviews and an empty-review state.
- Add rating selection and review-text entry with validation.
- Allow review creation for completed items, with the backend enforcing eligibility.
- Show edit/delete controls for the current user's own reviews and implement those actions.
- Prompt guests to log in before protected actions.
- Handle duplicate reviews, failed requests, loading states, and expired sessions.
- Keep InterestFinder user ratings separate from provider ratings and label their scales.

### Main files

- `src/components/reviews/` and supporting rating components.
- Review-specific helpers/types and tests.
- The combined frontend/backend integration test, under the agreed test directory.

### API ownership

- GET `/api/v1/reviews/?item_id={item_id}`.
- POST `/api/v1/reviews/`.
- GET, PATCH, and DELETE `/api/v1/reviews/{review_id}` as needed.

### Dependencies and testing

- Agree with Bishal on a review-panel interface using the local catalog ID and the needed session/completion information.
- Coordinate with Sivan on displaying review eligibility after completion changes.
- Test review rendering, validation, author controls, completion requirements, and failed mutations.
- Implement the combined integration test as the relevant pages become available: registration/login → search → Detail → save → complete → review → logout.
- The integration test must exercise the real Next.js-to-FastAPI connection in an isolated test environment. A fully mocked test does not prove that connection.
- For Wednesday, prioritize public review display and a working create-review flow; record any unavailable integration steps.

## 6. Nathan Patel — Discover, shared cards, and documentation coordination

### Implementation

- Build `/discover` from the supplied design.
- Add search, category selection, supported category-specific filters, pagination, and reset behavior.
- Keep search, filters, and page state in the URL using agreed parameter names.
- Build the shared item card used by Discover and Home; coordinate reuse in My Lists where appropriate.
- Link cards to `/items/[category]/[externalId]`.
- Integrate Sivan's save button where required by the design.
- Handle loading, empty results, provider failures, and missing images.
- Make controls and results responsive and accessible.

### Main files and API

- `src/app/discover/page.tsx`.
- `src/components/item-card.tsx`.
- Search, filter, and pagination components and tests.
- GET `/api/v1/items`.

### Documentation coordination

- Consolidate the frontend setup/run instructions using technical notes supplied by feature owners.
- Assemble the implementation summary, completed/unfinished feature list, and known limitations.
- Collect and organize each member's contribution statement and testing evidence.
- Record which tests were mocked and which used the real backend.
- Include only implemented and verified features in the submission summary. Clearly identify unfinished work and known limitations.

Nathan organizes the written material; every member supplies accurate information and evidence about their own work.

### Testing and Wednesday handoff

- Test search, category/filter changes, URL state, pagination, cards, Detail links, and failures.
- Share the card props and search parameters early so Home and Detail work can proceed independently.
- For Wednesday, prioritize working search/category results and navigation, plus a brief implementation-status document.

## 7. Bishal Chaudhari — Item Detail and demonstration coordination

### Implementation

- Build `/items/[category]/[externalId]` from the supplied design.
- Load the item from its category and external ID.
- Display title, description, image, and available category-specific information.
- Display provider ratings with the correct source and scale.
- Integrate Sivan's save button and Yousuf's review panel.
- Pass the local catalog ID to save and review controls.
- Handle missing images, invalid items, unavailable providers, and not-found responses.
- Make Detail and its embedded controls responsive and accessible.

### Main files and API

- `src/app/items/[category]/[externalId]/page.tsx`.
- Supporting Detail components and tests.
- GET `/api/v1/items/{category}/{external_id}`.

### Testing and Wednesday handoff

- Test successful Detail rendering, category fields, missing data, API failures, and not-found states.
- Verify navigation from Nathan's cards and integration with Sivan's and Yousuf's components.
- Coordinate the demonstration sequence. Each member explains and demonstrates their own contribution; Bishal does not write the submission documentation.
- For Wednesday, prioritize working item retrieval and display, then integrate save/review controls as they become available.

## 8. Shared implementation contract

- Use Next.js, TypeScript, shadcn/ui, and Tailwind. Medea owns shared setup; each member uses the shared components within their own feature.
- Use `getCurrentUser()` for server-side session checks and `apiRequest()` for client-side backend requests through Next.js.
- Keep token handling in the existing Next.js server/session layer; do not introduce a second token-storage approach.
- Follow the actual backend paths and response schemas. Report contract differences before depending on them.
- Catalog responses use a `data` field; saved-item and review responses may be direct objects or arrays. Use their actual schemas.
- Detail links use category and external ID. Save/review bodies use the numeric local catalog ID.
- Saved-item changes use the saved-item record ID; review changes use the review record ID.
- Use accessible labels, visible focus, keyboard controls, and understandable error messages.
- Use plain-text rendering for provider descriptions and reviews unless an agreed sanitization approach is added.
- Coordinate shared-file changes with the owner and work on separate feature branches.
- Keep credentials, private environment files, dependencies, and generated build files out of Git and submission archives. Supply environment examples instead.

## 9. Testing and evidence responsibilities

Everyone must test their own feature and fix its defects. Medea maintains shared test configuration; Yousuf coordinates the combined integration flow; Nathan consolidates the submitted evidence.

For each PR, include:

- What works and which files/features the author implemented.
- The checks actually run and their results.
- Relevant desktop/mobile screenshots or demonstration evidence.
- Unfinished work, known failures, and dependencies.

Run type checking, linting, the production build, and relevant tests before requesting review. Do not report a passing build or a test command with zero tests as functional test coverage.

The frontend testing target is at least 50% application unit-test line coverage; preserve the coverage report and report the actual measured result. Include untested owned application files in measurement; explain reasonable exclusions.

## 10. Wednesday frontend checkpoint

Each member should provide:

1. A working, reviewable implementation of the priority feature described in their section.
2. Desktop and mobile layout progress based on the supplied Figma screens.
3. Backend calls for implemented features, with loading, success, empty, and error states where relevant.
4. Tests for the implemented behavior and the results of checks actually run.
5. A PR describing their contribution, unfinished tasks, and any dependencies blocking progress.
6. Their own screenshots or short demonstration of the implemented feature.

Nathan consolidates the written implementation status and contribution notes. Bishal coordinates the demonstration order. Everyone explains their own work and supplies their own evidence.

If a feature cannot be completed by the checkpoint, notify the team early and state what is working, what is missing, and what help is needed. Do not present placeholder screens, simulated data, or passing build checks as completed functionality.
