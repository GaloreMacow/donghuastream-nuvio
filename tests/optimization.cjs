const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const source = fs.readFileSync(__dirname + '/../providers/donghuastream.js', 'utf8');
const SITE = 'https://donghuastream.org';
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function response(body, url, status = 200) { return {ok:status>=200&&status<300,status,url,text:()=>Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body))}; }
function load(code, fetch) {
  const stats = {imports:0,htmlParses:0,playlistParses:0};
  const context = {module:{exports:{}},console:{warn(){},log(){}},URL,TMDB_API_KEY:'fixture',fetch,
    onMaster(){stats.playlistParses++;},require(name){assert.equal(name,'cheerio-without-node-native');stats.imports++;return {load(...args){stats.htmlParses++;return cheerio.load(...args);}};}};
  code = code.replace('function master(text, base) {','function master(text, base) { onMaster();')
    .replace('module.exports = { getStreams: getStreams };','module.exports = {getStreams,request,resolveMirror,pageStreams,expand,master,dedupeExact:typeof dedupeExact === "function"?dedupeExact:null};');
  vm.runInNewContext(code,context);
  return {p:context.module.exports,stats};
}
function stream(overrides={}) {return {name:'Rumble',title:'Auto',url:'https://cdn.example/master.m3u8',quality:'Auto',headers:{Referer:SITE},subtitles:[],type:'hls',_type:'hls',...overrides};}
const master='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x816\n1080.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x544\n720.m3u8';
const option=(label,url)=>'<option value="'+Buffer.from('<iframe src="'+url+'"></iframe>').toString('base64')+'">'+label+'</option>';
const meta={name:'Renegade Immortal',seasons:[{season_number:1,episode_count:200}]};
async function benchmark(code) {
  const calls=[];
  const {p,stats}=load(code,(url)=>{
    calls.push(url);
    if(url===SITE+'/episode/')return Promise.resolve(response('<h1>Renegade Immortal Episode 1</h1><select class="mirror">'+[1,2,3].map(n=>option('English',SITE+'/episode/v/'+n+'/')).join('')+option('English','https://rumble.com/embed/vsame/')+'</select>',url));
    if(/\/v\/\d+\/$/.test(url))return Promise.resolve(response('<div id="pembed"><iframe src="https://rumble.com/embed/vsame/"></iframe></div>',url));
    if(url.includes('/embedJS/'))return Promise.resolve(response({ua:{hls:{auto:{url:'https://cdn.example/master.m3u8'},1080:{url:'https://cdn.example/master.m3u8'}}},cc:{en:{path:'https://cdn.example/en.vtt',language:'English'}}},url));
    if(url==='https://cdn.example/master.m3u8')return Promise.resolve(response(master,url));
    throw Error('Unmocked benchmark URL');
  });
  const streams=await p.pageStreams(SITE+'/episode/',{start:Date.now(),site:{id:'donghuastream',name:'DonghuaStream',url:SITE}});
  return {requests:calls.length,htmlParses:stats.htmlParses,playlistParses:stats.playlistParses,streams:JSON.parse(JSON.stringify(streams))};
}
(async()=>{
  const lazy=load(source,()=>Promise.reject(Error('Unexpected request')));
  await lazy.p.getStreams('invalid','tv',1,1);
  check('invalid input does not load the HTML parser',()=>assert.equal(lazy.stats.imports,0));
  const empty=load(source,u=>Promise.resolve(response({},u)));await empty.p.getStreams('223911','tv',1,1);
  check('metadata without titles does not load the HTML parser',()=>assert.equal(empty.stats.imports,0));
  let calls=0;const req=load(source,u=>{calls++;return Promise.resolve(response('body',u));}),ctx={start:Date.now()};
  const values=await Promise.all([req.p.request('https://example.com/a',SITE,ctx),req.p.request('https://example.com/a',SITE,ctx)]);
  check('identical concurrent GET requests share one fetch',()=>{assert.equal(calls,1);assert.equal(values[0].body,values[1].body);});
  await req.p.request('https://example.com/a',SITE,ctx);
  check('completed GET responses are reused within the lookup',()=>assert.equal(calls,1));
  await req.p.request('https://example.com/a','https://different.example/',ctx);
  check('different playback referrers are not merged',()=>assert.equal(calls,2));
  await req.p.request('https://example.com/a',SITE,ctx,{headers:{Authorization:'first'}});
  await req.p.request('https://example.com/a',SITE,ctx,{headers:{Authorization:'second'}});
  check('different authentication headers are not merged',()=>assert.equal(calls,4));
  await req.p.request('https://example.com/a',SITE,ctx,{method:'POST',body:'token'});
  await req.p.request('https://example.com/a',SITE,ctx,{method:'POST',body:'token'});
  check('POST requests are never response-cached',()=>assert.equal(calls,6));
  await req.p.request('https://example.com/a',SITE,{start:Date.now()});
  check('a new lookup gets a fresh response',()=>assert.equal(calls,7));
  ctx.start-=50000;await req.p.request('https://example.com/a',SITE,ctx);
  await assert.rejects(req.p.request('https://example.com/new',SITE,ctx),/budget/);
  check('expired lookup can reuse data but cannot start new requests',()=>assert.equal(calls,7));
  let failedCalls=0;const fail=load(source,()=>{failedCalls++;return Promise.reject(Error('offline'));});const failCtx={start:Date.now()};
  await Promise.all([fail.p.request('https://example.com/down',SITE,failCtx).catch(()=>{}),fail.p.request('https://example.com/down',SITE,failCtx).catch(()=>{})]);
  check('identical failed requests are not repeated during one lookup',()=>assert.equal(failedCalls,1));
  const hls=load(source,u=>Promise.resolve(response(master,u)));const hctx={start:Date.now()};
  const expanded=await Promise.all([hls.p.expand(stream(),hctx),hls.p.expand(stream({name:'Other',subtitles:[{url:'https://cdn.example/fr.vtt',language:'fr'}]}),hctx)]);
  check('shared HLS masters are parsed only once',()=>assert.equal(hls.stats.playlistParses,1));
  check('shared playlist data keeps source names and subtitles separate',()=>{assert.equal(expanded[0][0].name,'Rumble');assert.equal(expanded[1][0].name,'Other');assert.equal(expanded[1][1].subtitles[0].language,'fr');assert.equal(expanded[0][0].subtitles.length,0);});
  let authFetches=[];const auth=load(source,(u,o)=>{authFetches.push(o.headers.Authorization);return Promise.resolve(response(master,u));});const ac={start:Date.now()};
  await Promise.all(['one','two'].map(Authorization=>auth.p.expand(stream({headers:{Referer:SITE,Authorization}}),ac)));
  check('playlist caches preserve source-specific request headers',()=>assert.deepEqual(authFetches.sort(),['one','two']));
  const cc=load(source,u=>Promise.resolve(response({ua:{mp4:{720:{url:'https://cdn.example/movie.mp4'}}},cc:{en:{path:'https://cdn.example/en.vtt',language:'English'}}},u))),rc={start:Date.now()};const mirror={url:'https://rumble.com/embed/vsame/',label:'English'};
  const first=await cc.p.resolveMirror(mirror,rc);first[0].name='changed';first[0].subtitles.push({url:'bad'});
  const second=await cc.p.resolveMirror(mirror,rc);
  check('cached host results do not share mutable display state',()=>{assert.equal(second[0].name,'DonghuaStream | Rumble');assert.equal(second[0].subtitles.length,1);});
  const error=await load(source,u=>Promise.resolve(response('{"error":"expired"}',u))).p.expand(stream(),{start:Date.now()});
  check('JSON error pages are not offered as HLS',()=>assert.equal(error.length,0));
  const external='#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="sound.m3u8"\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",URI="subs.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x800,AUDIO="audio",SUBTITLES="subs"\nvideo.m3u8';
  const intact=await load(source,u=>Promise.resolve(response(external,u))).p.expand(stream(),{start:Date.now()});
  check('external audio and subtitle groups retain the Auto master',()=>{assert.equal(intact.length,1);assert.equal(intact[0].url,'https://cdn.example/master.m3u8');});
  const media='#EXTM3U\n'+Array.from({length:5000},(_,i)=>'#EXTINF:5,\n'+i+'.ts').join('\n');
  check('large media playlists retain valid empty variant lists',()=>assert.equal(lazy.p.master(media,'https://cdn.example/media.m3u8').variants.length,0));
  const same=stream({url:'https://cdn.example/video.mp4',headers:{Referer:SITE},subtitles:[]});
  check('exact media duplicates are removed without dropping alternate headers or captions',()=>{const items=lazy.p.dedupeExact([same,{...same,name:'Other'}, {...same,headers:{Referer:'https://other.example/'}},{...same,subtitles:[{url:'https://cdn.example/sub.vtt',language:'en'}]}]);assert.equal(items.length,3);});
  let round=0;const fresh=load(source,u=>{
    if(u.includes('api.themoviedb.org')){round++;return Promise.resolve(response(meta,u));}
    if(u.includes('/?s='))return Promise.resolve(response('<div class="bsx"><a title="Renegade Immortal" href="'+SITE+'/anime/renegade/"></a></div>',u));
    if(u.includes('/anime/renegade/'))return Promise.resolve(response('<h1>Renegade Immortal</h1><div class="eplister"><li><a href="'+SITE+'/episode/"><div class="epl-num">1</div></a></li></div>',u));
    if(u===SITE+'/episode/')return Promise.resolve(response('<h1>Renegade Immortal Episode 1</h1><select class="mirror">'+option('English','https://rumble.com/embed/vsame/')+'</select>',u));
    return Promise.resolve(response({ua:{mp4:{720:{url:'https://cdn.example/fresh-'+round+'.mp4'}}}},u));
  });
  const one=await fresh.p.getStreams('223911','tv',1,1),two=await fresh.p.getStreams('223911','tv',1,1);
  check('refreshing an episode never reuses stale signed playback links',()=>{assert.equal(one.length,1);assert.equal(two.length,1);assert.notEqual(one[0].url,two[0].url);});
  const optimized=await benchmark(source);
  check('repeated relay/player paths resolve once and stay Auto-first',()=>{assert.equal(optimized.requests,6);assert.equal(optimized.playlistParses,1);assert.deepEqual(optimized.streams.map(s=>s.quality),['Auto','1080p','720p']);assert(optimized.streams.every(s=>s.subtitles[0].language==='en'));});
  if(process.env.BASELINE_SOURCE){const baseline=await benchmark(fs.readFileSync(process.env.BASELINE_SOURCE,'utf8'));assert.deepEqual(optimized.streams,baseline.streams);const report={baseline:{...baseline,streams:baseline.streams.length},optimized:{...optimized,streams:optimized.streams.length}};console.log('BENCHMARK '+JSON.stringify(report));}
  console.log('\n'+passed+' optimization checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
