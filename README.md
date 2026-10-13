# DonghuaStream for Nuvio

A Nuvio **plugin repository** for donghuastream.org, version **1.0.4**. It searches for the title selected in Nuvio and resolves its available public video servers into native playback URLs. Install under **Plugins**, using the same repository format as FrameXTV.

The provider contract has been compared with Nuvio Android TV, NuvioMobile, NuvioDesktop and NuvioTVSmart. Read `COMPATIBILITY.md` for the checked versions, runtime replay results and build restrictions. Use a **plugin-enabled full build**: Android Play Store and iOS App Store variants disable this feature in their source code.

## Features

- Dailymotion, Rumble, All Sub Player (Streamplay), and OK.ru resolvers.
- Streams grouped by server, with numbered quality labels that preserve Auto-first, highest-to-lowest ordering when Nuvio Mobile/Desktop alphabetically re-sort plugin results.
- One source entry per available resolution for each server, plus adaptive HLS. Duplicate MP4/HLS resolutions are consolidated; MP4 is preferred for fixed resolutions and the highest advertised bitrate is retained among HLS variants.
- External subtitle files attached to the source that supplies them, with language names.
- English/Chinese title and alternative-title matching through TMDB.
- Local episode numbers and bracketed absolute numbers, with TMDB season counts used for continuous numbering.
- Independent server error handling; confirmed missing playlists are omitted.
- Promise-based ES5 JavaScript, with no build step, Node dependencies, DOM APIs, or execution of downloaded scripts in the provider.
- URL resolution compatible with Nuvio's limited URL constructors, including parent paths and query-only HLS links.
- Subtitle download headers preserved, and the `series`, `show` and `other` TV aliases accepted.

The plugin uses the TMDB key supplied by Nuvio's runtime. It contains no embedded API key. If your app does not supply `TMDB_API_KEY`, title lookup cannot run; configure TMDB in Nuvio or use a build that supplies this binding.



**GitHub description:**

```text
DonghuaStream provider for plugin-enabled Nuvio builds, with multiple video servers, available quality options, subtitles and TMDB title/episode matching.
```

## Audio, subtitles and qualities

The plugin returns source information; Nuvio controls its player menus. Open Nuvio's subtitle menu after starting playback to select an exposed subtitle file. A host's “English” server may contain subtitles burned into the video, which cannot be switched off.

Audio choices depend on the actual stream and TV player. A site advertising many subtitle languages does not imply that it offers audio dubbing in those languages. The plugin does not invent audio tracks. If an HLS variant depends on external audio or subtitle renditions, the parent master remains the source, with available resolutions listed in its title. This preserves those renditions instead of returning a child that loses sound or subtitles.

Qualities come from host metadata or HLS resolution fields. Cropped cinema frames are classified by width at the usual HD tiers. When HLS offers several variants at the same resolution, the highest advertised bitrate is kept; its title includes the bitrate.

## Validation

Read `VALIDATION.md` and `COMPATIBILITY.md` for the 47 automated checks, framework comparisons and live-host limitations observed during development.

The provider itself needs no npm installation. Developers can run:

```sh
npm install --ignore-scripts --no-audit --no-fund
npm test
```

The GitHub Actions workflow runs these checks on pushes and pull requests. `npm run test:live` performs a public-site smoke test using **fixture TMDB metadata** for Renegade Immortal S1E162 and live site/player requests. It requires Node 18+ and curl; its success is not proof of playback on a physical TV.

For a first in-app check, open **Renegade Immortal (2023), season 1, episode 162**. Confirm sources appear, play Rumble and OK.ru, and check available subtitle entries. Then try an early episode and a title split into several seasons.

## Known limits

- Availability changes with the website, video host, region, and device. Some hosts return expiring URLs tied to the requesting IP, so refresh sources if an old source stops working.
- Confirmed missing HLS URLs (404/410) are omitted. A failed or access-denied playlist probe retains the player-provided source because accessibility may differ on the TV; such a result is not guaranteed to play.
- Season 0 specials and movies split across multiple numbered parts need explicit mapping and are not guessed.
- Unknown host embeds and file-host download pages are not returned as playable media.
- This plugin finds streams for titles in Nuvio's catalog. It does not add a separate DonghuaStream catalog.
- Only public player data is used. There is no VIP, login, DRM, or human-verification flow.

## Files

```text
manifest.json
providers/donghuastream.js
README.md
VALIDATION.md
COMPATIBILITY.md
package.json
tests/validate.cjs
tests/live.cjs
.github/workflows/validate.yml
```


## Updating the plugin

Refresh this repository in Plugins settings and confirm provider version **1.0.4**. Reload the episode sources with the circular-arrow button; the app can cache results separately from provider code. New source labels include **01 - Auto**, then numbered descending resolutions. The manifest versions the provider download URL to refresh stale HTTP copies. Actual 108p streams are not relabeled as 1080p; low-resolution HLS tiers are normalized by width.
