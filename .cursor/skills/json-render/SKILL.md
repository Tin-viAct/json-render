---
name: json-render
description: Author and edit json-render UI specs (catalog components, /state, $bindState, $cond, repeat, on.press, actions). Use when requests mention json-render, JSON UI specs, dashboards, quizzes, permit forms, or 3D scenes.
---

# json-render skill

## When to apply
- The task asks for a json-render spec, spec edits, or conversion from requirements to UI JSON.
- The repo uses `@json-render/*` packages or the user references `spec` fenced output.
- The UI needs dashboards, forms, quizzes, or 3D scenes with data binding.

## Mental model
- A spec is `state` plus an element tree.
- Expressions (`$state`, `$bindState`, `$cond`) are resolved before components receive props.
- Components render from the catalog only; actions mutate state through `on.press`.

## Authoring rules
- Emit `/state` patches before elements that reference those values.
- Use `{ "$state": "/path" }` for read-only binding.
- Use `{ "$bindState": "/path" }` only for user-editable inputs.
- Keep `visible`, `on`, `repeat`, and `watch` as top-level element fields, not inside `props`.
- Do not nest `Card` inside `Card`.
- Do not use viewport-height classes like `h-screen` or `min-h-screen`.
- Do not invent components outside the catalog.
- For EPTW `DATE`, map to `TextInput` with `type: "text"` and `placeholder: "YYYY-MM-DD"`.

## Expression cheat sheet
```json
{ "$state": "/metrics/total" }
{ "$bindState": "/form/name" }
{
  "$cond": { "$state": "/submitted" },
  "$then": "Submitted",
  "$else": "Pending"
}
{
  "visible": { "$state": "/mode", "eq": "advanced" }
}
{
  "repeat": { "statePath": "/items" }
}
{
  "on": {
    "press": {
      "action": "setState",
      "params": { "statePath": "/submitted", "value": true }
    }
  }
}
{
  "on": {
    "press": {
      "action": "pushState",
      "params": { "statePath": "/todos", "value": { "title": "$item.title" } }
    }
  }
}
```

## Component picker (quick)
- `Stack`: vertical/horizontal flow layout.
- `Grid`: multi-column dashboard sections.
- `Card`: grouped section container (single level).
- `Metric`: key KPI values.
- `Table`: row/column data.
- `BarChart`/`LineChart`/`PieChart`: trend and distribution.
- `Callout`: highlighted information or warnings.
- `Accordion`/`Timeline`: educational and long-form content.
- `TextInput`/`SelectInput`/`RadioGroup`: two-way form input.
- `Button`: submit and state-mutating actions.
- `Scene3D` + 3D primitives/lights/helpers: interactive spatial visuals.

## Pattern index
- Dashboard: `reference/patterns/dashboard.md`
- Quiz: `reference/patterns/quiz.md`
- EPTW permit form: `reference/patterns/eptw-form.md`
- 3D scenes: `reference/3d-scenes.md`
- Runnable examples: `examples/*.spec.jsonl`

## Validation
From repo root:
```bash
node .cursor/skills/json-render/scripts/validate-spec.mjs .cursor/skills/json-render/examples/minimal-dashboard.spec.jsonl
```

Validator modes:
- Preferred: uses `@json-render/core` `validateSpec` when importable.
- Fallback: uses robust schema + rule checks (state patches, root element, and `visible/on/repeat/watch` placement).

## Progressive disclosure
- Full catalog and component props: `reference/catalog.md`
- State and binding semantics: `reference/state-and-binding.md`
- Actions and event wiring: `reference/actions.md`
- 3D scene authoring details: `reference/3d-scenes.md`
