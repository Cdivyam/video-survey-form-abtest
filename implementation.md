# AB Test Video Survey Platform — Implementation Document

## What We're Building

A general-purpose survey builder that supports video evaluation workflows. Surveys can be purely textual (standard questions, demographics, consent) or video-enabled (VideoSet blocks with video-aware question types). The video path adds two-level randomization and composite video pre-rendering on top of the base survey system.

---

## Core Concepts

### Project
Top-level container. Holds a VideoBank and one or more Survey Templates.

### VideoBank
A pool of VideoSets belonging to a project. The bank is the source for sampling when generating surveys.

### VideoSet
One prompt evaluated across up to 5 model outputs. Each video in the set is a separate file tagged with its model name.

### Survey Template (Master Survey)
The page builder output. Defines three zones:
- **Static Before** — pages always shown first (intro, consent, demographics)
- **Dynamic Template** — one page template repeated K times at generation time, once per sampled VideoSet
- **Static After** — optional closing pages always shown last

If the Dynamic Template contains a VideoSet block, video-aware question types are available. If it does not, the survey is a standard (non-video) survey and no VideoSet sampling or compositing occurs.

### Generated Survey
A concrete instance produced from a template. Has a unique URL. Contains pre-rendered composite videos (if video-enabled). Multiple surveys can be generated from the same template over time.

### Respondent Session
One person's run through a generated survey. Anonymous (UUID token in cookie). Maps slot labels back to video IDs at export time.

---

## Two-Level Randomization (Video Surveys Only)

**Level 2 — Set Selection:** When generating a survey, K VideoSets are sampled from the bank. Sampling is quota-aware: sets with fewer completions across all surveys are prioritized, ensuring balanced coverage.

**Level 1 — Position Permutation:** Within each selected VideoSet, the videos are assigned to visual slots (A, B, C, D, E) in a permuted order. The permutation is stored as a `slot_map`. A different permutation can be applied per VideoSet within the same survey, and across different generated surveys.

The composite video has the permutation baked in at render time. Slot labels (A, B, C, D, E) are burned into the video. Responses record slot labels; the slot_map resolves them to video IDs at export.

---

## Page Builder Element Types

### General Elements (always available)
| Type | Description |
|---|---|
| `heading` | Plain heading text |
| `textbox` | Markdown-compatible rich text block |
| `consent` | Radio: "I agree / I do not agree" — required to proceed |
| `demographics` | Structured fields: age range, gender, occupation, etc. (configurable) |
| `single_choice` | Radio button question with custom options |
| `multi_choice` | Checkbox question with custom options |
| `short_answer` | Free text input |
| `likert` | Rate a single statement on a 1–N scale |

### Video-Aware Elements (only valid when Dynamic Template contains a VideoSet block)
| Type | Description |
|---|---|
| `videoset_block` | Displays the composite video for this iteration. Exactly one per dynamic template. |
| `video_likert` | Matrix question. Rows = slot labels (A, B, C, D, E). Columns = scale points. One radio per cell. |
| `video_preference` | "Select the label of the video you prefer most." Single selection among present slot labels. |

#### `video_likert` Matrix Layout

```
                 1        2        3        4        5
                Poor     Fair     Good   V.Good  Excellent
  Video A  [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]
  Video B  [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]
  Video C  [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]
  Video D  [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]
  Video E  [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]   [  ○  ]
```

- First column: slot labels (auto-populated from the VideoSet slots present in this survey)
- First row: scale point values + optional text labels (defined by surveyor in template)
- Scale labels can be sparse — surveyor may label only endpoints (e.g., label 1 = "Poor", label 5 = "Excellent", middle cells show just the number)
- Each row must have exactly one selection before the respondent can proceed

#### `video_likert` Config Schema
```json
{
  "prompt": "Rate the overall quality of each video",
  "scalePoints": [1, 2, 3, 4, 5],
  "scaleLabels": {
    "1": "Poor",
    "5": "Excellent"
  }
}
```
`scalePoints` can be any array of integers the surveyor defines (e.g., `[1,2,3,4,5,6,7]` for a 7-point scale). `scaleLabels` is a sparse map — only labeled points need an entry.

A Dynamic Template page without a `videoset_block` is valid — it becomes a regular page repeated K times (e.g., K pages of free-text feedback, one per round).

---

## Data Model

