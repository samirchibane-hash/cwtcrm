
## Add Include / Exclude Toggle to Filters

Currently, checking items in a filter dropdown means "show only these". The goal is to let users switch each filter between **Include** mode (show only selected) and **Exclude** mode (hide selected), per filter.

### Approach

Each of the four filter dropdowns (Business Model, Stage, Lead Tier, Product Vertical) will get:

1. A **mode toggle** at the top of the dropdown — two small pill buttons: "Include" and "Exclude".
2. The filter button badge will change appearance to signal exclusion mode (e.g. a strikethrough style or a different colour like red/orange).
3. The filtering logic will invert for any filter whose mode is set to "Exclude".

### State Changes — `ProspectsTable.tsx`

Four new state variables tracking the mode per filter (defaulting to `'include'`):

```
typeFilterMode: 'include' | 'exclude'
stageFilterMode: 'include' | 'exclude'
leadTierFilterMode: 'include' | 'exclude'
verticalFilterMode: 'include' | 'exclude'
```

These will also be persisted in the URL as query params (e.g. `typeMode=exclude`) so the state survives navigation.

### Filtering Logic Changes

For each filter, the match check becomes:

```
// Include mode (current behaviour)
const matchesType = typeFilter.length === 0 || typeFilter.includes(prospect.type);

// Exclude mode (new)
const matchesType = typeFilter.length === 0 || !typeFilter.includes(prospect.type);
```

The mode variable simply swaps the `||` path.

### UI Changes

Inside each dropdown, a mode selector will appear above the list of options:

```text
┌──────────────────────────────┐
│  [  Include  ] [  Exclude  ] │  ← toggle row
├──────────────────────────────┤
│ ☑ Residential                │
│ ☐ Commercial                 │
│ ☑ Both                       │
└──────────────────────────────┘
```

The active filter badge on the button will show differently in exclude mode — e.g. a red/destructive background — so the user can tell at a glance that the filter is hiding rather than showing.

### Files to Edit

- **`src/components/crm/ProspectsTable.tsx`** — all state, URL sync, filtering logic, and dropdown UI changes.

No backend or data model changes are needed. The change is entirely in the front-end filtering component.
