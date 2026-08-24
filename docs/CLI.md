# CLI

```bash
connector-policy-fixtures init <actions-dir> --out <policy-cases.json>
connector-policy-fixtures validate <policy-cases.json>
connector-policy-fixtures matrix <policy-cases.json> [--format markdown]
connector-policy-fixtures render <policy-cases.json>
```

Each command accepts exactly one target. `init` requires one `--out <file>`;
`matrix` accepts at most one `--format markdown`; and `validate` and `render`
accept no options. An accepted option can appear before or after the target.
Unknown options, duplicate options, missing option values, extra targets, and
matrix formats other than `markdown` fail before any input is read or output is
written.

Every `.json` file in the `init` actions directory must contain one JSON object
with non-empty string `id`, `connector`, `action`, and `target` fields and a boolean
`writes` field. `payload` is optional and must be a JSON object when present.
Whitespace-only required strings are treated as empty.
The directory must contain at least one `.json` manifest, and manifest `id`
values must be unique across the directory. Empty inputs and duplicate IDs fail
with diagnostics naming the directory or conflicting ID and source files.
Manifests are read in filename order and all are validated before the output
directory or file is created. A malformed manifest fails with status 1 and a
deterministic diagnostic naming the source file and first invalid field.

For every non-empty valid actions directory, `init` guarantees the decision
coverage required by `validate`: allow, block, and escalate. A homogeneous
directory receives one deterministic aggregate coverage case for its missing
allow or escalate decision. A generated coverage ID that collides with a
manifest-derived case receives the first available numeric suffix starting at
`-2`. Mixed read/write inputs retain the normal two cases per manifest without
an aggregate case.

Fixture-backed smoke commands:

```bash
npm run build
node dist/cli.js init test/fixtures/actions --out tmp/policy-cases.json
node dist/cli.js validate tmp/policy-cases.json
node dist/cli.js matrix tmp/policy-cases.json --format markdown
node dist/cli.js validate test/fixtures/policy-missing-rollback.json
```

`validate` checks that the fixture uses the supported
`connector-policy-fixtures/v1` schema, its 16-character checksum matches the
`cases` array, and every case ID is unique. It also checks decision coverage,
rollback expectations, broad targets, and secret-looking values.
The decision coverage invariant requires at least one allow, one block, and
one escalate case across the fixture.

`matrix` and its `render` alias run the same validation before rendering. If
any error-level issue is found, they print the same deterministic issue format
as `validate`, exit with status 1, and do not emit a partial matrix. Warnings do
not prevent rendering.

The accepted fixture is a JSON object with string `schema`, non-empty string `generatedFrom`,
and `checksum` fields plus a `cases` array. Every case has string `id`,
`connector`, `action`, `target`, and `rollback` fields; `risk` is `low`,
`medium`, or `high`; `decision` is `allow`, `block`, or `escalate`;
`approvalRequired` is boolean; and `payload` is an object. Required case strings
must be non-empty after trimming. Missing, empty, or wrongly
typed fields are reported as validation issues, without internal JavaScript
errors, and cause exit status 1.

For example, this intentionally malformed fixture exercises that behavior:

```bash
printf '%s\n' '{"schema":"connector-policy-fixtures/v1","generatedFrom":"example","checksum":"0000000000000000","cases":[{}]}' > tmp/malformed-policy-cases.json
node dist/cli.js validate tmp/malformed-policy-cases.json
test $? -eq 1
```

Do not manually update `checksum` after changing a fixture. Regenerate the file
from its action manifests so the cases and integrity metadata stay synchronized:

```bash
node dist/cli.js init test/fixtures/actions --out tmp/policy-cases.json
node dist/cli.js validate tmp/policy-cases.json
```

Exit behavior:

- `0`: command completed and validation found no errors.
- `1`: command failed, input could not be read, or validation found an error-level issue.

Validation warnings are printed to stderr but do not fail the command unless an error-level issue is also present.
