---
name: pixel-office-25d
description: 2.5D Stardew-modern pixel office for the Agentic AI Translation Company. Use when redesigning the office scene, lighting, isometric depth, fullscreen detail mode, or character sprites in this project.
---

# Pixel Office HD-2D

Octopath Traveler (Square Enix) is the lighting target: pixel characters on a cinematic 2.5D set, volumetric god-rays, bloom, haze, vignette, foreground parapet, tilt-shift depth.

## Visual rules

- **Camera**: Painted 16:9 plate (960×540). Y is depth. Cover-scale to the office pane (oy bias ~0.46 so rooms and desks both show). Characters are 24×36 nearest-neighbour sprites drawn 2×.
- **Layers**: The live set is `frontend/public/scene/office-interior.jpg` (Option A). Desks, machines, and the parapet are **plate-slice occluders** Y-sorted with people so staff can stand inside/outside a room and in front of/behind a table.
- **Set**: Contemporary office (glass door on the **left**, printers, vending, coffee). Manager / Editor / Master are back-wall glass rooms. Four rug desks in the foreground.
- **Light**: Warm shafts from the left window, bloom, haze. Stronger in `rich` / fullscreen.
- **Assets**: Keep the painted plate. Do not replace it with a flat procedural shell. Seat and occluder coordinates live in `frontend/src/scene/world/layout.js` and must stay aligned to the painting.

## Related skills

- `pixel-art-sprites` — silhouette, limited palette
- `pixijs-filters` — bloom / blur / color matrix equivalents
- `threejs-postprocessing` / `threejs-shaders` — UnrealBloom, DOF, composer patterns
- `pixijs` / `pixijs-2d` — optional engine migration
