# 3D scenes

## Core rules
- `Scene3D` must be the root ancestor of all 3D components.
- Set `height` (for example `"500px"`), optional `background`, and `cameraPosition`.
- Include at least one `AmbientLight` so meshes are visible.

## Primitives and transforms
- Use `Sphere`, `Box`, `Cylinder`, `Cone`, `Torus`, `Plane`, `Ring`.
- Common transform props:
  - `position: [x, y, z]`
  - `rotation: [x, y, z]`
  - `scale: [x, y, z]`
- Materials:
  - `color`, `metalness`, `roughness`, `emissive`, `emissiveIntensity`, `wireframe`, `opacity`

## Animation behavior
- `Group3D` supports `animation: { rotate: [x, y, z] }`.
- Rotation values are applied every frame; keep values small.
- Good orbit speeds: `0.0005` to `0.003`.
- Values above `0.01` usually look too fast.

## Orbit pattern
- Put an object inside `Group3D` with Y rotation animation.
- Place the child mesh at orbital radius on X axis.
- The group rotation produces orbit motion.

Example:
```json
{
  "type": "Group3D",
  "props": { "animation": { "rotate": [0, 0.001, 0] } },
  "children": [
    {
      "type": "Sphere",
      "props": { "position": [15, 0, 0], "args": [0.8, 16, 16], "color": "#4B7BE5" }
    }
  ]
}
```

## Lighting
- `AmbientLight` for global baseline.
- `PointLight` for localized emitters (sun, lamps).
- `DirectionalLight` for directional source light.

## Helpers
- `Stars` for space backgrounds (`count: 5000`, `fade: true` is a good default).
- `Label3D` for object labels that face camera.
- `Ring` rotated with `[-1.5708, 0, 0]` for orbit guides.

## Solar system expectations
- Include Sun + all 8 planets when asked for a full solar system.
- Combine orbital `Group3D` rotation with optional self-rotation on planets.
