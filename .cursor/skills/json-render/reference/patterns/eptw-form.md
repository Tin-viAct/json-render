# Pattern: EPTW form

Source basis: `examples/chat/lib/prompts/eptw-form.ts`.

## Triggers
Use this pattern when prompts mention permit/PTW/EPTW/JSA/RAMS/checklist/inspection/safety form/work request.

## Mapping rules
- `TEXT_INPUT` -> `TextInput` (`type: "text"`, `value: { "$bindState": "/form/<field>" }`)
- `SELECT_BOX` -> `SelectInput` with cleaned options:
  - drop options with empty label
  - if every option value is null, use label as both `value` and `label`
- `DATE` -> `TextInput` (`type: "text"`, `placeholder: "YYYY-MM-DD"`)
- `TITLE_DESCRIPTION` -> `Heading` + muted `Text`
- `TABLE` -> read-only `Table`, or `Callout` placeholder when schema is missing
- required field -> append `*` to field label

## Layout
- Root: vertical `Stack`.
- Render sections by ascending `section.order`.
- One `Card` per section.
- In section card:
  - header row with `Heading` and optional `Badge` role
  - body stack with fields ordered by `field.order`
- Add final `Submit` button setting `/submitted` to `true`.

## Required state patches
```json
{"op":"add","path":"/state/form","value":{}}
{"op":"add","path":"/state/form/<field>","value":""}
{"op":"add","path":"/state/submitted","value":false}
```

## Hard rules
- Do not nest `Card` inside `Card`.
- Do not emit canonical EPTW payload under `/state` (only form values + submitted flag).
- Do not invent components for input types; map using rules above.
- Always bind editable fields with `$bindState`.
