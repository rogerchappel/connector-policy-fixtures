# Contributing

Thanks for improving `connector-policy-fixtures`.

## Local Checks

Run the release-candidate gate before opening a pull request:

```bash
npm install
npm run release:check
```

For focused iteration:

```bash
npm run check
npm test
npm run smoke
npm run validate
npm run package:smoke
```

## Fixture Guidelines

- Keep connector actions synthetic and offline.
- Cover one policy behavior per fixture when practical.
- Do not commit real connector account IDs, credentials, user payloads, or production rollback instructions.

