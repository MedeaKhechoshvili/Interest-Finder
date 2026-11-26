# Saved Items unit tests

Owner: Sivan.

The Saved Items unit/component tests are in:

- `saved-items.test.ts`: API helper behavior, response validation, local catalog ID resolution, and correct use of catalog IDs versus saved-record IDs.
- `save-button.test.tsx`: saving with a local ID, resolving a missing local ID, duplicate handling, error feedback, parent-provided saved state, and preventing duplicate submissions.
- `my-lists-client.test.tsx`: loading, Planned and Completed lists, empty states, status changes, deletion and confirmation, retry behavior, error handling, and missing catalog details.

Run only these tests from the `frontend/` directory:

```powershell
npm test -- tests/unit/saved-items
```

Measure the full application coverage target with:

```powershell
npm run test:coverage
```

The coverage command measures the whole application, not just this feature. Keep the generated `coverage/` report for PR evidence. Do not claim the shared 50% target is met until the complete coverage command passes.
