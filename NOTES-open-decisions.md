# LCS-102 ThingLink tour — open decisions

_Last updated: 2026-09-29_

## 1. Merge the tags of each stop into one embed (Aaron's view, on hold)

**Status:** On hold. Nothing changed yet. Check with Arthur / Gina first.

**Current build (stops 2–7):** up to 3 Embed tags per scene
- Story (`stop-0X.html`): paged copy + ship tour video
- Learn more (`stop-0X-more.html`): recommended video + 4 reference categories as tabs
- Then and now (`stop-0X-thennow.html`): timeline, stops 3–7 only

**Aaron's view:** Three separate tags feel odd. The three parts tell one story and are not tied to a physical spot in the 360° scene. Visitors have to guess which icon is which. Better: **one Embed tag per stop**, with three tabs inside: *The story / Learn more / Then and now*. Plus one Transit tag.

**What the build guide actually says:**
- The only hard rule: "the copy and the links are exact."
- Tag types ("A block of copy goes in a Text & media tag. A video goes in an Embed tag…") describe native ThingLink tags, not a rule on how many tags.
- Placement lines (e.g. Stop 3: "Copy on the gun mount. Then and Now on the deck below it.") sit under "Options for this scene" and are suggestions: "that is a starting point… you can choose differently."
- So merging does not break the guide.

**Question for Arthur / Gina:** Do they care that Then and Now sits in a separate physical spot in the scene (e.g. on the deck)? If not, merge.

**Work if approved:** Small. Tab code already exists in `tour.js`. Move Learn more and Then and now into panels inside each `stop-0X.html`, update the embed checklist, and remove the extra tags in ThingLink.

## 2. Ship tour video (ABC10 YouTube): what Aaron actually did (2026-09-29)

- **Opening scene (Stop 1):** full video embedded.
- **Cut segments: only 2 places.** One on the gun scene, one on the galley scene.
- **Nowhere else.** Aaron's reasons:
  - Most segments are too short to be worth it.
  - Many scenes have no matching footage in the video.
  - The longest usable segment was the crew sleeping quarters (berthing), but that stop seems to have been dropped, so that cut is not used anywhere.
- **Done 2026-09-29:** removed the full-video last page from stops 2–6 and 9 (only Stop 1 keeps the YouTube video). Added MP4 clips: `videos/50-caliber-gun.mp4` on Stop 2 page 1, `videos/galley.mp4` on the galley quiet stop. Autoplay is muted (browser rule) with a Sound on button. All videos have a Full screen button; embed codes now need `allowfullscreen`.
- ~~Follow-up for the HTML (not done yet):~~ `stop-02` to `stop-06` and `stop-09` still end with a full-video page. That no longer matches the ThingLink build. Remove those pages, or clip them to Aaron's two segments (start/end seconds needed). `quiet-berthing.html` is unused.

## 3. Other open items

- **Stop 9 hero cards:** All links are listed (guide lists them all). The guide says to embed videos only if the scene has room, otherwise use links. Proposal: show videos as links, not players, to keep the wall quiet.
- **"Milestone N" in scene names and the small top line:** Proposal to drop it for visitors. Confirm with Arthur.
- **Stop 8 "The Last of Both":** Its route-table row was struck out, but its section is still in the guide. Confirm whether it stays and where.
- **Stop 10 location:** Still not decided.
- **Stop 11 opening line:** Still contains the editor note "(view other parts of the ship through the map??)".
- **Stop 6 Then and now:** The last line has no period (as in the guide).