```prisma
model Project {
  id         String   @id @default(cuid())
  name       String
  createdAt  DateTime @default(now())

  videoSets       VideoSet[]
  surveyTemplates SurveyTemplate[]
  surveys         Survey[]
}

model VideoSet {
  id        String   @id @default(cuid())
  projectId String
  name      String
  createdAt DateTime @default(now())

  project         Project           @relation(fields: [projectId], references: [id])
  videos          Video[]
  surveyVideoSets SurveyVideoSet[]
}

model Video {
  id         String @id @default(cuid())
  videoSetId String
  modelName  String
  fileUrl    String
  orderIndex Int

  videoSet VideoSet @relation(fields: [videoSetId], references: [id])
}

model SurveyTemplate {
  id             String   @id @default(cuid())
  projectId      String
  name           String
  setsPerSurvey  Int      @default(0)  // 0 = not a video survey
  createdAt      DateTime @default(now())

  project  Project          @relation(fields: [projectId], references: [id])
  pages    TemplatePage[]
  surveys  Survey[]
}

model TemplatePage {
  id         String      @id @default(cuid())
  templateId String
  section    PageSection // before | dynamic | after
  orderIndex Int

  template TemplatePage?    @ignore
  surveyTemplate SurveyTemplate @relation(fields: [templateId], references: [id])
  elements TemplateElement[]
}

enum PageSection {
  before
  dynamic
  after
}

model TemplateElement {
  id          String @id @default(cuid())
  pageId      String
  elementType String // heading | textbox | consent | demographics | likert | video_likert | video_preference | ...
  config      Json   // element-specific config (prompt, scale, options, etc.)
  orderIndex  Int

  page TemplatePage @relation(fields: [pageId], references: [id])
}

// --- Generated Survey ---

model Survey {
  id         String       @id @default(cuid())
  templateId String
  projectId  String
  slug       String       @unique  // used in URL: /s/[slug]
  status     SurveyStatus @default(generating)
  createdAt  DateTime     @default(now())

  template        SurveyTemplate   @relation(fields: [templateId], references: [id])
  project         Project          @relation(fields: [projectId], references: [id])
  surveyVideoSets SurveyVideoSet[]
  sessions        RespondentSession[]
}

enum SurveyStatus {
  generating
  ready
  closed
}

model SurveyVideoSet {
  id              String              @id @default(cuid())
  surveyId        String
  videoSetId      String
  positionIndex   Int                 // ordering within the survey (1st, 2nd, ... Kth dynamic page)
  slotMap         Json                // { "A": videoId, "B": videoId, "C": videoId, ... }
  compositeUrl    String?
  compositeStatus CompositeStatus     @default(pending)

  survey    Survey    @relation(fields: [surveyId], references: [id])
  videoSet  VideoSet  @relation(fields: [videoSetId], references: [id])
  responses Response[]
}

enum CompositeStatus {
  pending
  rendering
  ready
  failed
}

// --- Respondent ---

model RespondentSession {
  id          String    @id @default(cuid())
  surveyId    String
  token       String    @unique @default(cuid())
  startedAt   DateTime  @default(now())
  completedAt DateTime?

  survey    Survey     @relation(fields: [surveyId], references: [id])
  responses Response[]
}

model Response {
  id               String  @id @default(cuid())
  sessionId        String
  surveyVideoSetId String? // null for non-video questions
  elementId        String  // references TemplateElement.id
  slotLabel        String? // "A"|"B"|"C"|"D"|"E" — for video_likert and video_preference
  value            String  // score (stringified int) or free text

  session        RespondentSession @relation(fields: [sessionId], references: [id])
  surveyVideoSet SurveyVideoSet?   @relation(fields: [surveyVideoSetId], references: [id])
}
```

**Export resolution:** `response.slotLabel` → `surveyVideoSet.slotMap[slotLabel]` → `videoId` → `video.modelName`

---

## Survey Generation Pipeline

```
Surveyor clicks "Generate Survey"
│
├─ Validate: template has at least one dynamic page? setsPerSurvey > 0?
│
├─ [Video survey] Sample K VideoSets from bank
│     └─ Strategy: weighted random, weight = 1 / (1 + completions_in_closed_surveys)
│
├─ [Video survey] For each VideoSet:
│     ├─ Assign slot permutation (shuffle of video IDs into slots A,B,C,D,E)
│     ├─ Write SurveyVideoSet row (slotMap, positionIndex, status=pending)
│     └─ Enqueue FFmpeg composite job
│
├─ Create Survey row (status=generating, slug=nanoid(10))
│
├─ [FFmpeg jobs run in background]
│     ├─ Stitch videos side-by-side in slot order
│     ├─ Burn slot labels (A, B, C, D, E) into frame
│     ├─ Write composite file to storage
│     └─ Update SurveyVideoSet.compositeStatus = ready
│
└─ When all composites ready → Survey.status = ready → URL live
```

