# DonghuaStream for Nuvio

A plugin that searches multiple donghua sites for movies and episodes selected in Nuvio.

## Features

- Searches DonghuaStream plus AnimeXin, Anime4i, Lucifer Donghua `.in` and `.org`, AnimeKhor, Donghua World, DongSub, and H-Donghua together.
- Matches titles and episodes using TMDB or Kitsu metadata.
- Labels streams by site and server, keeping available language versions separate.
- Removes duplicate qualities and sorts Auto first, then resolutions from highest to lowest.
- Includes available subtitles and returns other sources when a site fails.

## Installation

Add this URL in Nuvio’s **Plugins** settings and enable **DonghuaStream**:

```text
https://raw.githubusercontent.com/GaloreMacow/donghuastream-nuvio/main/manifest.json
```

Refresh the repository after updates, then reload the episode’s sources. Requires a plugin-enabled Nuvio build.

Availability depends on the sites and supported video hosts. Some players and season mappings are unsupported. See [VALIDATION.md](VALIDATION.md) for testing details.
