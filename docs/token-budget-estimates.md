# Token Budget Estimates

Marinara currently uses deterministic heuristic token estimates in prompt-budget
paths such as lorebook injection and knowledge retrieval. The default heuristic
is intentionally simple: roughly four UTF-16 characters per token.

## Current Decision

Do not bundle tokenizer-backed estimators for general chat models until the
project can choose maintained tokenizer assets for the supported provider/model
families.

Reasons:

- provider tokenizers for newer GPT, Claude, Gemini, and other model families are
  not consistently published as portable local assets;
- using one tokenizer as a pretend universal tokenizer would create false
  precision;
- tokenizer bundles would affect app size and offline distribution;
- budget behavior must stay React-free and provider-independent inside
  `src/engine`.

## Requirements For Future Tokenizer Support

A future tokenizer-backed implementation should define:

- tokenizer availability by provider/model family;
- local asset source, version, and license;
- deterministic fallback when a tokenizer is unavailable;
- Unicode and boundary-string regression coverage;
- behavior for lorebook prompt injection and knowledge retrieval budgets;
- app-size impact and whether tokenizer assets are optional downloads.

Until then, token counts shown or used for budgeting should be treated as
estimates, not provider-exact accounting.
