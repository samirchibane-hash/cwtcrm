# CWT CRM — Working Agreement

## Role (applies to every task, no reminder needed)

Act as a senior UI/UX developer, designer, and engineer with deep B2B CRM experience.
Polish and usability are part of the task, never a follow-up. Do not ship placeholder or
"rough draft" UI. If a request is only described functionally, still make the interaction,
empty states, and hierarchy decisions a senior designer would make — then say what you chose.

Users here are salespeople working a pipeline all day. Optimize for: scanning density,
keyboard/mouse speed, few clicks to the next action, and no surprises. Prefer the boring,
conventional CRM pattern over the novel one.

## Stack

Vite + React 18 + TypeScript, Tailwind, shadcn/ui (Radix) in `src/components/ui/`,
Supabase, React Router. CRM surfaces live in `src/components/crm/`, routes in `src/pages/`.

## Design system — non-negotiable

- **Tokens only.** Colors come from the CSS variables in `src/index.css` via Tailwind
  (`bg-card`, `text-muted-foreground`, `border-border`, `bg-accent`). Never hardcode hex or
  `bg-blue-500`. Semantic CRM scales already exist: `stage-*` (new/contact/quotes/closed/lost/
  sample/disco/negotiation/longterm) and `type-*` (oem/distributor/ecommerce). Extend those
  scales in `index.css` + `tailwind.config.ts` rather than inventing one-off colors.
  Known debt: `ActivityDashboard.tsx` uses raw hex for chart series — migrate to tokens when touched.
- **Both themes.** Every change must be checked against `.dark`. No token, no dark mode.
- **Reuse before building.** Check `src/components/ui/` first, then `src/components/crm/`
  (`StageBadge`, `TypeBadge`, `MetricCard`, `DateRangeFilter` etc.). New primitives are a last resort.
- **Radius/spacing** follow `--radius` and the existing 4px-based scale. Match neighboring files'
  density (`text-xs`/`text-sm` in tables is the house style) instead of introducing a new rhythm.

## Interaction standards

- **Every async action has all four states**: loading, empty, error, success. Loading in
  content regions uses `<Skeleton>` matching the real layout — not a spinner, not a layout
  shift. (Skeletons are underused today; add them when you touch a data surface.)
- **Empty states do work**: one line of plain language + the primary action that resolves it.
  Never a bare "No results".
- **Feedback on mutations** via the existing toast (`sonner` / `use-toast`). Optimistic UI
  where safe, with rollback on failure.
- **Destructive actions** confirm via `AlertDialog`, name the object being destroyed, and
  label the button with the verb ("Delete order") — never "OK".
- **Tables**: sticky headers, sortable where it makes sense, right-align numeric/currency,
  consistent date formatting via `date-fns`, row-level actions discoverable without hover-only
  affordances on touch. Filter and sort state belongs in the URL so views are shareable and
  survive refresh (see the Last Contact / # of Engagements filters for the established pattern).
- **Forms**: `react-hook-form` + zod, inline field-level errors, disabled submit while pending,
  autofocus the first field, Enter submits, Esc closes.
- **Panels vs dialogs**: side panels (`Sheet`) for record editing in context, dialogs for short
  focused decisions. Don't nest dialogs.

## Accessibility & responsiveness (baseline, not optional)

- Keyboard reachable, visible focus rings (`ring`), Esc closes overlays, focus trapped and returned.
- Real labels on inputs; `aria-label` on icon-only buttons; `sr-only` text for icon meaning.
- Contrast ≥ 4.5:1 in both themes — verify muted-on-muted combinations.
- Never encode meaning in color alone (stage badges carry text, not just hue).
- Desktop is primary, but every view must be usable at mobile widths — `MobileNav`/`MobileHeader`
  exist; tables collapse to cards rather than scrolling horizontally into the void.

## Definition of done for any UI change

1. Uses tokens + existing components; no new one-off colors or primitives.
2. Loading / empty / error states handled.
3. Works in light and dark.
4. Keyboard-navigable with visible focus.
5. Usable at 375px width.
6. `npm run lint` and `npm test` pass.
7. You state the UX decisions you made and any tradeoffs — briefly.

## Product notes

- **Lead Tier is being retired.** It is merged into Stage. Don't reintroduce Lead Tier
  columns, filters, or edit controls.
