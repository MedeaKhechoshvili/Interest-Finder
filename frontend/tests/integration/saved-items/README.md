# Saved Items integration tests

Owner: Sivan.

`my-lists.spec.ts` checks that guests are redirected away from My Lists, the
empty Planned and Completed lists, recovery from a loading error, and completing,
moving back, and removing saved items (which stay removed after a reload).

Use the isolated test API and database. Check desktop and mobile behavior.
Coordinate catalog fixtures with the shared API launcher when provider data is needed.
See [the team testing guide](../../README.md) for commands and shared rules.
