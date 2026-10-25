/* Live smoke test. Node 18+; curl is used only by this developer test harness. */
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFile } = require('node:child_process');
const cheerio = require('cheerio');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
const selected = process.env.LIVE_PROVIDER || 'donghuastream';
const providers = selected === 'all' ? manifest.scrapers : manifest.scrapers.filter(p => p.id === selected || p.id === 'donghuastream-' + selected);
if (!providers.length) throw new Error('Unknown LIVE_PROVIDER: ' + selected);
const records = [];
const metadata = { id: 223911, name: 'Renegade Immortal', original_name: '仙逆',
  alternative_titles: { results: [{ title: 'Xian Ni' }] }, seasons: [{season_number:1, episode_count:200}] };
function curlFetch(url, options = {}, provider) {
  if (url.startsWith('https://api.themoviedb.org/')) {
    return Promise.resolve({ ok:true, status:200, url, text:()=>Promise.resolve(JSON.stringify(metadata)) });
  }
  return new Promise((resolve, reject) => {
    const args = ['-sS', '-L', '--max-time', '22', '-w', '\n%{http_code}\n%{url_effective}', url];
    for (const [k,v] of Object.entries(options.headers || {})) args.push('-H', `${k}: ${v}`);
    if (options.method) args.push('-X', options.method);
    if (options.body) args.push('--data-binary', options.body);
    execFile('curl', args, {maxBuffer:8*1024*1024}, (err, output) => {
      if (err) { records.push({provider, host:new URL(url).hostname, error:err.message.split('\n')[0]}); reject(err); return; }
      const lines = output.split('\n'), effective = lines.pop(), status = Number(lines.pop()), body = lines.join('\n');
      records.push({provider, host:new URL(url).hostname, status, bytes:body.length});
      resolve({ok:status>=200&&status<300, status, url:effective, text:()=>Promise.resolve(body)});
    });
  });
}
(async()=>{
  const results = await Promise.all(providers.map(async provider => {
    const source = fs.readFileSync(path.join(__dirname, '..', provider.filename), 'utf8');
    const sandbox = {module:{exports:{}}, console, URL, setTimeout, clearTimeout, TMDB_API_KEY:'metadata-fixture-only', fetch:(url, options)=>curlFetch(url, options, provider.id),
      require:n=>{if(n==='cheerio-without-node-native')return cheerio;throw Error(n);}};
    vm.runInNewContext(source,sandbox);
    const start=Date.now();
    const streams=await sandbox.module.exports.getStreams('223911','tv',1,Number(process.env.LIVE_EPISODE || 162));
    return {provider:provider.name,elapsedSeconds:Math.round((Date.now()-start)/1000),streamCount:streams.length,
      streams:streams.map(s=>({name:s.name,quality:s.quality,subtitleLanguages:s.subtitles.map(t=>t.language)}))};
  }));
  console.log(JSON.stringify({metadata:'fixture; site and player requests are live',results,requests:records},null,2));
  if(!results.some(r=>r.streamCount))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
