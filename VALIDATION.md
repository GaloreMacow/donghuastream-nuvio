# Validation report

Version: **1.0.1**. Checked on **13 October 2026**.

## Automated checks

**39 checks passed** with `tests/validate.cjs`:

- Manifest validity, unique provider ID, matching versions, and existing file paths.
- ES5 syntax, allowed runtime dependency, and absence of Node, DOM, timer, or downloaded-script execution requirements in the provider.
- Invalid inputs and missing TMDB configuration fail cleanly.
- English/Chinese title matching, movie/TV filtering, local and absolute episode numbering, bracket numbers, and refusal to guess unmatched seasons or specials.
- All four server selectors, protocol-relative URLs, base64 decoding, and duplicate suppression.
- Parent-directory and query-only HLS URLs resolved correctly even under Nuvio's limited URL constructors.
- Stream type and subtitle request headers preserved, and `series`/`show`/`other` TV aliases accepted.
- HLS resolution parsing, relative variants, and preserving parent masters for external audio/subtitle renditions.
- External subtitle attachments and ISO language codes; thumbnail tracks excluded.
- Missing playlists and HTML errors omitted; transient/access failures handled separately.
- Mocked complete TMDB → site search → episode → public player resolution, with one broken server and three successful resolvers.
- Provider loading and deterministic helper execution in QuickJS.

Separately, the actual compatibility functions from NuvioTVSmart's `pluginWorker.js` were loaded into QuickJS. A replay of captured site/player responses completed the full `getStreams` path, with the real URL/fetch/cheerio compatibility interfaces and the conservative **four-document parser quota**. This exercised the installed provider script, not a rewrite of its logic.

The updated provider also completed equivalent replays with the actual JavaScript bindings extracted from **NuvioTV release 1.0.0**, **NuvioTV's current dev branch**, and **NuvioMobile's current shared bindings**. NuvioDesktop's checked shared-binding file has the same SHA-256 as NuvioMobile's. Each replay returned 17 source entries across Dailymotion, Rumble and OK.ru from captured responses; replay fixtures differ slightly from the fresh live responses. See `COMPATIBILITY.md` for exact snapshots.

The replay used mocked network responses. It verifies runtime integration, not live connectivity or TV hardware decoding. Its temporary host adapter is not part of the distributed plugin.

## Live public-site test

Test title: **Renegade Immortal (2023), TMDB 223911, S1 E162**.

TMDB metadata was supplied as a test fixture. The site search, series page, episode page, public player data, and playlist requests were fetched live. This is not a live authenticated TMDB test.

The refreshed v1.0.1 live lookup returned **16 source entries across three servers** in approximately 43 seconds. The resolvers for all four observed hosts were exercised; the confirmed dead All Sub Player playlist was omitted. Dailymotion's retained result remains unverified for playback.

| Server | Observed result | Playback evidence / limitation |
| --- | --- | --- |
| Rumble | Adaptive master and six variants, including 1440p, 1080p and 720p; 16 external subtitle URLs | Master and 720p child playlist fetched. A media segment returned HTTP 200 and ffprobe confirmed H.264 video plus AAC audio. Full-episode and TV playback were not tested. |
| OK.ru | Eight direct quality URLs through 4K | Public player metadata parsed. The CDN returned an HTML “Site Unavailable” response here, so actual media playback could not be verified. |
| Dailymotion | One adaptive source; 10 external subtitle URLs | Public metadata parsed. The playlist probe returned HTTP 403 here, so qualities and playback could not be verified from this environment. The player-provided URL is retained for an in-app test. |
| All Sub Player | Public source API and 16 subtitle URLs parsed | Its HLS URL returned HTTP 404 and was omitted. A working public playlist on another episode can be returned by this resolver. |

Subtitle attachments were verified structurally. Individual subtitle download/display and the TV's subtitle menu were not tested. Several hosts may include English subtitles in the video rather than exposing a separate English file.

Source entries are ordered by server, with Auto first and explicit resolutions descending within each server. Same-resolution HLS variants include their bitrate in the title.

## Still requires your Nuvio TV

1. Upload the files, add the raw manifest URL under Plugins, and enable DonghuaStream.
2. Open Renegade Immortal S1E162 and confirm that sources appear.
3. Play Rumble; select another resolution and an exposed subtitle language.
4. Test OK.ru and Dailymotion from your network. Refresh sources before testing because some URLs expire or depend on IP.
5. Check an older episode and a different series with several seasons.

No physical Samsung/LG/Android TV was connected to this environment. **Seamless playback on the user's TV is not yet confirmed.**

## Framework reference

The manifest follows the working FrameXTV package's `scrapers` repository shape. The entry point exports `getStreams(tmdbId, mediaType, season, episode)` and returns native stream objects.

The same manifest fields, module entry point, TMDB binding, fetch interface, permitted HTML-parser dependency and subtitle fields are accepted by the checked Android TV, mobile/desktop and Samsung/LG contracts. The ZIP includes a compatibility table; this is a runtime/API compatibility check rather than physical-device certification.

- [NuvioTVSmart runtime implementation](https://github.com/NuvioMedia/NuvioTVSmart/blob/main/js/core/player/pluginWorker.js)
- [Nuvio provider API documentation](https://github.com/yoruix/nuvio-providers/blob/template/DOCUMENTATION.md)
