# Pattern: quiz

## Goal
Build interactive multiple-choice checks with immediate correctness feedback.

## State setup
- One answer state path per question.
- One submission flag per question.

Example patches:
```json
{"op":"add","path":"/state/q1","value":""}
{"op":"add","path":"/state/q1_submitted","value":false}
```

## Per-question structure
- `Card`
  - `Text` or `Heading` prompt
  - `RadioGroup` with `{ "$bindState": "/q1" }`
  - `Button` with `on.press -> setState("/q1_submitted", true)`
  - Correct feedback element with `visible`
  - Incorrect feedback element with `visible`

## Visibility logic
- Show feedback only after submit.
- Separate visible conditions for correct and incorrect cases.

Example:
```json
{
  "type": "Text",
  "props": { "content": "Correct!" },
  "visible": [
    { "$state": "/q1_submitted", "eq": true },
    { "$state": "/q1", "eq": "b" }
  ]
}
```
