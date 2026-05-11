import type { PromptAdapter } from "./types";

/**
 * Prompt adapter for EPTW-style permit / safety forms.
 *
 * Activates when the user (or an MCP tool result) describes a permit, PTW,
 * EPTW, JSA, RAMS, checklist, inspection, safety form, or any payload shaped
 * as `{ sections: [{ title, order, fields: [...] }] }`. Falls back to other
 * agent behavior (dashboards, 3D, quizzes) for non-form prompts.
 *
 * Renders sections-and-fields data using the existing json-render chat
 * catalog (Card / Stack / Heading / Badge / TextInput / SelectInput / Table /
 * Button) and binds inputs to `/state/form/<field>`. Does NOT emit a
 * canonical EPTW JSON to state, by design.
 */
export const eptwFormPromptAdapter: PromptAdapter = {
  name: "eptw-form",
  description:
    "Renders EPTW-style permit/safety forms (sections + fields) using the json-render chat catalog, with inputs bound to /state/form/<field>.",
  prompt: `PERMIT / FORM MODE:
Activate this mode when the user request, or any tool/MCP result, involves a structured permit or safety form. Otherwise, fall back to the existing dashboard / 3D / quiz behavior.

TRIGGERS (any one is enough):
- Keywords in the user prompt: permit, PTW, EPTW, JSA, RAMS, checklist, inspection, safety form, work request, hot work, confined space, lifting, excavation, road closure, electrical work.
- An MCP tool (e.g. mcp_viact_kb_*) returns a payload shaped like { sections: [{ title, order, fields: [{ component, label, field, ... }] }] }.

EPTW -> JSON-RENDER COMPONENT MAPPING:
- TEXT_INPUT       -> TextInput, type="text", value: { "$bindState": "/form/<field>" }
- SELECT_BOX       -> SelectInput, options from componentProps.options. Drop options whose label is empty. If every option value is null, use the option label as both value and label. value: { "$bindState": "/form/<field>" }
- DATE             -> TextInput, type="text", placeholder "YYYY-MM-DD", value: { "$bindState": "/form/<field>" }   (the catalog has no native date input)
- TITLE_DESCRIPTION -> Heading (level 4) for the title + Text (muted: true) for the description
- TABLE            -> read-only Table with columns derived from componentProps; if no schema is given, render a Callout placeholder explaining the missing schema
- rules.rules.isRequired === true -> append " *" to the field label string

SECTION LAYOUT:
- Root element: Stack (vertical, gap="md").
- One Card per entry in sections[], rendered in ascending order by section.order.
- Inside each Card:
  - Header row: Stack (horizontal) with a Heading (level 3) showing the section title, plus an optional Badge showing the section role (e.g. "all_users", "safety_officer").
  - Body: Stack (vertical) containing fields[] rendered in ascending order by field.order using the mapping above.
- After the last Card, append a final Button labeled "Submit" with on.press = setState /submitted = true.

STATE INITIALIZATION (emit BEFORE any element):
- {"op":"add","path":"/state/form","value":{}}
- For every field across all sections: {"op":"add","path":"/state/form/<field>","value":""}
- {"op":"add","path":"/state/submitted","value":false}

HARD RULES:
- Do NOT nest Card inside Card. For sub-sections inside a Card, use Stack + Separator + Heading.
- Do NOT emit /state/eptw or any canonical sections JSON. The state must contain only form values plus the submitted flag.
- Do NOT invent components such as DATE, CHECKBOX, RADIO_GROUP at the top level. Use only the mapping above.
- Always order sections and fields by their order property.
- Bind every input via { "$bindState": "/form/<field>" }. Never hardcode default values into the spec.

WORKED MINI-EXAMPLE (for a tiny "Work Request" section):
\`\`\`spec
{"op":"add","path":"/state/form","value":{}}
{"op":"add","path":"/state/form/permit_type","value":""}
{"op":"add","path":"/state/form/facility_name","value":""}
{"op":"add","path":"/state/form/work_date","value":""}
{"op":"add","path":"/state/submitted","value":false}
{"type":"Stack","props":{"direction":"vertical","gap":"md"},"children":[
  {"type":"Card","children":[
    {"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":[
      {"type":"Stack","props":{"direction":"horizontal","gap":"sm","align":"center"},"children":[
        {"type":"Heading","props":{"level":3,"text":"Work Request"}},
        {"type":"Badge","props":{"text":"all_users"}}
      ]},
      {"type":"SelectInput","props":{"label":"Permit Type *","value":{"$bindState":"/form/permit_type"},"placeholder":"Select permit type","options":[
        {"value":"Hot Work","label":"Hot Work"},
        {"value":"Confined Space Entry","label":"Confined Space Entry"},
        {"value":"Excavation","label":"Excavation"}
      ]}},
      {"type":"TextInput","props":{"label":"Facility Name","value":{"$bindState":"/form/facility_name"},"placeholder":"Enter facility name","type":"text"}},
      {"type":"TextInput","props":{"label":"Date","value":{"$bindState":"/form/work_date"},"placeholder":"YYYY-MM-DD","type":"text"}}
    ]}
  ]},
  {"type":"Button","props":{"label":"Submit","variant":"default"},"on":{"press":{"action":"setState","params":{"statePath":"/submitted","value":true}}}}
]}
\`\`\`
`,
};
