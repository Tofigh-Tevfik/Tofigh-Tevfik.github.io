# Flight Portfolio: Tofigh Hosseini

An interactive, single-page portfolio. Visitors fly an F450-style quadrotor around a small low-poly campus, and each building holds one project, with videos, photos, results and links.

## Run it

| Option | When to use it |
|---|---|
| Double-click `index.html` | Quick look. Everything works except embedded YouTube players, which open in a new tab instead. |
| Double-click `preview.bat` | Full local preview at http://localhost:8080/, including embedded YouTube. Close the window to stop. |

An internet connection is needed for Three.js (loaded from jsDelivr) and Google Fonts.

## Publish it

The site is fully static (no build step), so you can upload the folder as it is:

- **GitHub Pages:** push this folder to a repository, then go to Settings → Pages → Deploy from branch.
- **Netlify / Cloudflare Pages:** drag and drop the folder.

Every file is under GitHub's 100 MB limit. The largest is `assets/video/drone-flight.mp4` at 39 MB.

## Edit the content

All text, media and links are in **`js/content.js`**. Each building is one entry in `zones`:

- `title`, `kicker`, `subtitle`, `summary`, `points`: the text in the panel
- `media`: `video` (local mp4 + poster), `youtube` (video id) or `image`
- `links`, `tags`, `publication`, `timeline`, `chart`, `note`
- `pos: [x, z]` and `building`: where the building stands and which 3D model it uses

Deep links open a building directly, for example `index.html#px4`, `#cmpc` or `#kaaf`. These are useful in a CV or an email.

## Controls

- **Keyboard:** W/S forward and back · A/D turn · Q/E strafe · Space/Shift climb and descend · Enter opens the nearby building · M map · I project list · H help · Esc close
- **Mouse:** drag to look around, scroll to zoom. Click a building label or the minimap to fly there on autopilot.
- **Touch:** Mode-2 sticks. The left stick controls throttle and yaw, and the right stick controls pitch and roll.
- **No flying:** "Browse without flying" opens a plain list of every building.

## Files

```
index.html          page shell, HUD, panels
css/style.css       UI styles
js/content.js       all portfolio content (edit this)
js/world.js         3D world: buildings, drone dynamics, autopilot, camera
js/app.js           UI: input, HUD, minimap, panels, index, sound
assets/img/…        optimised figures and photos (from F:\CV and F:\Writings)
assets/video/…      local videos (flight test, CMPC, min-snap, co-simulation)
assets/docs/…       CV PDF
serve.ps1           tiny local web server (used by preview.bat)
```

## Notes

- The drone uses a simplified multirotor model: a velocity loop with acceleration limits, tilt derived from horizontal acceleration, and yaw-rate control. Autopilot flights follow a minimum-jerk reference that climbs only as high as the route's obstacles require. The HUD shows a PX4-style mode, such as POSCTL or AUTO.MISSION.
- Three.js r169's `ConeGeometry` drops faces when `heightSegments > 1`, so the mountains use a custom mesh.
- The site saves the visitor's list of explored buildings and their graphics-quality setting in their browser's local storage.
