# Hummingbird, robin and goldfinch

A real-time Three.js bird scene in one offline HTML file. Open `index.html`, or the live page:

https://allowistic.github.io/hummingbird-scene/

![The three birds, perched and flying](screenshots.png)

## What's in it

- **Hummingbird** (purple-throated mountain-gem): Theo Tillberg's rigged, feathered hummingbird. It now flies a tour round the scene every so often: it darts to three to five points round the twig, hovers at each with its wings a blur, then comes back and lands.
- **American robin** (the songbird): steady flaps with short glides, hops along the twig, looks about, flicks its tail and sings.
- **American goldfinch** (the finch): the finch's bounding flight, a burst of flaps then wings shut, rising and dipping. Hops, sings and flicks its tail too.
- **Bird picker** (bottom right, next to the menu): Hummingbird, Robin, Goldfinch. It swaps the bird on screen and its voice together.
- **Sound**: the music note in the bird menu (or the S key) turns synthesized bird sound on and off. Made with Web Audio in the page, no audio files.
- The settings card still has animation speed, time of day, slow camera drift and performance mode, and pause works for every bird. F makes the current bird fly.

## Credits

- Original hummingbird scene, rig, feathers, perch and environment: **Theo Tillberg**, Codevember 2026, day 12, MIT License. https://github.com/ttillberg/codevember-2026/tree/main/12
- Found via the version ezshine posted on X.
- Robin and goldfinch: modeled procedurally in code for this build (`source/src/extra/smallBirds.ts`). No third-party models, textures or sounds are used for them.
- Bird sound: synthesized in the page (`source/src/extra/sound.js`).
- three.js, MIT License, three.js authors.

## Source

`source/` holds the TypeScript project. Build it with `npm install` then `npx vite build`; the single-file page lands in `dist/index.html`.

MIT License, see `LICENSE`.
