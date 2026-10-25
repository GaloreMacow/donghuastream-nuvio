# DonghuaStream for Nuvio

A plugin with separate providers for nine donghua sites. Enable only the sites you want to search for movies and episodes selected in Nuvio.

## Features

- Individual provider switches for DonghuaStream, AnimeXin, Anime4i, Lucifer Donghua `.in`, Lucifer Donghua `.org`, AnimeKhor, Donghua World, DongSub, and H-Donghua.
- Each provider searches its own site only; enable several to search those sites together.
- Matches titles and episodes using TMDB or Kitsu metadata.
- Labels streams by site and server, keeping available language versions separate.
- Removes duplicate qualities and sorts Auto first, then resolutions from highest to lowest.
- Includes available subtitles. A failed site does not stop other enabled providers.
- Duplicate qualities are removed within each provider. Shared links from different enabled providers may still appear separately.

## Installation

Add this URL in Nuvio’s **Plugins** settings and enable your preferred **DonghuaStream | ...** providers:

```text
https://raw.githubusercontent.com/GaloreMacow/donghuastream-nuvio/main/manifest.json
```

Refresh the repository after updates, open its provider settings, and enable or disable each site individually. Then reload the episode’s sources. If the new providers do not appear, remove and re-add the same repository URL. Requires a plugin-enabled Nuvio build.

The existing `donghuastream` provider ID now searches DonghuaStream only. The other eight sites have separate provider IDs. Review their switches after updating.

## Development

Run `npm ci`, `npm run build`, and `npm test`. Edit `providers/donghuastream.js`, then regenerate the other providers with `npm run build`; the tests check that the copies are current.

Availability depends on the sites and supported video hosts. Some players and season mappings are unsupported. See [VALIDATION.md](VALIDATION.md) for testing details.

