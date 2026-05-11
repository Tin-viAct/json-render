# Actions

## Event binding
- Use element-level `on.press` for click interactions.
- `Button` is the common action trigger, but any supported component can expose events.

Example:
```json
{
  "type": "Button",
  "props": { "label": "Submit" },
  "on": {
    "press": {
      "action": "setState",
      "params": { "statePath": "/submitted", "value": true }
    }
  }
}
```

## Built-in actions
- `setState`: set value at path.
  - params: `{ "statePath": "/foo", "value": "bar" }`
- `pushState`: append value to array path.
  - params: `{ "statePath": "/items", "value": { ... } }`
- `removeState`: remove array item by index.
  - params: `{ "statePath": "/items", "index": 0 }`

## Action param expressions
- Action params can reference current repeat context values.
- Common placeholders:
  - `$item`
  - `$index`

Example:
```json
{
  "action": "pushState",
  "params": {
    "statePath": "/selected",
    "value": {
      "name": "$item.name",
      "index": "$index"
    }
  }
}
```

## Practical pattern
- Keep source arrays in `/state`.
- Render rows/cards with `repeat`.
- Use `on.press` to mutate summary/selection state.
- Gate feedback with `visible` and `/submitted` flags.
