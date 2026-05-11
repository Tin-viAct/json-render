# Pattern: dashboard

## Goal
Build compact, information-dense views with KPIs, trends, and tabular detail.

## Recommended composition
- Root `Stack` (vertical).
- Top `Grid` with `Metric` cards for headline numbers.
- Mid section with `BarChart`/`LineChart`/`PieChart`.
- Bottom section with `Table` for detailed records.
- Add `Callout` for key caveats or attention items.

## Binding pattern
- Initialize data under `/state`.
- Bind read-only datasets using `$state`.

Example snippet:
```json
{
  "type": "Table",
  "props": {
    "data": { "$state": "/rows" },
    "columns": [
      { "key": "name", "label": "Name" },
      { "key": "value", "label": "Value" }
    ]
  }
}
```

## Rules
- Do not nest `Card` inside `Card`.
- Prefer `Grid` for side-by-side sections.
- Use `Metric` instead of plain text for KPIs.
