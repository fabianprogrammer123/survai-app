# Survai — AI Agent Handover Summary

## Project Overview

**Survai** is an AI-native survey builder and landing page for a startup. The core concept: instead of static surveys, AI adapts every question in real time based on what's already been learned from previous responses — creating a decentralized knowledge network.

**Location:** `/Users/fabian/Desktop/Survai`
**Dev server:** `npm run dev` on port 3000 (configured in `.claude/launch.json` as `survai-dev`)
**Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Zustand for state

---

## Tech Stack

- **Next.js 16** with App Router (`src/app/`)
- **React 19** with `"use client"` directive on all interactive components
- **TypeScript 5** (strict mode)
- **Tailwind CSS 4** with `@tailwindcss/postcss`
- **Zustand 5** for state management (`src/lib/survey/store.ts`)
- **shadcn/ui** components in `src/components/ui/`
- **OpenAI API** (gpt-4o) for AI chat features
- **Supabase** for auth/db (configured but not heavily used yet)
- **Recharts** for charts
- **@dnd-kit** for drag-and-drop
- **lucide-react** for icons
- **Path alias:** `@/*` maps to `./src/*`

---

## Route Architecture

| Route | Purpose | Layout |
|-------|---------|--------|
| `/` | Landing page | Full-page dark marketing site with canvas animations |
| `/test` | User-facing survey builder | 2-panel: EditorCanvas + RightPanel (no sidebar) |
| `/admin` | Admin survey builder | 3-panel: BlockPalette sidebar + EditorCanvas + RightPanel |
| `/s/[id]` | Published survey form (respondent view) | Survey form |
| `/survey/[id]/edit` | Survey editor (DB-backed) | Full editor |
| `/survey/[id]/dashboard` | Survey dashboard | Dashboard |
| `/survey/[id]/responses` | Response viewer | Responses |
| `/dashboard` | Main dashboard | Dashboard |
| `/login`, `/signup` | Auth pages | Auth layout |

### Key route differences: `/test` vs `/admin`
- **`/test`** — Clean user experience. No left sidebar (`BlockPalette` removed). 2-panel layout: `EditorCanvas` (flex-1) + `RightPanel` (w-440px). Default survey title: "Product Feedback Survey".
- **`/admin`** — Full admin view. 3-panel layout: `BlockPalette` (w-200px) + `EditorCanvas` + `RightPanel` (w-400px). Default survey title: "Untitled Survey".

---

## Key Files & Architecture

### Landing Page (`/`)

**`src/app/page.tsx`** (527 lines)
The main marketing landing page with 9 sections:
1. **Hero** — "Every question you ask could be *smarter.*" with "Rethink how you learn from people" subheading
2. **Logo marquee** — 5 university logos (TUM, CDTM, HEC, Stanford, Stanford HAI) with `brightness-0 invert` filter → hover shows original colors
3. **Capability overhang** — Stats about AI exposure gap with bar chart visualization
4. **Editorial quote** — Polanyi's "We can know more than we can tell"
5. **Survey comparison canvas** — Side-by-side Traditional vs Intelligent survey animation
6. **Platform section** — "Not another form builder. A knowledge capture system." with 3 feature cards + channel badges
7. **Use cases** — "Universal by design" — 12 use case cards in 4×3 grid (Customer experience, Employee engagement, 360° peer reviews, Product research, Market intelligence, Academic research, UX testing, Patient experience, Event feedback, Training effectiveness, Compliance audits, Due diligence)
8. **Research section** — 5 peer-reviewed references (Nonaka, Woolley, Conrad, Argote, Schwarz)
9. **CTA + Footer**

Uses `IntersectionObserver` for `.reveal` scroll animations. `CountUp` component for animated stat counters.

**Logo files:** `/public/logos/` — tum.svg, cdtm.svg, hec.svg, stanford.svg, stanford-hai.svg (also .png versions for some)

### Canvas Visualizations

**`src/components/OrgFlowCanvas.tsx`** (896 lines)
Three canvas components:

1. **`NetworkBackground`** (exported, named) — Fixed full-page background. Neural constellation pattern with mouse interaction: nodes respond to cursor proximity, form persistent edges, spawn flow particles, create constellation shapes. Uses `requestAnimationFrame` loop.

2. **`AdaptivePathsCanvas`** (exported, named) — Branching catmull-rom spline animation. Used for the "adaptive paths" visual.

