# Interactive Chat-to-UI POC

This POC extends the json-render Next website builder with:
- a chat panel that asks an LLM to edit UI specs,
- operation-based JSON updates (`add`, `replace`, `remove`),
- live preview + manual JSON editing in one screen.

## Setup

1. Install dependencies from repo root:

```bash
pnpm install
```

2. Configure Gemini credentials:

```bash
cp examples/next-website-builder/.env.example examples/next-website-builder/.env.local
```

Then set:
- `GOOGLE_GENERATIVE_AI_API_KEY`
- optional `GEMINI_MODEL` (default: `gemini-2.5-flash`)

## Run

From repo root:

```bash
pnpm --filter example-next-website-builder exec next dev --port 3000
```

Open [http://localhost:3000/builder](http://localhost:3000/builder).

## Test

From repo root:

```bash
pnpm --filter example-next-website-builder test
```

## How It Works

- `POST /api/chat` receives chat history + current spec.
- Gemini returns:
  - `message`: assistant reply text,
  - `operations`: JSON pointer edits.
- Server applies operations safely, validates shape, stores new spec.
- UI updates preview immediately after chat or manual JSON edits.

## Example Prompts

- "Change hero headline on home page to 'Build with confidence'."
- "Add a new `/pricing` route with a hero and a 3-column features section."
- "Update contact page CTA text and button label."
- "Remove testimonials from the home page."

## Notes

- The dev script in this package uses `portless` by default; direct `next dev` command above avoids privileged proxy setup for local POC runs.
- If an operation is invalid, the API returns an error instead of corrupting the spec.
