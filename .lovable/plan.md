
## Activity Tracker Feature

### Overview

This feature extends the note-logging system so that each engagement entry can optionally record **quantified activity** — number of emails sent, phone calls made, etc. A new **Activity** tab will display aggregate analytics across all companies: total calls, emails, companies contacted, and trend charts.

### Part 1 — Extend the Engagement Data Model

The `Engagement` interface in `src/data/prospects.ts` currently has:
```
id, date, type ('call' | 'email' | 'meeting' | 'note'), summary, details
```

It will gain an optional `activity` object:
```typescript
activity?: {
  calls?: number;
  emails?: number;
}
```

This is additive — no existing data is broken. The field is stored inside the `engagements` JSONB column of the `prospects` table, so no database migration is required.

### Part 2 — Update the "Quick Note" Panel on Company Page

The current note input is a plain textarea + "Save Note" button. It will be upgraded to a small form that includes:

- The existing note textarea (unchanged)
- Two compact number spinners side-by-side:
  - **Calls made** (min 0, optional)
  - **Emails sent** (min 0, optional)
- Save button behavior unchanged — both fields are optional so existing workflow is not disrupted

When saved, the `handleAddNote` function in `src/pages/CompanyPage.tsx` will attach the non-zero values into `engagement.activity`.

The section title will change from "Quick Note" → **"Log Activity"** to match the header button already present.

### Part 3 — Update the Edit Note Dialog

`src/components/crm/EditNoteDialog.tsx` will gain the same two number inputs so existing entries can have their call/email counts updated or corrected.

### Part 4 — New Activity Tracker Page

A new component `src/components/crm/ActivityDashboard.tsx` will be created. It reads all prospects from `useProspects()`, flattens their engagements, and computes:

**Summary Cards (top row):**
| Metric | Derivation |
|---|---|
| Total Calls Made | Sum of `engagement.activity.calls` across all engagements |
| Total Emails Sent | Sum of `engagement.activity.emails` across all engagements |
| Companies Contacted | Distinct prospect IDs that have ≥1 engagement with any activity |
| Total Activities | Sum of all calls + emails logged |

**Charts (bottom section):**
- **Activity over time** — bar chart (weekly or monthly) showing calls vs emails side-by-side using Recharts (same library already used in `OrdersReportingDashboard`)
- **Activity by Company** — horizontal bar chart ranking top 10 most-contacted companies

### Part 5 — Add Activity Tab to Navigation

The `activity` view ID will be added to:

- `src/components/crm/Sidebar.tsx` — new nav item with `Activity` label and `BarChart2` icon
- `src/components/crm/MobileNav.tsx` — new bottom nav item
- `src/pages/Index.tsx` — new case in `renderView()`, `getViewTitle()`, `getViewSubtitle()`

### Files to Create / Edit

| File | Change |
|---|---|
| `src/data/prospects.ts` | Add `activity?: { calls?: number; emails?: number }` to `Engagement` interface |
| `src/pages/CompanyPage.tsx` | Extend `handleAddNote` + Quick Note UI with call/email count inputs |
| `src/components/crm/EditNoteDialog.tsx` | Add call/email count fields to edit form |
| `src/components/crm/ActivityDashboard.tsx` | **New** — full activity analytics dashboard |
| `src/components/crm/Sidebar.tsx` | Add Activity nav item |
| `src/components/crm/MobileNav.tsx` | Add Activity bottom nav item |
| `src/pages/Index.tsx` | Wire up new `activity` view |

No backend schema changes are needed. All data is stored within the existing `engagements` JSONB column.