3. **`SurveyComparisonCanvas`** (default export) — The main comparison animation showing Traditional Survey (left) vs Intelligent Survey (right):

   **Key mechanic:** `PACKET_SPEED = 0.015` is **identical** on both sides. The intelligent survey's advantage comes ONLY from:
   - No waiting for all responses
   - No post-processing/analysis delay
   - No drafting-new-survey delay
   - Immediate AI-adapted follow-up per response

   **Traditional side:**
   - Phase state machine: `sending` → `waiting` → `processing` (60 frames) → `drafting` (50 frames) → next iteration
   - Burst out all packets at once to current ring
   - Each reached node sends response back with random delay (20-100 frames) via `setTimeout`
   - Must wait for ALL responses before processing
   - Labels show current phase ("Iteration 1 · Sending survey", etc.)

   **Intelligent side:**
   - Continuous frontier spawning with directional bias (`expansionBias` clusters)
   - Each newly reached node immediately sends impulse back to hub (same speed)
   - Hub immediately sends AI-adapted question to unreached neighbor
   - Lateral knowledge exchange between reached nodes
   - Labels show coverage state ("AI adapting questionnaire in real-time", "Network effects accelerating coverage", etc.)

   Both sides use 93 nodes (same org), 4 rings. 10-second cycle (600 frames). Counters show "X responses" (no total). Labels have dark pill backgrounds via `drawLabelBg()`.

### Survey Builder Components

**`src/components/survey/editor/editor-header.tsx`** (108 lines)
Header bar with:
- Left: survey title, element count, generation status
- Center: Edit / Preview / Settings toggle (custom buttons matching bg-muted/rounded-lg style). Settings is a gear icon. Results tab appears when published.
- Right: Share and Publish buttons

**`src/components/survey/editor/right-panel.tsx`** (61 lines)
Right panel with Chat/Properties toggle (custom buttons matching Edit/Preview style). Auto-switches to Properties when element selected.

**`src/components/survey/chat/chat-header.tsx`** (28 lines)
Minimal header — only a voice toggle button (Volume2/VolumeX), right-aligned. No title, no icons.

**`src/components/survey/chat/chat-input-area.tsx`** (85 lines)
Chat text input with:
- Google Sans/Roboto font family (Google Forms-like feel)
- Hidden scrollbar (overflow-hidden + webkit scrollbar hiding)
- Auto-expanding textarea (max 120px)
- Voice button slot, send button

**`src/components/survey/editor/editor-canvas.tsx`** (135 lines)
Main canvas area showing survey elements, template gallery (when empty), add-element button, drag-and-drop sorting.

**`src/components/survey/editor/block-palette.tsx`** (92 lines)
Left sidebar (admin only) — lists all block types by category (Ratings, Feedback, Choices, Advanced). Click to add.

**`src/components/survey/editor/properties-panel.tsx`** (242 lines)
Properties panel for selected element — edit title, description, required toggle, options, scale settings, etc.

**`src/components/survey/chat/chat-panel.tsx`** (164 lines)
Chat panel — messages list, empty state with template gallery, auto-scroll, voice input integration.

### State Management

**`src/lib/survey/store.ts`** (314 lines) — Zustand store (`useSurveyStore`)
Key state:
- `survey`: Survey object (title, description, elements, settings)
- `editorMode`: 'editor' | 'preview' | 'results'
- `chatMessages`, `isChatLoading`: Chat state
- `elementBlockMap`: Maps element IDs to block template IDs
- `generationBatches`: Links chat messages to created elements
- `highlightedElementIds`, `highlightedMessageId`: Insight hover cross-highlighting
- `voiceEnabled`: TTS auto-play
- `isStreaming`, `recentlyAddedIds`: Element streaming animation
- `isPublished`, `responses`, `resultsChatMessages`: Mock-publish / results state

### Type System

**`src/types/survey.ts`** (184 lines)
- Element types: short_text, long_text, multiple_choice, checkboxes, dropdown, linear_scale, date, file_upload, section_header, page_break
- `SurveySettings`: theme, showProgressBar, shuffleQuestions, confirmationMessage, backgroundImage, visualEffect, fontFamily
- `ChatMessage`: id, role, content, timestamp, proposals, clarifyingQuestions
- `Proposal`: label, description, elements, settings, blockMap

### AI Integration

**`src/lib/ai/schema.ts`** (156 lines) — Zod schemas for AI response validation
**`src/lib/ai/prompts.ts`** (140 lines) — System prompts for GPT-4o
**`src/hooks/use-ai-chat.ts`** (207 lines) — React hook for AI chat interaction
**`src/app/api/ai/chat/test/route.ts`** — API route for survey chat (has a known Zod schema issue with `.optional()` fields)
**`src/app/api/ai/chat/route.ts`** — Main AI chat route
**`src/app/api/ai/voice/`** — Voice transcribe/synthesize routes

---

## Known Issues

1. **OpenAI Zod schema error** in `src/app/api/ai/chat/test/route.ts:50` — `.optional()` without `.nullable()` not supported by OpenAI structured outputs. This is a pre-existing issue affecting the AI chat functionality.

2. **University logos** — SVG logos in `/public/logos/` were created in an earlier session. They may not be 100% accurate visual representations of the actual university logos. The hover effect (brightness-0 invert → show colors on hover) is implemented.

