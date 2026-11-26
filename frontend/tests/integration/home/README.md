# Home integration tests

Owner: Medea.

`home.spec.ts` loads Home from the real test API, checks the desktop and mobile
layouts, search and category links to Discover, card links to Detail, the image
fallback, the guest bookmark prompt with a real login, and saving an item
from Home to My Lists.

The test API reads its catalog items from `tests/fixtures/home/response.json`.
Fixture images are served by the test through Playwright request routing. See
[the team testing guide](../../README.md) for commands and shared rules.
