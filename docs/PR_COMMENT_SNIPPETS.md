# Machine-readable PR comment snippets

This document defines a deterministic, offline format for optional snippets that a
future version of `connector-policy-fixtures` may emit for use in a pull request
comment. The current CLI does **not** generate snippets.

## Format

A snippet is one UTF-8 JSON object followed by exactly one LF newline. Its keys,
in this order, are:

```json
{"schema":"connector-policy-fixtures/pr-comment-snippet/v1","title":"Policy review","body":"Review the generated policy matrix before approval."}
```

`schema` is the fixed version identifier shown above. `title` and `body` are plain
text strings; they must not contain credentials or sensitive fixture contents.
Consumers should parse the JSON object rather than rely on key order. Producers
must not include timestamps, paths, or other machine-dependent values.

## Security and delivery boundary

The output is inert text only. Generating, validating, or displaying it never posts
a comment, opens or edits a pull request, contacts GitHub, or performs any other
remote write. A human must independently review and explicitly copy any text into
a destination. Do not treat the snippet as an instruction to an automated poster.

## Example fixture

[`../test/fixtures/pr-comment-snippet.json`](../test/fixtures/pr-comment-snippet.json)
contains the canonical example. Check its exact bytes and JSON structure with:

```sh
node --input-type=module -e '
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const path = "test/fixtures/pr-comment-snippet.json";
const text = readFileSync(path, "utf8");
assert.ok(text.endsWith("\n") && !text.endsWith("\n\n"));
const value = JSON.parse(text);
assert.deepEqual(Object.keys(value), ["schema", "title", "body"]);
assert.equal(value.schema, "connector-policy-fixtures/pr-comment-snippet/v1");
console.log("PR comment snippet fixture valid");
'
```
