# Catalog reference

Source: `examples/chat/lib/render/catalog.ts`.

## Layout and structure
- `Stack`: directional container with spacing/alignment.
- `Grid`: multi-column layout for cards/metrics/charts.
- `Card`: section grouping container.
- `Heading`: semantic heading text.
- `Separator`: visual section divider.
- `Accordion`: collapsible content groups.
- `Tabs` + `TabContent`: multi-view switcher.

## Content and data display
- `Text`: plain text (`content`, optional `muted`).
- `Metric`: KPI (`label`, `value`, optional `detail`, `trend`).
- `Table`: tabular data (`data`, `columns`, `emptyMessage`).
- `Link`: external link (`text`, `href`).
- `Badge`: compact status label.
- `Alert`: alert surface from shadcn catalog.
- `Callout`: emphasized block (`type`, `title`, `content`).
- `Timeline`: ordered events (`items[]` with `title`, `description`, `date`, `status`).

## Charts
- `BarChart`: categorical aggregates (`data`, `xKey`, `yKey`, optional `aggregate`).
- `LineChart`: time/trend series (`data`, `xKey`, `yKey`).
- `PieChart`: composition (`data`, `nameKey`, `valueKey`).

Use `{ "$state": "/path" }` for chart/table data props.

## Inputs and interaction
- `RadioGroup`: single-choice options.
- `SelectInput`: dropdown selector.
- `TextInput`: free-text value input.
- `Button`: click target for `on.press` actions.

Input values should use `{ "$bindState": "/path" }`.

## 3D containers
- `Scene3D`: root 3D scene container.
- `Group3D`: shared transform/animation wrapper.

## 3D primitives
- `Sphere`: args `[radius, widthSegments, heightSegments]`.
- `Box`: args `[width, height, depth]`.
- `Cylinder`: args `[radiusTop, radiusBottom, height, radialSegments]`.
- `Cone`: args `[radius, height, radialSegments]`.
- `Torus`: args `[radius, tube, radialSegments, tubularSegments]`.
- `Plane`: args `[width, height]`.
- `Ring`: args `[innerRadius, outerRadius, thetaSegments]`.

Common mesh props: `position`, `rotation`, `scale`, `color`, `args`, `metalness`, `roughness`, `emissive`, `emissiveIntensity`, `wireframe`, `opacity`, `animation`.

## 3D lighting and helpers
- `AmbientLight`: base illumination.
- `PointLight`: radial light from position.
- `DirectionalLight`: directional rays.
- `Stars`: starfield helper.
- `Label3D`: camera-facing text labels in scene space.
