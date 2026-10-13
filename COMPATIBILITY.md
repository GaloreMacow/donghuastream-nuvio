# Nuvio compatibility audit

This is the historical **v1.0.1** audit. The **v1.1.0** multi-site expansion passes ES5/QuickJS checks but has not been retested against every native binding or parser quota. See [VALIDATION.md](VALIDATION.md).

DonghuaStream plugin **v1.0.1**, audited **13 October 2026**.

`NuvioMedia/NuvioTV` is the official **Android TV** repository. It is not a single repository for every Nuvio application. Samsung/LG, mobile and desktop implementations have separate repositories.

## Results

| Nuvio implementation | Checked source | Result |
| --- | --- | --- |
| Android TV, full build | NuvioTV latest published release `1.0.0`, commit `9f17e8bf4abc799dc8c832d2894a8b3b166e4353` | Provider completed a QuickJS replay using its actual JavaScript compatibility bindings. |
| Android TV, current development | NuvioTV `dev`, commit `b9dae5c5745fabc1eaddee0ac9b336f1d0b492c8` | Same provider completed the equivalent replay; manifest and subtitle result parsers checked. |
| Mobile, full Android/iOS builds | NuvioMobile `cmp-rewrite`, commit `dac3f314181b389016a81be8c7190314c6d94ec9`; release `0.5.9-beta` has byte-identical bindings | Shared JavaScript bindings completed the replay; manifest, result and subtitle parsers checked. Native Android/iOS apps were not launched. |
| Desktop | NuvioDesktop `Dev`, commit `d2e21f20782f4516b62bbdcb4764d6271db1d614` (release `0.1.30-alpha`) | Its shared JavaScript binding file is byte-identical to the mobile binding file tested. Its result parser was compared. Native desktop playback was not run. |
| Samsung Tizen / LG webOS | NuvioTVSmart `1.2.4`, commit `d4dcb2998e11cb71eafa426022b48f7c74a59299` | QuickJS replay completed with its actual compatibility bindings and a conservative four-document parser quota. |

Latest release metadata fetched during the audit: Android TV `1.0.0`; mobile `0.5.9-beta`; desktop `0.1.30-alpha`; Samsung/LG `1.2.4`. Development-branch checks are identified separately above rather than being presented as installed-release tests.

All four distinct binding replays produced **17 source entries** from captured page/player responses. The current live lookup produced **16 entries**. These counts differ because the replay and fresh live requests had slightly different OK.ru playlist responses.

## Contract comparison

| Feature | Android TV | Mobile / Desktop | Samsung / LG |
| --- | --- | --- | --- |
| Repository `name`, `version`, `scrapers` | Accepted | Accepted | Accepted |
| Relative `providers/donghuastream.js` filename | Accepted | Accepted | Accepted |
| CommonJS `module.exports.getStreams` | Accepted | Accepted | Accepted |
| Four arguments: TMDB ID, media type, season, episode | Accepted | Accepted | Accepted |
| Runtime `TMDB_API_KEY` binding | Present | Present | Present |
| `fetch` with headers and text responses | Present | Present | Present |
| `require('cheerio-without-node-native')` | Present | Present | Present |
| Stream `url`, `name`, `title`, `quality`, `headers` | Parsed | Parsed | Preserved |
| Subtitle `url`, `language`, `name`, `headers` | Parsed | Parsed | Preserved |
| Node, DOM or runtime timers required by this provider | No | No | No |

Android TV's `LocalScraperResult.toStream` forwards playback headers through `behaviorHints.proxyHeaders.request` and preserves stream subtitles. The plugin returns the fields that the Android and mobile parsers accept. An extra `type` value is included for HLS sources where available; players can also infer the transport from their URL or response handling.

## Changes made in v1.0.1

- Resolve parent-directory, root-relative, protocol-relative and query-only URLs before invoking the app's limited URL constructor. Preserve signed query parameters.
- Attach source-specific Referer/User-Agent headers to subtitle downloads.
- Preserve explicit HLS transport types in returned stream objects.
- Normalize `series`, `show` and `other` media types to TV, matching the app's alias conventions.
- Add regression checks for these cases and update the setup/validation documentation.

The provider and repository IDs are unchanged. Refresh the repository after replacing the uploaded files to fetch v1.0.1.

## Build restrictions

Compatibility applies to **plugin-enabled builds**, not every distribution of Nuvio:

- Android TV's Play Store `PluginManager` is a disabled stub that rejects adding repositories.
- NuvioMobile's Android Play Store and iOS App Store plugin repositories are also disabled stubs.
- Use the full/sideloaded variant when plugins are required. Verify that your installed app exposes its Plugins settings.
- NuvioTVSmart has platform/version requirements for its packaged plugin service. Its current README documents that Tizen 5.x disables plugins and Tizen 6+ supports the service. Supported webOS builds also require their packaged service.

A provider cannot enable a feature disabled by the app build. Converting it into a hosted addon would be a different deliverable and architecture.

## Scope of testing

The runtime tests executed the original distributed provider in QuickJS with the applications' real JavaScript binding code. HTTP responses were replayed, and native URL/HTML host functions were supplied through test adapters. The HTML adapter uses Cheerio and models the selectors/text behavior used by the app; it is not an Android emulator or a native Jsoup/JSC test.

Live source resolution and one Rumble H.264/AAC media segment were also verified. No physical Android TV, phone, iPhone, desktop player, Samsung TV or LG TV was controlled. Dailymotion/OK.ru playback and native subtitle menus still require on-device verification; the host limitations are documented in `VALIDATION.md`.

## Primary source files

- [Android TV runtime](https://github.com/NuvioMedia/NuvioTV/blob/b9dae5c5745fabc1eaddee0ac9b336f1d0b492c8/app/src/full/java/com/nuvio/tv/core/plugin/PluginRuntime.kt)
- [Android TV manifest and stream models](https://github.com/NuvioMedia/NuvioTV/blob/b9dae5c5745fabc1eaddee0ac9b336f1d0b492c8/app/src/main/java/com/nuvio/tv/domain/model/Plugin.kt)
- [Android TV Play Store restriction](https://github.com/NuvioMedia/NuvioTV/blob/b9dae5c5745fabc1eaddee0ac9b336f1d0b492c8/app/src/playstore/java/com/nuvio/tv/core/plugin/PluginManager.kt)
- [Mobile JavaScript bindings](https://github.com/NuvioMedia/NuvioMobile/blob/dac3f314181b389016a81be8c7190314c6d94ec9/composeApp/src/fullCommonMain/kotlin/com/nuvio/app/features/plugins/runtime/js/JsBindings.kt)
- [Mobile manifest models](https://github.com/NuvioMedia/NuvioMobile/blob/dac3f314181b389016a81be8c7190314c6d94ec9/composeApp/src/commonMain/kotlin/com/nuvio/app/features/plugins/PluginModels.kt)
- [Desktop JavaScript bindings](https://github.com/NuvioMedia/NuvioDesktop/blob/d2e21f20782f4516b62bbdcb4764d6271db1d614/composeApp/src/fullCommonMain/kotlin/com/nuvio/app/features/plugins/runtime/js/JsBindings.kt)
- [Samsung/LG worker bindings](https://github.com/NuvioMedia/NuvioTVSmart/blob/d4dcb2998e11cb71eafa426022b48f7c74a59299/js/core/player/pluginWorker.js)
