---
name: update-copilot-pricing
description: 'Update the GitHub Copilot model pricing JSON file by extracting current rates from the official docs page. Use when: update pricing, refresh model costs, copilot pricing, model rates, token pricing.'
argument-hint: 'Optionally specify which provider to update (e.g., "openai", "anthropic", "google")'
---

# Update Copilot Model Pricing

## When to Use

- Pricing data needs refreshing from the official source
- New models have been added to GitHub Copilot
- Verifying current token costs for budgeting or documentation
- The `last_updated` field in the pricing file is older than the desired refresh interval

## Files

| File | Purpose |
|------|---------|
| `.github/pricing/copilot-models.json` | The pricing data (consumed by other skills/agents/tools) |
| `.github/pricing/copilot-models.schema.json` | The output contract (defines required fields and types) |

## Source

https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing

The source page structure may change over time. The extraction procedure below describes the current layout, but the **schema file is the stable contract**. If the source format changes, adapt the extraction logic to still produce output conforming to the schema.

## Procedure

1. **Read the schema** at `.github/pricing/copilot-models.schema.json` to understand the required output structure.

2. **Read the existing pricing file** at `.github/pricing/copilot-models.json` to capture the current state (for diffing later).

3. **Fetch the pricing page** using the `fetch_webpage` tool:
   - URL: `https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing`
   - Query: `model pricing per token input output cost`

4. **Extract pricing data** from the fetched page. The page organises models by provider in tables. For each model, identify the fields defined in the schema:
   - `provider` — The section heading (OpenAI, Anthropic, Google, Fine-tuned/GitHub)
   - `model` — Full model name as shown in the table
   - `status` — GA or Public preview
   - `tier` — Lightweight, Versatile, or Powerful
   - `input` — Cost per 1M input tokens (USD)
   - `cached_input` — Cost per 1M cached input tokens (USD)
   - `output` — Cost per 1M output tokens (USD)
   - `cache_write` — Cost per 1M cache write tokens (USD, if the provider has this column; null otherwise)

   **Adaptation guidance:** If the source adds new columns, new providers, or restructures tables, map the data to schema fields as best as possible. If a new field appears that isn't in the schema, note it in the diff summary but do not add it to the output. If a required field is missing from the source, flag it for review.

5. **Assign to plan(s)**:
   - Currently all models fall under the `"default"` plan
   - If the source page introduces plan-specific pricing, create separate plan entries
   - Preserve any existing plan entries that are not represented on the source page (they may be manually maintained)

6. **Update the pricing file** at `.github/pricing/copilot-models.json`:
   - Set `last_updated` to today's date (YYYY-MM-DD)
   - Replace model entries within the relevant plan(s)
   - Keep entries sorted by provider (alphabetical), then by model name (alphabetical)
   - Preserve the `$schema` reference

7. **Validate** the output:
   - Confirm valid JSON (no trailing commas, correct types)
   - Verify numeric values are numbers, not strings
   - Verify the output conforms to the schema
   - Diff against the previous version and report:
     - Models added
     - Models removed
     - Price changes (with old → new values)

## Notes

- All prices are per 1 million tokens
- 1 AI credit = $0.01 USD
- Anthropic models have an additional `cache_write` cost; other providers set this to null
- Some models have footnotes about context-length surcharges; capture the base price only
- Code completions are not billed in AI credits and are excluded from this file
- The "Fine-tuned (GitHub)" section maps to `provider: "GitHub"`
