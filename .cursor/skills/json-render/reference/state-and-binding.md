# State and binding

## State model
- `/state` is the single source of truth.
- Emit patches first in stream specs:
  - `{"op":"add","path":"/state/foo","value":"bar"}`
- Bind later elements to initialized paths.

## Read-only binding
- Use `{ "$state": "/json/pointer" }` on any prop, any nesting level.
- Typical uses:
  - `Metric.value`
  - `Table.data`
  - chart `data`
  - visibility and condition inputs

## Two-way binding
- Use `{ "$bindState": "/json/pointer" }` for editable fields only.
- Typical uses:
  - `TextInput.value`
  - `SelectInput.value`
  - `RadioGroup.value`

## Conditional values
- Use `$cond` for conditional prop resolution:
```json
{
  "$cond": { "$state": "/submitted" },
  "$then": "Correct!",
  "$else": "Choose an answer"
}
```

## Conditional rendering
- `visible` is a top-level field on the element.
- Example:
```json
{
  "type": "Text",
  "props": { "content": "Submitted" },
  "visible": { "$state": "/submitted", "eq": true }
}
```

## Repetition
- `repeat` is a top-level field on the element.
- Example:
```json
{
  "type": "Card",
  "repeat": { "statePath": "/items" },
  "children": [
    { "type": "Text", "props": { "content": { "$state": "/$item/name" } } }
  ]
}
```

## Validation-sensitive placement
Never place these inside `props`:
- `visible`
- `on`
- `repeat`
- `watch`
