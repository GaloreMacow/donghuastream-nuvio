/* DonghuaStream for Nuvio. Promise-based CommonJS; no DOM, Node APIs or eval. */
(function () {
  'use strict';
  var SOURCE_SITE = {"id":"donghuastream","name":"DonghuaStream","url":"https://donghuastream.org"};
  var SITE = SOURCE_SITE.url;
  function siteURL(ctx) { return ctx && ctx.site ? ctx.site.url : SITE; }
  var UA = 'Mozilla/5.0';
  var cheerio;
  function parseHTML(html) {
    if (!cheerio) cheerio = require('cheerio-without-node-native');
    return cheerio.load(html);
  }

  function log(message) {
    var write = console.warn || console.log;
    write('[DonghuaStream] ' + message);
  }
  function absolute(value, base) {
    if (typeof value !== 'string' || !value.trim()) return '';
    value = value.trim();
    // Resolve before invoking URL: Nuvio runtimes provide a limited URL shim.
    if (/^\/\//.test(value)) value = 'https:' + value;
    else if (!/^https?:\/\//i.test(value)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
      var parent = String(base || SITE).split('#')[0];
      var origin = parent.match(/^https?:\/\/[^/?#]+/i);
      if (!origin) return '';
      if (value.charAt(0) === '?') value = parent.split('?')[0] + value;
      else if (value.charAt(0) === '#') value = parent + value;
      else if (value.charAt(0) === '/') value = origin[0] + value;
      else {
        parent = parent.split('?')[0];
        if (parent === origin[0]) parent += '/';
        value = parent.replace(/\/[^/]*$/, '/') + value;
      }
    }
    var parts = value.match(/^(https?:\/\/[^/?#]+)([^?#]*)([\s\S]*)$/i);
    if (!parts) return '';
    var path = parts[2] || '/', resolved = [];
    path.split('/').forEach(function (segment) {
      if (segment === '..') { if (resolved.length > 1) resolved.pop(); }
      else if (segment !== '.') resolved.push(segment);
    });
    var tail = /\/(?:\.|\.\.)$/.test(path) ? '/' : '';
    var finalPath = resolved.join('/') || '/';
    if (tail && finalPath.charAt(finalPath.length - 1) !== '/') finalPath += tail;
    value = parts[1] + finalPath + parts[3];
    try {
      var url = new URL(value);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (_) { return ''; }
  }
  function sameSite(url, site) { return url.indexOf((site || SITE) + '/') === 0; }
  function bounded(work, milliseconds, fallback) {
    // Timers are optional: older TV runtimes can still run the same provider.
    if (typeof setTimeout !== 'function' || typeof clearTimeout !== 'function') return work;
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { try { resolve(fallback()); } catch (error) { reject(error); } }, milliseconds);
      work.then(function (value) { clearTimeout(timer); resolve(value); }, function (error) { clearTimeout(timer); reject(error); });
    });
  }
  function requestKey(url, headers) {
    return url + '\n' + JSON.stringify(Object.keys(headers || {}).sort().map(function (key) { return [key, headers[key]]; }));
  }
  function request(url, ref, ctx, options) {
    var opts = options || {};
    var headers = { 'User-Agent': UA, Accept: '*/*' };
    if (ref) headers.Referer = ref;
    Object.keys(opts.headers || {}).forEach(function (k) { headers[k] = opts.headers[k]; });
    opts.headers = headers;
    var cache = ctx && (ctx.requests || (ctx.requests = Object.create(null)));
    var key = (!opts.method || /^get$/i.test(opts.method)) && !opts.body ? requestKey(url, headers) : '';
    if (cache && key && cache[key]) return cache[key];
    if (ctx && Date.now() - ctx.start > 48000) return Promise.reject(new Error('Search budget reached'));
    var work = Promise.resolve().then(function () { return fetch(url, opts); }).then(function (res) {
      if (!res.ok) { var error = new Error('HTTP ' + res.status); error.status = res.status; throw error; }
      return res.text().then(function (body) { return { body: body, url: res.url || url }; });
    });
    work = bounded(work, 14000, function () { throw new Error('Request timeout'); });
    if (cache && key) cache[key] = work;
    return work;
  }
  function json(url, ref, ctx, options) {
    return request(url, ref, ctx, options).then(function (r) { return JSON.parse(r.body); });
  }
  function decode64(s) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    var out = '', bits = 0, acc = 0;
    s = String(s).replace(/\s/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return '';
    for (var i = 0; i < s.length; i++) {
      if (s.charAt(i) === '=') break;
      acc = (acc << 6) | chars.indexOf(s.charAt(i)); bits += 6;
      if (bits >= 8) { bits -= 8; out += String.fromCharCode((acc >> bits) & 255); }
    }
    return out;
  }
  function normalized(s) {
    return String(s || '').toLowerCase().replace(/&/g, ' and ')
      .replace(/[’'`]/g, '').replace(/[^a-z0-9\u3400-\u9fff]+/g, ' ').trim();
  }
  function baseTitle(s) { return normalized(s).replace(/\bseason\s+\d+\b/g, '').replace(/\s+/g, ' ').trim(); }
  function siteSeason(s) { var m = String(s).match(/\bseason\s*(\d+)/i); return m ? Number(m[1]) : null; }
  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    var aa = a.split(' '), bb = b.split(' '), shared = 0;
    var numeral = /^(?:\d+|ii|iii|iv|vi|vii|viii|ix)$/;
    if (aa.filter(function (w) { return numeral.test(w); }).join(' ') !== bb.filter(function (w) { return numeral.test(w); }).join(' ')) return 0;
    aa.forEach(function (w) { if (bb.indexOf(w) >= 0) shared++; });
    return 2 * shared / (aa.length + bb.length);
  }
  function titleParts(title) {
    title = String(title || '').replace(/\s*[([](?:19|20)\d{2}[)\]]\s*$/, '').trim();
    var m = title.match(/^(.+?)\s*[([]([^()[\]]+)[)\]]\s*$/);
    // Parenthesized sequel/season numbers are meaningful, never discard them.
    if (m && !/\d|\b(?:season|part|movie|special)\b/i.test(m[2])) return [title, m[1], m[2]];
    return [title];
  }
  function titleScore(names, title) {
    var score = 0, parts = titleParts(title).map(baseTitle);
    names.forEach(function (n) {
      n = baseTitle(n);
      parts.forEach(function (p) { score = Math.max(score, similarity(n, p)); });
    });
    return score;
  }
  function aliases(meta) {
    var list = [meta.title || meta.name, meta.original_title || meta.original_name];
    var alternatives = meta.alternative_titles || {};
    (alternatives.titles || alternatives.results || []).forEach(function (x) { list.push(x.title); });
    list.slice().forEach(function (title) {
      var combined = String(title || '').match(/^(.+?)\s*\(([^()]+)\)\s*$/);
      if (combined && !/^(?:\d{4}|season\s*\d+|part\s*\d+)$/i.test(combined[2].trim())) {
        list.push(combined[1].trim()); list.push(combined[2].trim());
      }
    });
    var seen = {};
    return list.filter(function (x) {
      var key = normalized(x); if (!key || seen[key]) return false; seen[key] = true; return true;
    });
  }
  function metadata(id, type, ctx) {
    var kitsu = String(id).match(/^kitsu:([1-9]\d*)$/i);
    if (kitsu) return json('https://kitsu.io/api/edge/anime/' + kitsu[1], '', ctx).then(function (result) {
      var item = result && result.data, attrs = item && item.attributes;
      if (!attrs || String(item.id) !== kitsu[1]) throw new Error('Kitsu metadata unavailable');
      var names = [attrs.canonicalTitle].concat(attrs.abbreviatedTitles || []);
      Object.keys(attrs.titles || {}).forEach(function (language) { names.push(attrs.titles[language]); });
      return { name: attrs.canonicalTitle, original_name: (attrs.titles || {}).zh_cn || (attrs.titles || {}).ja_jp,
        alternative_titles: { results: names.map(function (name) { return { title: name }; }) },
        seasons: [{ season_number: 1, episode_count: Number(attrs.episodeCount || 0) }] };
    });
    var key = typeof TMDB_API_KEY !== 'undefined' ? String(TMDB_API_KEY || '') : '';
    if (!key) return Promise.reject(new Error('TMDB key unavailable: configure TMDB in Nuvio'));
    return json('https://api.themoviedb.org/3/' + type + '/' + id + '?api_key=' +
      encodeURIComponent(key) + '&language=en-US&append_to_response=alternative_titles', '', ctx);
  }
  function rankCards(html, meta, season, type, site, names) {
    site = site || SOURCE_SITE;
    var $ = parseHTML(html), result = [], seen = {};
    names = names || aliases(meta);
    $('.bsx a[href], .aamla-card__link, .hd-card-link').each(function (_, el) {
      var link = $(el), url = absolute(link.attr('href'), site.url + '/');
      if (!sameSite(url, site.url) || seen[url]) return;
      var title = link.attr('title') || link.attr('aria-label') || link.find('h2, .hd-card-title, .aamla-card__title').first().text();
      if (url.indexOf('/anime/') >= 0) title = title.replace(/\s+Episode\s+\d+\b.*$/i, '');
      if (/\bepisode\s*\d+/i.test(title)) return;
      var movie = /\b(?:movie|special)\b/i.test(link.find('.typez').text()) || /\bmovie\b/i.test(title);
      if (type === 'tv' && movie) return;
      var score = titleScore(names, title);
      if (score < 0.78) return;
      var ss = siteSeason(title);
      seen[url] = true;
      result.push({ url: url, title: title, siteSeason: ss,
        score: score + (type === 'movie' && movie ? 0.1 : 0) + (ss === season ? 0.1 : 0) });
    });
    return result.sort(function (a, b) { return b.score - a.score; });
  }
  function search(meta, season, type, ctx) {
    var names = (ctx.names || aliases(meta)).slice(0, 4), cards = [], index = 0;
    function next() {
      if (index >= names.length) return Promise.resolve(cards);
      var query = names[index++];
      return request(siteURL(ctx) + '/?s=' + encodeURIComponent(query), siteURL(ctx) + '/', ctx).then(function (r) {
        cards = rankCards(r.body, meta, season, type, ctx.site, ctx.names);
        return cards.length ? cards : next();
      }).catch(function () { return next(); });
    }
    return next();
  }
  function absoluteEpisode(meta, season, episode) {
    var seasons = Array.isArray(meta.seasons) ? meta.seasons : [], total = episode;
    for (var s = 1; s < season; s++) {
      var found = seasons.filter(function (x) { return Number(x.season_number) === s; })[0];
      if (!found || !(Number(found.episode_count) > 0)) return null;
      total += Number(found.episode_count);
    }
    return total;
  }
  function episodeNumbers(label) {
    var m = String(label).match(/^\s*(\d+)\b(?:\s*[\[(]\s*(\d+)\s*[\])])?/);
    return m ? { local: Number(m[1]), absolute: m[2] ? Number(m[2]) : null } : null;
  }
  function chooseEpisode(html, card, meta, type, season, episode, names) {
    var $ = parseHTML(html), base = card.url || SITE + '/', origin = base.match(/^https?:\/\/[^/]+/)[0];
    names = names || aliases(meta);
    var pageTitle = $('.entry-title').first().text() || $('h1').first().text();
    var alt = $('.alter').text().split(/[,，]/);
    var pageNames = [pageTitle].concat(alt), match = 0;
    pageNames.forEach(function (p) { match = Math.max(match, titleScore(names, p)); });
    if (match < 0.78) return '';
    var abs = absoluteEpisode(meta, season, episode), picks = [];
    $('.eplister li a[href], .hd-ep-btn[href], a.watch-now[href]').each(function (_, el) {
      var a = $(el), url = absolute(a.attr('href'), base), label = a.find('.epl-num').text();
      var title = a.find('.epl-title').text();
      if (!sameSite(url, origin)) return;
      if (!label) label = a.attr('data-ep-num') || '';
      if (type === 'movie') {
        if (/\b(?:trailer|preview|pv)\b/i.test(title + ' ' + label)) return;
        picks.push({ url: url, score: 1 }); return;
      }
      if (season === 0) return; // Specials need an explicit mapping, never substitute a normal episode.
      var n = episodeNumbers(label);
      if (!n) {
        var titleNum = (title || url).match(/\bepisode[\s-]+(\d+)/i);
        if (titleNum) n = { local: Number(titleNum[1]), absolute: null };
      }
      if (!n) return;
      var ss = card.siteSeason, score = 0;
      if (ss === season && n.local === episode) score = 3;
      else if (abs !== null && n.absolute === abs) score = 2;
      else if (ss === null && abs !== null && n.local === abs) score = 2;
      else if (season === 1 && (ss === null || ss === 1) && n.local === episode) score = 2;
      if (score) picks.push({ url: url, score: score });
    });
    // A movie with several numbered parts cannot safely map to one Nuvio movie.
    if (type === 'movie' && picks.length !== 1) return '';
    picks.sort(function (a, b) { return b.score - a.score; });
    return picks.length ? picks[0].url : '';
  }
  function findPage(cards, meta, type, season, episode, ctx) {
    var index = 0;
    function next() {
      if (index >= Math.min(cards.length, 5)) return Promise.resolve('');
      var card = cards[index++];
      return request(card.url, siteURL(ctx) + '/', ctx).then(function (r) {
        var page = chooseEpisode(r.body, card, meta, type, season, episode, ctx.names);
        if (!page && ctx.site && ctx.site.layout === 'dongsub' && type === 'tv') {
          var target = card.siteSeason === season ? episode : absoluteEpisode(meta, season, episode);
          if (target === null || season === 0) return next();
          var query = titleParts(card.title)[1] || card.title;
          return json(siteURL(ctx) + '/wp-json/wp/v2/search?per_page=30&search=' + encodeURIComponent(query + ' Episode ' + target), card.url, ctx).then(function (items) {
            var found = (Array.isArray(items) ? items : []).filter(function (item) {
              var m = String(item.title || '').match(/^(.+?)\s+Episode\s+(\d+)\b/i);
              return m && Number(m[2]) === target && titleScore(ctx.names || aliases(meta), m[1]) >= 0.78 && sameSite(item.url || '', siteURL(ctx));
            });
            return found.length ? found[0].url : next();
          });
        }
        return page || next();
      }).catch(function () { return next(); });
    }
    return next();
  }
  function mirrors(html, page, parsed) {
    var $ = parsed || parseHTML(html), result = [], seen = {};
    $('select.mirror option[value], .server-item [data-src], .server-item [data-hash], .hd-server-btn[data-url]').each(function (_, el) {
      var a = $(el), raw = a.attr('value') || a.attr('data-src') || a.attr('data-hash') || a.attr('data-url');
      if (!raw) return;
      var decoded = /^https?:|^\/\//i.test(raw) ? raw : decode64(raw);
      var match = decoded.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      var url = absolute(match ? match[1] : decoded, page);
      if (!url || seen[url]) return;
      seen[url] = true; result.push({ url: url, label: a.attr('data-name') || a.text().trim() || 'Server' });
    });
    $('#pembed iframe[src], .player-embed iframe[src], video source[src], video[src]').each(function (_, el) {
      var url = absolute($(el).attr('src'), page);
      if (url && !seen[url]) { seen[url] = true; result.push({ url: url, label: 'Direct' }); }
    });
    return result;
  }
  function supportedMirror(m, ctx) {
    var host = new URL(m.url).hostname.toLowerCase();
    return /(?:^|\.)(?:dailymotion\.com|rumble\.com|ok\.ru)$/.test(host) ||
      host === 'play.streamplay.co.in' || host === 'dhdpalyer.blogspot.com' ||
      /\.(?:m3u8|mp4|mkv|webm)(?:[?#]|$)/i.test(m.url) ||
      (sameSite(m.url, siteURL(ctx)) && /\/v\/\d+\/?$/.test(m.url));
  }
  function mirrorVariant(label) {
    var languages = [], soft = /\b(?:soft|all\s*sub|multi)\b/i.test(label);
    if (/eng(?:lish)?/i.test(label)) languages.push('English');
    if (/indo(?:nesian)?/i.test(label)) languages.push('Indonesian');
    if (soft) return 'Soft subtitles';
    return languages.join(' + ');
  }
  var SUBTITLE_LANGUAGES = { english: 'en', arabic: 'ar', bengali: 'bn', bangla: 'bn', french: 'fr', german: 'de',
      indonesian: 'id', italian: 'it', khmer: 'km', persian: 'fa', polish: 'pl', portuguese: 'pt', russian: 'ru',
      spanish: 'es', thai: 'th', turkish: 'tr', vietnamese: 'vi', burmese: 'my', 'myanmar (burmese)': 'my', chinese: 'zh' };
  function subtitle(url, language, label, base) {
    url = absolute(url, base);
    language = language || SUBTITLE_LANGUAGES[String(label || '').toLowerCase()] || 'und';
    return url ? { id: url, url: url, language: language || 'und', name: label || language || 'Subtitles',
      headers: { 'User-Agent': UA, Referer: base || SITE + '/' } } : null;
  }
  function trackList(tracks, base) {
    return (Array.isArray(tracks) ? tracks : []).filter(function (t) {
      return t && /^(?:captions|subtitles)$/i.test(t.kind || 'subtitles');
    }).map(function (t) { return subtitle(t.file || t.url || t.src, t.srclang || t.language || t.lang, t.label, base); }).filter(Boolean);
  }
  function stream(url, server, quality, subs, ref, type) {
    url = absolute(url, ref);
    if (!url) return null;
    return { name: server, title: server + ' | ' + (quality || 'Auto'),
      quality: quality || 'Auto', url: url, headers: { 'User-Agent': UA, Referer: ref },
      subtitles: subs || [], type: type || (/\.m3u8(?:[?#]|$)/i.test(url) ? 'hls' : ''), _type: type || '' };
  }
  function dailymotion(m, ctx) {
    var id = m.url.match(/[?&]video=([^&#]+)/) || m.url.match(/\/(?:video|embed\/video)\/([a-zA-Z0-9]+)/);
    if (!id) return Promise.resolve([]);
    return json('https://www.dailymotion.com/player/metadata/video/' + encodeURIComponent(id[1]), m.url, ctx).then(function (data) {
      if (data.error || data.is_password_protected || data.protected_delivery) return [];
      var subs = [], dict = (data.subtitles || {}).data || {}, out = [];
      Object.keys(dict).forEach(function (lang) {
        (dict[lang].urls || []).forEach(function (url) {
          var s = subtitle(url, lang, dict[lang].label, m.url); if (s) subs.push(s);
        });
      });
      Object.keys(data.qualities || {}).forEach(function (q) {
        (data.qualities[q] || []).forEach(function (item) {
          if (/mpegurl|mp4/i.test(item.type || '')) out.push(stream(item.url, 'Dailymotion', q === 'auto' ? 'Auto' : q + 'p', subs, m.url, /mpegurl/i.test(item.type) ? 'hls' : 'mp4'));
        });
      });
      return out.filter(Boolean);
    });
  }
  function rumble(m, ctx) {
    var id = m.url.match(/\/embed\/([a-z0-9]+)/i);
    if (!id) return Promise.resolve([]);
    return json('https://rumble.com/embedJS/u3/?request=video&ver=2&v=' + encodeURIComponent(id[1]), m.url, ctx).then(function (data) {
      var subs = [], out = [];
      Object.keys(data.cc || {}).forEach(function (lang) {
        var t = data.cc[lang], s = subtitle(t.path, lang, t.language, m.url); if (s) subs.push(s);
      });
      Object.keys(data.ua || {}).forEach(function (type) {
        if (!/^(?:hls|mp4|webm)$/i.test(type)) return; // Exclude video-only timeline, audio-only and TAR transports.
        var formats = data.ua[type] || {};
        Object.keys(formats).forEach(function (q) {
          var f = formats[q], h = (f.meta || {}).h;
          if (!f.url) return;
          var label = q === 'auto' ? 'Auto' : (/^\d+$/.test(q) ? q + 'p' : (h ? h + 'p' : 'Auto'));
          out.push(stream(f.url, 'Rumble', label, subs, m.url, type));
        });
      });
      return out.filter(Boolean);
    });
  }
  function okru(m, ctx) {
    return request(m.url, siteURL(ctx) + '/', ctx).then(function (r) {
      var $ = parseHTML(r.body), out = [];
      $('[data-options]').each(function (_, el) {
        try {
          var opts = JSON.parse($(el).attr('data-options')), data = (opts.flashvars || {}).metadata;
          if (typeof data === 'string') data = JSON.parse(data);
          if (!data) return;
          var subs = trackList(data.subtitles, r.url);
          var tiers = { mobile: '144p', lowest: '240p', low: '360p', sd: '480p', hd: '720p', full: '1080p', quad: '1440p', ultra: '4K' };
          (data.videos || []).forEach(function (v) {
            if (!v.disallowed) out.push(stream(v.url, 'OK.ru', tiers[v.name] || v.name || 'Unknown', subs, m.url, 'mp4'));
          });
          if (data.hlsManifestUrl) out.push(stream(data.hlsManifestUrl, 'OK.ru', 'Auto', subs, m.url, 'hls'));
        } catch (_) { /* Ignore unrelated widgets. */ }
      });
      return out.filter(Boolean);
    });
  }
  // Decode only the site's simple packed assignments. Never execute downloaded scripts.
  function unpackAssignments(html) {
    var regex = /\}\s*\(\s*'((?:\\.|[^'\\])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([^']*)'\.split\('\|'\)/g;
    var match, output = html;
    while ((match = regex.exec(html))) {
      var base = Number(match[2]), count = Number(match[3]), words = match[4].split('|');
      if (base < 2 || base > 36 || count > 300) continue;
      var text = match[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
      // One pass avoids replacing digits inside decoded URLs/tokens.
      text = text.replace(/\b[a-z0-9]+\b/g, function (token) {
        var i = parseInt(token, base); return i < count && i.toString(base) === token && words[i] ? words[i] : token;
      });
      output += '\n' + text;
    }
    return output;
  }
  function streamplay(m, ctx) {
    return request(m.url, siteURL(ctx) + '/', ctx).then(function (r) {
      var text = unpackAssignments(r.body);
      var token = text.match(/window\.kaken\s*=\s*["']([^"']+)["']/);
      if (!token) return [];
      // Public player endpoint uses the token exactly as supplied by its embed page.
      var api = absolute('/api/', m.url);
      return json(api, m.url, ctx, { method: 'POST', headers: { 'Content-Type': 'text/plain', 'X-Alt-Referer': siteURL(ctx) + '/' }, body: token[1] }).then(function (data) {
        if (!Array.isArray(data.sources)) { log('All Sub Player returned no public sources'); return []; }
        var subs = trackList(data.tracks, m.url);
        return data.sources.map(function (s) {
          var quality = /^(?:\d+p|4k|auto)$/i.test(s.label || '') ? s.label : 'Auto';
          return stream(s.file || s.url, 'All Sub Player', quality, subs, m.url, /hls|mpegurl/i.test(s.type || '') ? 'hls' : '');
        }).filter(Boolean);
      });
    });
  }
  function attrs(line) {
    var result = {}, re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g, m;
    while ((m = re.exec(line))) result[m[1]] = m[2].replace(/^"|"$/g, '');
    return result;
  }
  function tier(a) {
    var m = String(a.RESOLUTION || '').match(/^(\d+)x(\d+)$/);
    if (!m) return '';
    var width = Number(m[1]), h = Number(m[2]);
    var q = width >= 3840 ? 2160 : width >= 2560 ? 1440 : width >= 1920 ? 1080 : width >= 1280 ? 720 :
      width >= 854 ? 480 : width >= 640 ? 360 : width >= 426 ? 240 : width >= 256 ? 144 : h;
    return q === 2160 ? '4K' : q + 'p';
  }
  function master(text, base) {
    if (!/^\s*#EXTM3U/.test(text)) return null;
    var out = { variants: [], audioGroups: {}, subtitleGroups: {} }, pending;
    if (text.indexOf('#EXT-X-STREAM-INF:') < 0) return out;
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (line.indexOf('#EXT-X-MEDIA:') === 0) {
        var a = attrs(line);
        if (a.TYPE === 'AUDIO' && a.URI) out.audioGroups[a['GROUP-ID']] = true;
        if (a.TYPE === 'SUBTITLES' && a.URI) out.subtitleGroups[a['GROUP-ID']] = true;
      } else if (line.indexOf('#EXT-X-STREAM-INF:') === 0) pending = attrs(line);
      else if (pending && line && line.charAt(0) !== '#') {
        var url = absolute(line, base);
        if (url) out.variants.push({ url: url, quality: tier(pending), bandwidth: Number(pending.BANDWIDTH || 0), audio: pending.AUDIO, subs: pending.SUBTITLES });
        pending = null;
      }
    });
    return out;
  }
  function expand(s, ctx) {
    if (s._type !== 'hls' && !/\.m3u8(?:[?#]|$)/i.test(s.url)) return Promise.resolve([s]);
    var cache = ctx && (ctx.playlists || (ctx.playlists = Object.create(null)));
    var key = requestKey(s.url, s.headers);
    var playlist = cache && cache[key];
    if (!playlist) {
      playlist = request(s.url, s.headers.Referer, ctx, { headers: s.headers }).then(function (r) {
        return { data: master(r.body, r.url), invalid: /^\s*(?:<!doctype|<html|[\[{])/i.test(r.body) };
      });
      if (cache) cache[key] = playlist;
    }
    return playlist.then(function (r) {
      var data = r.data;
      if (!data) return r.invalid ? [] : [s];
      if (!data.variants.length) return [s];
      var tiers = [], out = [s];
      data.variants.forEach(function (v) { if (v.quality && tiers.indexOf(v.quality) < 0) tiers.push(v.quality); });
      s.quality = 'Auto'; s.title = s.name.replace('DonghuaStream | ', '') + ' | Auto (' + tiers.join(' / ') + ')';
      data.variants.forEach(function (v) {
        if (data.audioGroups[v.audio] || data.subtitleGroups[v.subs]) return;
        var child = stream(v.url, s.name.replace('DonghuaStream | ', ''), v.quality || 'Unknown', s.subtitles, s.headers.Referer, 'hls');
        if (child && v.bandwidth) {
          child._bandwidth = v.bandwidth;
          child.title += ' | ' + (v.bandwidth / 1000000).toFixed(1) + ' Mbps';
        }
        out.push(child);
      });
      return out;
    }).catch(function (e) {
      // A removed playlist is a confirmed dead link. Access errors can depend on region/device.
      if (e.status === 404 || e.status === 410) return [];
      return [s];
    });
  }
  function copySources(sources) {
    return sources.map(function (s) {
      var copy = {};
      Object.keys(s).forEach(function (key) { copy[key] = s[key]; });
      copy.subtitles = (s.subtitles || []).slice();
      return copy;
    });
  }
  function resolveMirror(m, ctx) {
    var cache = ctx.resolvers || (ctx.resolvers = Object.create(null));
    var key = m.url + '|' + m.label;
    if (!cache[key]) cache[key] = resolveUncached(m, ctx);
    return cache[key].then(copySources);
  }
  function resolveUncached(m, ctx) {
    if (sameSite(m.url, siteURL(ctx)) && /\/v\/\d+\/?$/.test(m.url)) {
      return request(m.url, siteURL(ctx) + '/', ctx).then(function (r) {
        return Promise.all(mirrors(r.body, r.url).filter(function (child) { return !sameSite(child.url, siteURL(ctx)) && supportedMirror(child, ctx); }).slice(0, 4).map(function (child) {
          child.label = m.label; return resolveMirror(child, ctx);
        })).then(function (groups) { var out = []; groups.forEach(function (g) { out = out.concat(g); }); return out; });
      }).catch(function (e) { log(m.label + ': ' + e.message); return []; });
    }
    var host = new URL(m.url).hostname.toLowerCase(), resolver;
    if (/(^|\.)dailymotion\.com$/.test(host)) resolver = dailymotion;
    else if (/(^|\.)rumble\.com$/.test(host)) resolver = rumble;
    else if (/(^|\.)ok\.ru$/.test(host)) resolver = okru;
    else if (host === 'play.streamplay.co.in') resolver = streamplay;
    else if (host === 'dhdpalyer.blogspot.com') resolver = function () {
      var out = [], subs = [], videos = [];
      (m.url.split('?')[1] || '').split('&').forEach(function (part) {
        var pair = part.split('='), value;
        try { value = decodeURIComponent(pair.slice(1).join('=')).split('|'); } catch (_) { return; }
        if (pair[0] === 'sub') { var t = subtitle(value.slice(1).join('|'), value[0], value[0], m.url); if (t) subs.push(t); }
        if (pair[0] === 'video') videos.push(value);
      });
      videos.forEach(function (v) { var url = v.slice(1).join('|'); if (/\.(?:mp4|m3u8|webm)(?:[?#]|$)/i.test(url)) out.push(stream(url, 'Direct', 'Auto', subs, m.url)); });
      return Promise.resolve(out.filter(Boolean));
    };
    else if (/\.(?:m3u8|mp4|mkv|webm)(?:[?#]|$)/i.test(m.url)) resolver = function () { return Promise.resolve([stream(m.url, m.label, 'Auto', [], siteURL(ctx) + '/')]); };
    else { log('Unsupported embed host: ' + host); return Promise.resolve([]); }
    return Promise.resolve().then(function () { return resolver(m, ctx); }).then(function (sources) {
      return Promise.all(sources.map(function (s) { return expand(s, ctx); })).then(function (groups) {
        var out = []; groups.forEach(function (g) { out = out.concat(g); });
        return out;
      });
    }).catch(function (e) { log(m.label + ': ' + e.message); return []; });
  }
  function pageStreams(page, ctx) {
    return request(page, siteURL(ctx) + '/', ctx).then(function (r) {
      var $ = parseHTML(r.body), title = $('h1').text();
      if (/\b(?:preview|trailer)\b/i.test(title)) return [];
      var ready = [];
      var work = Promise.all(mirrors(r.body, r.url, $).filter(function (m) { return supportedMirror(m, ctx); }).slice(0, 12).map(function (m) {
        return resolveMirror(m, ctx).then(function (sources) {
          if (ctx.site) sources.forEach(function (s) {
            var variant = mirrorVariant(m.label);
            s.name += variant ? ' | ' + variant : '';
          });
          ready.push(sources); return sources;
        });
      }));
      return bounded(work, Math.max(1, 50000 - (Date.now() - ctx.start)), function () { return ready; }).then(function (groups) {
        var out = [];
        groups.forEach(function (g) { out = out.concat(g); });
        return displayOrder(dedupeExact(uniqueQualities(out)));
      });
    });
  }
  function dedupeExact(sources) {
    var seen = Object.create(null), out = [];
    sources.forEach(function (s) {
      var group = seen[s.url];
      if (!group) { seen[s.url] = [{ source: s }]; out.push(s); return; }
      // Only compare headers/subtitles when the playback URL actually repeats.
      var key = requestKey('', s.headers) + '|' + JSON.stringify(s.subtitles || []);
      for (var i = 0; i < group.length; i++) {
        var previous = group[i];
        if (!previous.key) previous.key = requestKey('', previous.source.headers) + '|' + JSON.stringify(previous.source.subtitles || []);
        if (previous.key === key) return;
      }
      group.push({ source: s, key: key }); out.push(s);
    });
    return out;
  }
  function uniqueQualities(sources) {
    var out = [], positions = {}, servers = {}, serverCount = 0;
    function formatRank(s) {
      var type = s._type || s.type;
      if (/^auto$/i.test(s.quality) && (type === 'hls' || /\.m3u8(?:[?#]|$)/i.test(s.url))) return 4;
      if (type === 'mp4' || /\.mp4(?:[?#]|$)/i.test(s.url)) return 3;
      if (type === 'hls' || /\.m3u8(?:[?#]|$)/i.test(s.url)) return 2;
      return 1;
    }
    sources.forEach(function (s) {
      if (!s) return;
      if (!Object.prototype.hasOwnProperty.call(servers, s.name)) servers[s.name] = serverCount++;
      var q = String(s.quality || '').toLowerCase(), number = q.match(/^(\d+)p$/);
      if (q === '4k') q = '2160p';
      // Unknown resolutions stay separate; do not collapse unrelated unknown sources.
      var key = s.name + '|' + (number || q === '2160p' || q === 'auto' ? q : s.url);
      if (!Object.prototype.hasOwnProperty.call(positions, key)) {
        positions[key] = out.length; out.push(s); return;
      }
      var index = positions[key], previous = out[index], selected = previous;
      if (formatRank(s) > formatRank(previous) || (formatRank(s) === formatRank(previous) &&
          Number(s._bandwidth || 0) > Number(previous._bandwidth || 0))) selected = s;
      var subs = [], seenSubs = {};
      (selected.subtitles || []).concat((selected === s ? previous : s).subtitles || []).forEach(function (t) {
        var id = t.url + '|' + t.language;
        if (!seenSubs[id]) { seenSubs[id] = true; subs.push(t); }
      });
      selected.subtitles = subs; out[index] = selected;
    });
    out.forEach(function (s) { delete s._type; delete s._bandwidth; });
    function resolution(s) {
      if (/^auto$/i.test(s.quality)) return 100000;
      if (/^4k$/i.test(s.quality)) return 2160;
      return parseInt(s.quality, 10) || 0;
    }
    return out.sort(function (a, b) {
      return servers[a.name] - servers[b.name] || resolution(b) - resolution(a);
    });
  }
  function displayOrder(sources) {
    var counters = {};
    sources.forEach(function (s) {
      var server = s.name, index = (counters[server] || 0) + 1;
      counters[server] = index;
      // Mobile/desktop re-sort by streamLabel then streamSubtitle, ignoring array order.
      // Visible option numbers keep Auto first and resolutions descending in that path.
      s.name = server + ' | ' + (index < 10 ? '0' : '') + index + ' - ' + s.quality;
    });
    return sources;
  }
  function getStreams(tmdbId, mediaType, season, episode) {
    var id = String(tmdbId == null ? '' : tmdbId).trim().replace(/^tmdb[:/]/i, ''), type = String(mediaType || '').toLowerCase();
    if (type === 'series' || type === 'show' || type === 'other' || type === 'anime') type = 'tv';
    var kitsu = id.match(/^(kitsu:[1-9]\d*)(?::([1-9]\d*))?$/i);
    if (kitsu) {
      id = kitsu[1].toLowerCase();
      if (kitsu[2] && (episode == null || Number(episode) === Number(kitsu[2]))) episode = Number(kitsu[2]);
      else if (kitsu[2]) return Promise.resolve([]);
      if (season == null) season = 1;
    }
    if ((!/^[1-9]\d*$/.test(id) && !/^kitsu:[1-9]\d*$/.test(id)) ||
        (type !== 'movie' && type !== 'tv')) return Promise.resolve([]);
    if (type === 'tv' && (!/^\d+$/.test(String(season)) || !/^[1-9]\d*$/.test(String(episode)))) return Promise.resolve([]);
    var ctx = { start: Date.now(), site: SOURCE_SITE }, ready = [];
    season = Number(season); episode = Number(episode);
    var work = metadata(id, type, ctx).then(function (meta) {
      if (!meta) return [];
      ctx.names = aliases(meta);
      if (!ctx.names.length) return [];
      return search(meta, season, type, ctx).then(function (cards) {
        return findPage(cards, meta, type, season, episode, ctx);
      }).then(function (page) { return page ? pageStreams(page, ctx) : []; })
        .then(function (sources) { ready = sources; return sources; });
    }).catch(function (e) { log(e.message); return []; });
    return bounded(work, 52000, function () { return ready; });
  }

  module.exports = { getStreams: getStreams };
}());

