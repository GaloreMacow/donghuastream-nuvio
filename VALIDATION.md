# Validation — v1.2.2

Reviewed and optimized on **25 October 2026**. All nine independent site providers, their IDs, and their settings switches are retained.

## Stream labels

Removed redundant site names from stream results across all nine providers. Provider names and IDs remain unchanged. Results retain the video host, language or subtitle variant, option number, and quality (for example, `OK.ru | English | 01 - Auto`). Fixture checks verify host-only results and existing quality ordering.

## Optimization

- Removed obsolete combined-site orchestration. Each distributed provider contains only its own site configuration; the full catalog lives in build-time data.
- Reuse identical GET requests, host resolution, and parsed HLS masters within one provider lookup. Different headers or referrers remain separate; POST responses are not cached.
- Copy cached host results so site/language labels cannot overwrite one another. A new lookup fetches fresh data and playback links.
- Load the HTML parser only when needed, reuse title aliases, and avoid resolving each episode URL twice.
- Avoid scanning every segment of a media playlist without master variants. Removed redundant host/variant sorting; final quality selection still retains the highest bitrate and sorts Auto first, then descending resolutions.
- Compare headers/subtitles for exact duplicates only when a playback URL repeats. Different headers and subtitle sets are preserved.
- Reject confirmed JSON error bodies as HLS, in addition to HTML and HTTP 404/410 responses. Region/device-dependent probe failures still retain player-provided links.

Caches last for one lookup. Signed links and metadata are not cached persistently or across independent providers.

## Controlled benchmark

A fixture with three relay pages and a repeated player/playlist returned **identical stream objects** before and after optimization:

| Work | v1.2.0 | v1.2.1 |
| --- | ---: | ---: |
| Network requests | 16 | 6 |
| HLS master parses | 8 | 1 |
| Final stream options | 3 | 3 |

This measures duplicate work in that scenario, not a universal file-size or wall-clock speed improvement. To compare the fixture with an older provider, run `BASELINE_SOURCE=/path/to/old-provider.js node tests/optimization.cjs`.

## Automated checks

`npm test` checks generated copies plus 53 core checks, 45 site/isolation checks, and 20 optimization checks: **118 passing checks**. Coverage includes TMDB/Kitsu, exact episodes, sequel rejection, all nine providers, player extraction, language isolation, quality ordering, subtitles, external HLS audio/subtitle groups, headers, cache isolation, fresh links on refresh, and optional deadlines.

The provider is parsed as ES5 and exercised in QuickJS. Captured public catalog/player controls and mocked responses do not prove native playback on every Nuvio build. Standalone provider copies are required by the app's loading model; build/check scripts keep them synchronized.

## Live resolution — 25 October 2026

Renegade Immortal episode 162 returned:

| Provider | Stream options |
| --- | ---: |
| DonghuaStream | 15 |
| AnimeXin | 27 |
| Anime4i | 8 |
| Lucifer Donghua .in | 15 |
| Lucifer Donghua .org | 15 |
| AnimeKhor | 6 |
| Donghua World | 1 |
| DongSub | 8 |
| H-Donghua | 0 |

A separate H-Donghua check returned **2 options for episode 146**; episode 162 was not substituted. These tests used fixture TMDB metadata and real site/player requests. They verify source resolution, not every media URL, language, complete episode, or device/player combination. Availability can change upstream.

Run `npm run test:live` for DonghuaStream, `LIVE_PROVIDER=animexin npm run test:live` for another site, or `LIVE_PROVIDER=all npm run test:live` for all repository entries. `LIVE_EPISODE` selects the episode (default 162).

## Supported players and limits

Dailymotion, Rumble, OK.ru, All Sub Player, direct media files, and H-Donghua's public direct-video wrapper remain supported. Other embeds are skipped. Catalog support does not imply support for every player a site offers.

Timers are optional: when available, requests have a 14-second limit and a lookup returns available results within a 52-second budget. Older runtimes use the app's own timeout. Independent site providers can still show shared links separately.

Continuous TMDB seasons use known episode counts; explicit site seasons use local numbers. Separate Kitsu parts, specials, and multi-part movies are not universally mapped. Unknown offsets are not guessed. Nuvio's generic provider test may use a western title absent from these catalogs.

[COMPATIBILITY.md](COMPATIBILITY.md) is the historical v1.0.1 binding audit. Physical phone/TV playback and every native parser implementation have not been retested in this optimization.
