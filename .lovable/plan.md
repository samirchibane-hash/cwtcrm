
## Two Small Changes to ActivityDashboard

### Change 1 — Default period to Daily
Line 35: `useState<Period>('weekly')` → `useState<Period>('daily')`

### Change 2 — Swap Line chart for Bar chart
- Replace the `LineChart`, `Line` imports with `BarChart`, `Bar`
- Replace the `<LineChart>` component with `<BarChart>`
- Replace the two `<Line>` elements with `<Bar>` elements, keeping the same `dataKey`, `name`, and color fills via `fill` (instead of `stroke`)
- Add `radius={[4, 4, 0, 0]}` to the bars for a slightly rounded top edge

### File to Edit
- `src/components/crm/ActivityDashboard.tsx` only
