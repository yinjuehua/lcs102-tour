# LCS-102 / The Bridge — experimental public demo

[Open the online demo](https://yinjuehua.github.io/lcs102-tour/bridge-demo/)

`bridge-demo/` is an independent experimental demo of an AI-assisted reconstruction of the LCS-102 bridge. It is a prototype for viewing and testing, not an official museum website, institutional publication, measured survey, or complete reconstruction.

## What is included

The static app uses PlayCanvas 2.23.3 and includes an approximate point-cloud scene, viewpoints, visual observations, navigation, atmosphere controls, and an optional **Repairs** layer. A sea-and-sky sphere surrounds the cabin behind transparent glass; a reversible splat filter removes the captured exterior instead of covering indoor objects with window images. The circular door porthole is emphasized as the main sunlight source. Gentle camera sway can be disabled in Help; Help also provides an original-exterior comparison. The scenic environment is generated and is not historical evidence. The point cloud is derived from a single 360° image, so occlusion, stretching, missing surfaces, and local geometry remain approximate. The observations are visual notes, not verified historical or technical claims.

The **Repairs** layer contains surfaces inferred from visible form. It is not measured restoration, a complete cabin model, or evidence that the original surfaces looked that way.

The scenic preview includes a dark inferred cap beneath the captured deck to prevent sea showing through missing floor surfaces. The sea has mild optical defocus and mirrored panorama wrapping. Window glow is reduced to half its previous emitted strength; camera-aligned lens ghosts fade with visible light sources, and 440 airborne motes drift through the cabin. These are presentation choices, not recovered source detail.

Review notes are not sent to a server by this static app. They stay in this browser's `localStorage` and can be exported as JSON from the Review panel. Clearing browser or site data can remove local notes.

The first load is approximately 11 MB. Use a modern browser with WebGL2 enabled.

## Local preview and edits

This copied `bridge-demo/` directory runs without npm or a build step:

```bash
cd bridge-demo
python3 -m http.server 8000
```

Open <http://127.0.0.1:8000/> in a modern WebGL2 browser. The static files are directly editable; for example, change `app.js`, `tour-data.js`, or `style.css`, then reload the page to inspect the result.

## Asset rights

Photographs, source imagery, point-cloud/model data, generated scene assets, and other third-party material retain the rights and permissions that already apply to them. Publishing this demo does not grant an additional public-domain, MIT, or other open-source license, and no new reuse permission is implied. Reuse assets only when you have the necessary permission.