For non-video surveys the pipeline is trivial: create Survey row with status=ready immediately.

---

## Storage Abstraction

```typescript
// src/lib/storage.ts
interface StorageProvider {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>  // returns URL
  getUrl(key: string): string
  delete(key: string): Promise<void>
}

// Local implementation: writes to /public/uploads/, returns /uploads/<key>
// Production implementation: uploads to Cloudflare R2, returns CDN URL
```

Provider is selected via `STORAGE_PROVIDER=local|r2` env var. No other code changes needed when switching.

---

## File Structure

```
/
├── src/
│   ├── app/
│   │   ├── (admin)/                     # Surveyor-facing pages
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx             # Project list
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx         # Project dashboard (surveys, stats, export)
│   │   │   │       ├── videosets/       # Upload + manage VideoSets
│   │   │   │       └── template/        # Page builder
│   │   │   └── layout.tsx
│   │   ├── s/
│   │   │   └── [slug]/                  # Respondent survey runner
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── projects/
│   │       ├── videosets/
│   │       ├── templates/
│   │       ├── surveys/
│   │       │   └── [id]/
│   │       │       ├── generate/        # POST: trigger generation
│   │       │       └── export/          # GET: CSV download
│   │       ├── sessions/
│   │       └── responses/
│   ├── lib/
│   │   ├── storage.ts                   # Storage abstraction
│   │   ├── ffmpeg.ts                    # Composite video rendering
│   │   ├── sampling.ts                  # Quota-aware VideoSet sampling
│   │   ├── permutation.ts               # Slot permutation logic
│   │   └── export.ts                    # CSV generation (resolves slot → video_id)
│   ├── components/
│   │   ├── builder/                     # Page builder UI
│   │   │   ├── Canvas.tsx
│   │   │   ├── ElementPalette.tsx
│   │   │   └── elements/                # One component per element type
│   │   ├── runner/                      # Survey runner UI
│   │   │   ├── SurveyRunner.tsx
│   │   │   └── elements/                # Respondent-facing element renderers
│   │   └── ui/                          # shadcn/ui components
│   └── prisma/
│       └── schema.prisma
├── public/
│   └── uploads/                         # Local storage (gitignored)
├── prisma/
│   └── schema.prisma
├── implementation.md                    # This document
└── .env.local
```

---

## Environment Variables

```bash
# Database
DATABASE_URL="file:./dev.db"                    # local SQLite
# DATABASE_URL="postgresql://..."               # production

# Storage
STORAGE_PROVIDER="local"                        # local | r2
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""

# App
NEXTAUTH_SECRET=""
BASE_URL="http://localhost:3000"
```

---

## Build Phases

### Phase 1 — Foundation
- [ ] Prisma schema + migrations
- [ ] Storage abstraction (local only)
- [ ] Project CRUD
- [ ] VideoSet upload + management
- [ ] Basic page builder (drag-and-drop, general element types)
- [ ] Static-only survey runner (no video)

### Phase 2 — Video Pipeline
- [ ] VideoSet block + video-aware element types in builder
- [ ] FFmpeg composite rendering (`fluent-ffmpeg`)
- [ ] Survey generation pipeline (sampling + permutation + job queue)
- [ ] Video survey runner (composite video player + slot-aware inputs)
- [ ] Generation status polling on project dashboard

### Phase 3 — Analytics & Export
- [ ] Completion tracking per survey
- [ ] Per-video score aggregation
- [ ] CSV export (slot → video_id resolution)
- [ ] Project dashboard stats

### Phase 4 — Production Readiness
- [ ] Swap SQLite → PostgreSQL
- [ ] Swap local storage → Cloudflare R2
- [ ] BullMQ + Redis job queue
- [ ] Admin authentication (NextAuth or Supabase Auth)
- [ ] Rate limiting on respondent endpoints

---

## Key Design Decisions Log

| Decision | Rationale |
|---|---|
| Pre-rendered composite videos | Eliminates browser-side multi-video sync entirely |
| Slot labels burned into video | Respondents can identify slots without UI labels overlaid on player |
| slot_map stored server-side | Responses can't be tampered with; export is trustworthy |
| Storage abstraction from day 1 | Local dev needs zero infra; production swap is one env var |
| SQLite local → PostgreSQL prod | Prisma handles both; no Docker needed for local dev |
| General survey builder + video layer | Platform is useful for non-video surveys too; video is an opt-in capability |
| Quota-aware set sampling | Ensures balanced VideoSet coverage even with small respondent pools |
