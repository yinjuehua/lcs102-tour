# LCS-102 / The Bridge — experimental public demo

[Open the online demo](https://yinjuehua.github.io/lcs102-tour/bridge-demo/)

This page is an independent experimental demo of an AI-assisted reconstruction of the LCS-102 bridge. It is a prototype for viewing and testing, not an official museum website, institutional publication, measured survey, or complete reconstruction.

## What is included

The static app uses PlayCanvas 2.23.3 and includes an approximate point-cloud scene, three viewpoints (Origin, Framework, Table Exhibits), visual observations, navigation, and atmosphere controls. The point cloud is derived from a single 360° image, so occlusion, stretching, missing surfaces, and local geometry remain approximate. The observations are visual notes, not verified historical or technical claims.

- **Exterior**: a generated sea-and-sky sphere surrounds the cabin behind transparent glass. A reversible splat filter removes the captured exterior instead of covering indoor objects with window images. Help → Advanced settings offers an original-exterior comparison. The scenic environment is not historical evidence.
- **Light**: one low sun enters through the aft windows behind the table. The captured room receives it through a baked, inferred sun-visibility volume, which gives the table its dappled light. The door porthole is soft skylight. Volumetric fog limited to the cabin shows light shafts, airborne motes glow inside them, and a hover spotlight highlights objects.
- **Camera and image**: depth of field with autofocus, bloom, soft chromatic fringing, vignette, and gentle camera sway (can be disabled in Help). Quality starts on Smooth on touch-first or low-power devices and steps down automatically if the frame rate stays low; choosing a quality yourself turns this off.
- **Exhibits**: a compass (ChickenHatMan, CC BY 4.0) and a sextant (Happymiel4, CC BY 4.0) are demonstration models, not artifacts from LCS-102. The binoculars open a binocular sea view with a generic WWII-style reticle. The door opens and closes.
- **Clay view** (Help → Advanced settings) shows the room in plain gray to read form, light, and shadow.

The dark cap beneath the captured deck, the olive backing below the window sills, the baked lighting, and the scenic exterior are presentation choices, not recovered source detail.

The Review notes and Repairs layer from the earlier version are hidden in this version.

The first load is approximately 23 MB (the two exhibit models add about 11.5 MB). Use a modern browser with WebGL2 enabled.

## Asset rights

Photographs, source imagery, point-cloud/model data, generated scene assets, and other third-party material retain the rights and permissions that already apply to them. Publishing this demo does not grant an additional public-domain, MIT, or other open-source license, and no new reuse permission is implied. Reuse assets only when you have the necessary permission.
