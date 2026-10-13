# DonghuaStream for Nuvio

A plugin that finds DonghuaStream video sources for movies and episodes selected in Nuvio. It works with Nuvio builds that support plugins and does not add a separate catalog.

## Key features

- Resolves supported video servers: Dailymotion, Rumble, OK.ru, and All Sub Player.
- Shows available quality options, with one entry per resolution for each server.
- Uses numbered labels to keep Auto first, followed by resolutions from highest to lowest.
- Includes available external subtitles and preserves adaptive HLS audio and subtitle tracks.
- Matches titles and episodes using TMDB metadata or Kitsu anime IDs, including English and Chinese title aliases.
- Handles server failures independently, so other available sources can still appear.

## Installation

Add this repository URL in Nuvio's **Plugins** settings, then enable **DonghuaStream**:

```text
https://raw.githubusercontent.com/GaloreMacow/donghuastream-nuvio/main/manifest.json
```

After an update, refresh the repository and reload the episode's sources.

Episode availability depends on the DonghuaStream listing; a title can exist there without all its episodes. Quality, audio, and subtitles depend on the video host. See [COMPATIBILITY.md](COMPATIBILITY.md) and [VALIDATION.md](VALIDATION.md) for technical details and testing limitations.
