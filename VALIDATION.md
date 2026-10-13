# Validation — v1.1.0

## Automated checks

`npm test` runs the original 53 provider checks and 27 multi-site checks (80 total). Coverage includes ES5/QuickJS loading, TMDB/Kitsu inputs, exact episode selection, sequel rejection, all eight captured site layouts, public DongSub episode lookup, player extraction, language variants, duplicate removal, quality ordering, failure isolation, and optional deadlines.

The captured fixtures contain public catalog, episode, and player controls. Video-host responses in automated pipeline tests are mocked; these tests do not prove playback.

## Live checks — 13 October 2026

- A combined Renegade Immortal episode 146 lookup returned **56 options across eight sites** in 51 seconds: DonghuaStream, AnimeXin, Anime4i, Lucifer `.org`, AnimeKhor, Donghua World, DongSub, and H-Donghua.
- After fixing relay extraction, a separate Lucifer `.in` episode 162 lookup returned **14 options** in 35 seconds.
- H-Donghua’s direct MP4 returned **HTTP 206**, `video/mp4`, and the requested 1,024-byte range.
- DongSub’s public WordPress search API found the exact older episode 161.

Live tests use fixture TMDB metadata; site and player requests are real. Results vary by time, region, and host. No physical phone or TV playback was tested.

## Supported players and limits

Dailymotion, Rumble, OK.ru, All Sub Player, direct media files, and H-Donghua’s public direct-video wrapper are supported. Other embeds (including VK, DTube, Mega, Dood, and several custom players) are skipped. Catalog support does not imply support for every server on that site.

Failed hosts are isolated. When runtime timers are available, individual requests have a 14-second limit and the combined lookup returns available results within a 52-second budget. Older runtimes without timers use the application’s own timeout.

Duplicate quality options are removed within each site/server/language group; exact shared playback links with the same headers and subtitles are merged across sites. Numbered labels preserve Auto-first, descending quality order in Nuvio builds that alphabetically sort stream labels.

Continuous TMDB seasons use known episode counts. Explicit site seasons use local episode numbers. Separate Kitsu parts are not universally mapped to absolute episode offsets; unknown mappings are not guessed. Specials and multi-part movies require explicit mappings.

Nuvio’s generic provider test may use a western title absent from these catalogs and return no streams. Test with an available donghua episode instead.

## Historical compatibility audit

[COMPATIBILITY.md](COMPATIBILITY.md) records the earlier v1.0.1 application-binding audit. The expanded v1.1.0 provider passes ES5 and QuickJS checks, but has not been replayed against every native application binding or its HTML-parser quotas. Device verification remains necessary.