3. **Preview tool scrolling** — The preview tool's `window.scrollTo()` doesn't reliably work for verification. Use `preview_eval` or `preview_snapshot` for DOM-level verification of sections below the fold.

---

## CSS & Design System

- **Dark theme only** — `<html className="dark">`
- **Background color:** `#08080c` (near-black)
- **Text hierarchy:** white/80 → white/50 → white/40 → white/30 → white/25 → white/15
- **Borders:** white/5 (subtle), white/10 (hover), white/20 (active)
- **Fonts loaded:** Geist, Geist Mono, DM Sans, Space Grotesk, Playfair Display, JetBrains Mono
- **Landing page sections:** Font mono for labels/citations, serif (Playfair-like) for hero headings
- **Survey builder:** Default sans-serif, Google Sans/Roboto for chat input
- **UI components:** shadcn/ui with dark theme overrides in globals.css
- **Scroll animations:** `.reveal` class + IntersectionObserver → `.visible` transition

---

## File Tree (Key Files)

```
src/
├── app/
│   ├── page.tsx                    # Landing page (527 lines)
│   ├── layout.tsx                  # Root layout with fonts
│   ├── globals.css                 # Global styles + shadcn theme
│   ├── test/page.tsx               # Clean 2-panel survey builder
│   ├── admin/page.tsx              # Full 3-panel admin builder
│   ├── s/[id]/page.tsx             # Published survey respondent view
│   ├── survey/[id]/
│   │   ├── edit/page.tsx           # DB-backed survey editor
│   │   ├── dashboard/page.tsx      # Survey analytics dashboard
│   │   └── responses/page.tsx      # Response viewer
│   ├── (auth)/                     # Login/signup
│   ├── (dashboard)/                # Main dashboard
│   └── api/ai/
│       ├── chat/route.ts           # Main AI chat endpoint
│       ├── chat/test/route.ts      # Test AI chat (has Zod issue)
│       ├── chat/stream/route.ts    # Streaming chat
│       ├── voice/                  # Voice transcribe/synthesize
│       ├── responses/route.ts      # Mock response generation
│       └── results/route.ts        # Results AI
├── components/
│   ├── OrgFlowCanvas.tsx           # Canvas animations (896 lines)
│   ├── ui/                         # shadcn/ui components
│   └── survey/
│       ├── editor/
│       │   ├── editor-header.tsx    # Edit/Preview/Settings toggle
│       │   ├── editor-canvas.tsx    # Main canvas with drag-drop
│       │   ├── right-panel.tsx      # Chat/Properties toggle
│       │   ├── block-palette.tsx    # Block type sidebar (admin)
│       │   ├── properties-panel.tsx # Element property editor
│       │   ├── template-gallery.tsx # Survey templates
│       │   ├── publish-dialog.tsx   # Publish flow
│       │   └── ...
│       ├── chat/
│       │   ├── chat-panel.tsx       # Full chat interface
│       │   ├── chat-header.tsx      # Voice toggle only
│       │   ├── chat-input-area.tsx  # Google Forms-style input
│       │   ├── chat-message.tsx     # Message bubbles
│       │   └── ...
│       ├── elements/               # Survey element renderers
│       └── response/               # Response viewing
├── hooks/
│   ├── use-ai-chat.ts              # AI chat hook
│   ├── use-voice-input.ts          # Voice recording
│   └── use-voice-output.ts         # TTS playback
├── lib/
│   ├── survey/store.ts             # Zustand store (314 lines)
│   ├── ai/
│   │   ├── schema.ts               # Zod response schemas
│   │   ├── prompts.ts              # System prompts
│   │   ├── command-executor.ts     # AI command execution
│   │   └── validate.ts             # Response validation
│   ├── templates/                  # Survey templates & blocks
│   └── supabase/                   # Supabase client/server
├── types/survey.ts                 # Type definitions (184 lines)
└── middleware.ts                   # Auth middleware
```

---

## Dev Server Configuration

```json
// .claude/launch.json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "survai-dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

To start: use `preview_start` with name `survai-dev`, or run `npm run dev` in `/Users/fabian/Desktop/Survai`.

---

## Recent Changes (Last Session)

All implemented and verified:
1. Canvas counters show "X responses" (no "/93" total)
2. Logo hover: `brightness-0 invert` → shows dim original colors on hover
3. Editor header: Settings gear icon added, buttons sized up to `px-4 py-1.5 text-sm`
4. Created `/admin` route with full 3-panel layout
5. Cleaned `/test` route: no left sidebar, wider chat panel (440px)
6. Chat header: removed "AI Assistant" title and Sparkles icon
7. Chat/Properties toggle: custom buttons matching Edit/Preview style (no icons)
8. Chat input: Google Sans/Roboto font, hidden scrollbar, `leading-relaxed`
