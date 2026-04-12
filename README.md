# Survai

AI-native survey builder. Describe your survey in plain English and get professional, shareable surveys in seconds.

## Architecture

```
User prompt → AI (OpenAI GPT-4o) → Catalog Validation → Rendering
                                         ↓
                              Fixed Element Catalog (10 types)
                              ├── short_text
                              ├── long_text
                              ├── multiple_choice
                              ├── checkboxes
                              ├── dropdown
                              ├── linear_scale
                              ├── date
                              ├── file_upload
                              ├── section_header
                              └── page_break
```

### How It Works

1. **Catalog-driven generation** — The AI receives a typed catalog manifest and can only generate elements from it. Two-phase validation ensures conformance.
2. **Streaming generation** — Elements stream progressively via SSE as the AI generates them, appearing one-by-one in the editor canvas.
3. **Live promptable UI** — The AI classifies user messages as either "generate" (create/redesign survey) or "command" (move, update, delete elements). UI manipulation happens through typed commands.

### Editor Layout (3-panel)

```
+----------------------------------+
|          Toolbar / Header        |
+--------+------------+-----------+
|  Chat  |   Editor   |  Props    |
| Panel  |  (D&D)     |  Panel    |
| ~320px |  flex-1    |  ~320px   |
+--------+------------+-----------+
```

## Tech Stack

- **Frontend**: Next.js (App Router) + React + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **Drag & Drop**: dnd-kit
- **State**: Zustand
- **AI**: OpenAI API (GPT-4o, structured outputs with Zod)
- **Database/Auth**: Supabase (Postgres + Auth + Row Level Security)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in: OPENAI_API_KEY (required for AI)
# Optional: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

# Start dev server
npm run dev
```

### Testing without Supabase

Visit `http://localhost:3000/test` to use the editor with a local in-memory survey (no database or auth required). You only need an `OPENAI_API_KEY` in `.env.local`.

## Project Structure

```
src/
├── app/
│   ├── api/ai/chat/              # AI endpoints (standard + streaming)
│   ├── test/                     # Minimal test page (no auth)
│   ├── survey/[id]/edit/         # Survey editor
│   ├── survey/[id]/dashboard/    # Response analytics
│   └── s/[id]/                   # Public survey link
├── components/
│   ├── survey/
│   │   ├── editor/               # 3-panel editor components
│   │   ├── elements/             # 10 element type renderers
│   │   ├── chat/                 # AI chat panel
│   │   ├── dashboard/            # Analytics charts
│   │   └── response/             # Survey form + response viewer
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── ai/
│   │   ├── schema.ts             # Zod schemas for AI structured output
│   │   ├── prompts.ts            # System prompt with catalog
│   │   ├── catalog-manifest.ts   # Catalog serialization
│   │   ├── validate.ts           # Two-phase catalog validation
│   │   └── command-executor.ts   # UI command execution
│   ├── survey/
│   │   ├── store.ts              # Zustand editor state
│   │   └── catalog.ts            # Element catalog metadata
│   └── supabase/                 # Supabase clients
├── hooks/
│   ├── use-ai-stream.ts          # SSE streaming hook
│   └── use-auto-save.ts          # Debounced auto-save
└── types/
    └── survey.ts                 # Core type system
```

## Extending the Catalog

See [EXTENDING.md](./EXTENDING.md) for a step-by-step guide to adding new element types.
