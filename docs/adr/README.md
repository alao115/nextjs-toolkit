# Architecture Decision Records

ADRs capture decisions that shape the package as a whole. Each ADR is a short, immutable record: write a new ADR to supersede an old one rather than editing.

## Index

| ADR  | Title                                                                 | Status   |
| ---- | --------------------------------------------------------------------- | -------- |
| 0001 | [Port/Adapter pattern for every external boundary](./0001-port-adapter-everywhere.md) | Accepted |
| 0002 | [All DI tokens are `Symbol`s, never strings](./0002-symbol-di-tokens.md) | Accepted |
| 0003 | [Config is Joi-validated; secrets have no literal defaults](./0003-config-via-joi-no-secret-defaults.md) | Accepted |
| 0004 | [Request scope lives in `AsyncLocalStorage`](./0004-request-context-als.md) | Accepted |

## Writing a new ADR

1. Copy an existing file as `NNNN-short-slug.md` where `NNNN` is the next sequential number.
2. Use the headings: **Status**, **Context**, **Decision**, **Consequences**.
3. Keep it under one page. If you need more, it probably belongs in module docs instead.
4. Append it to the index above.

ADRs are written in the past tense — they record what was decided, not what should be done.
