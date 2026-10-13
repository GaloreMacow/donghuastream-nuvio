const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cheerio = require('cheerio');
const acorn = require('acorn');
const { getQuickJS } = require('quickjs-emscripten');
const root = path.resolve(__dirname,'..');
const source = fs.readFileSync(path.join(root,'providers/donghuastream.js'),'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const SITE='https://donghuastream.org';
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS '+name);}
function response(body,url,status=200){return {ok:status>=200&&status<300,status,url,text:()=>Promise.resolve(typeof body==='string'?body:JSON.stringify(body))};}
function load(fetch,key='fixture',UrlConstructor=URL){
  const context={module:{exports:{}},console:{log(){}},URL:UrlConstructor,fetch,require:n=>{
    assert.equal(n,'cheerio-without-node-native');return cheerio;
  }};
  if(key!==null)context.TMDB_API_KEY=key;
  // Test helpers stay private in the distributed provider.
  const code=source.replace('module.exports = { getStreams: getStreams };','module.exports = {getStreams, absolute, decode64, rankCards, chooseEpisode, episodeNumbers, mirrors, master, expand, unpackAssignments, trackList, pageStreams};');
  vm.runInNewContext(code,context,{timeout:2000});return context.module.exports;
}
const meta={name:'Renegade Immortal',original_name:'仙逆',alternative_titles:{results:[{title:'Xian Ni'}]},seasons:[{season_number:1,episode_count:52},{season_number:2,episode_count:30}]};
const cards=`<div class="bsx"><a title="Renegade Immortal Movie Battle of the Gods" href="${SITE}/anime/movie/"><span class="typez">Movie</span></a></div><div class="bsx"><a title="Renegade Immortal" href="${SITE}/anime/renegade/"><span class="typez">ONA</span></a></div><div class="bsx"><a title="Unrelated Immortal" href="${SITE}/anime/wrong/"></a></div>`;
function episodeList(title,num,url='correct',extra='') {return `<h1>${title}</h1><span class="alter">${title}</span><div class="eplister"><li><a href="${SITE}/${url}/"><div class="epl-num">${num}</div><div class="epl-title">${title} Episode ${num}</div></a></li>${extra}</div>`;}
function option(label,url){return `<option value="${Buffer.from('<iframe src="'+url+'"></iframe>').toString('base64')}">${label}</option>`;}
const episodePage='<h1>Renegade Immortal Episode 1</h1><select class="mirror">'+option('Dailymotion','https://geo.dailymotion.com/player/x.html?video=kpublic')+option('Rumble','https://rumble.com/embed/vpublic/')+option('OK.ru','https://ok.ru/videoembed/123')+option('All Sub Player','https://play.streamplay.co.in/embed/public')+'</select>';
const media='#EXTM3U\n#EXTINF:10,\nsegment.ts\n#EXT-X-ENDLIST';
const master='#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x816\n1080.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x544\n720.m3u8';
const externalMaster='#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",URI="sound.m3u8"\n#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x816,AUDIO="audio"\nvideo.m3u8';
const p=load(()=>Promise.reject(Error('Network not expected')));

(async()=>{
  check('manifest paths, IDs and versions',()=>{
    assert.equal(manifest.version,'1.0.1');assert.equal(manifest.scrapers.length,1);
    const ids=new Set();for(const s of manifest.scrapers){assert(!ids.has(s.id));ids.add(s.id);assert(fs.existsSync(path.join(root,s.filename)));assert.equal(s.version,manifest.version);assert.deepEqual(s.supportedTypes,['movie','tv']);}
  });
  check('ES5 syntax and no Node/browser/eval dependencies',()=>{
    acorn.parse(source,{ecmaVersion:5});assert(!/\b(?:Buffer|process|document|window|setTimeout|XMLHttpRequest)\s*[.(]/.test(source.replace(/window\\?\./g,'')));assert(!/\beval\s*\(|new\s+Function\b/.test(source));
  });
  check('base64 mirrors without atob or Buffer',()=>assert.equal(p.decode64('PGltZz4='),'<img>'));
  check('non-HTTP URLs are rejected',()=>assert.equal(p.absolute('javascript:alert(1)'),''));
  check('protocol-relative player URLs stay on their own host',()=>assert.equal(p.absolute('//ok.ru/videoembed/123',SITE),'https://ok.ru/videoembed/123'));
  // Model the limited URL constructors in Android TV and mobile/desktop runtimes.
  function LegacyURL(value,base){
    let full=value;if(base&&!/^https?:\/\//i.test(value))full=value[0]==='/'?base.match(/^https?:\/\/[^/]+/)[0]+value:base.replace(/\/[^/]*$/,'/')+value;
    const parsed=new URL(full);this.href=full;this.protocol=parsed.protocol;this.hostname=parsed.hostname;
  }
  const limited=load(()=>Promise.reject(Error('Unexpected')),'fixture',LegacyURL);
  check('parent HLS paths normalize with Nuvio URL shims',()=>assert.equal(limited.absolute('../720/video.m3u8','https://cdn.example/path/master.m3u8?x=1'),'https://cdn.example/720/video.m3u8'));
  check('query-only HLS URLs retain the playlist filename',()=>assert.equal(limited.absolute('?token=a%2Fb&expires=123','https://cdn.example/path/master.m3u8?old=1'),'https://cdn.example/path/master.m3u8?token=a%2Fb&expires=123'));
  check('root parent paths produce a single slash',()=>assert.equal(limited.absolute('..','https://cdn.example/a/master.m3u8'),'https://cdn.example/'));
  check('TV search excludes movies and unrelated titles',()=>{const c=p.rankCards(cards,meta,1,'tv');assert.equal(c.length,1);assert.equal(c[0].title,'Renegade Immortal');});
  check('absolute numbering across TMDB seasons',()=>assert.equal(p.chooseEpisode(episodeList('Renegade Immortal','53'),{siteSeason:null},meta,'tv',2,1),SITE+'/correct/'));
  check('explicit site season uses local episode numbering',()=>assert.equal(p.chooseEpisode(episodeList('Renegade Immortal Season 2','1'),{siteSeason:2},meta,'tv',2,1),SITE+'/correct/'));
  check('bracket absolute numbers map continuous TMDB season',()=>assert.equal(p.chooseEpisode(episodeList('Renegade Immortal Season 4','160 [245]'),{siteSeason:4},meta,'tv',1,245),SITE+'/correct/'));
  check('wrong season is not substituted',()=>assert.equal(p.chooseEpisode(episodeList('Renegade Immortal Season 4','1'),{siteSeason:4},meta,'tv',2,1),''));
  check('unknown previous episode count does not guess',()=>assert.equal(p.chooseEpisode(episodeList('Renegade Immortal','53'),{siteSeason:null},{name:'Renegade Immortal'},'tv',2,1),''));
  check('specials never substitute regular episodes',()=>assert.equal(p.chooseEpisode(episodeList('Renegade Immortal','1'),{siteSeason:null},meta,'tv',0,1),''));
  check('multiple movie parts require explicit mapping',()=>assert.equal(p.chooseEpisode(episodeList('Renegade Immortal','1','one',`<li><a href="${SITE}/two/"><div class="epl-num">2</div></a></li>`),{},meta,'movie',0,0),''));
  check('all four embed hosts are extracted',()=>assert.equal(p.mirrors(episodePage,SITE+'/correct/').length,4));
  check('duplicate mirror links are suppressed',()=>assert.equal(p.mirrors('<select class="mirror">'+option('R1','https://rumble.com/embed/v1/')+option('R2','https://rumble.com/embed/v1/')+'</select>',SITE).length,1));
  check('cropped 1920-wide HLS remains 1080p',()=>assert.equal(p.master(master,'https://cdn.example/master.m3u8').variants[0].quality,'1080p'));
  check('HLS relative variants resolve against the final URL',()=>assert.equal(p.master(master,'https://cdn.example/path/master.m3u8').variants[0].url,'https://cdn.example/path/1080.m3u8'));
  check('subtitle labels become ISO language codes',()=>assert.equal(p.trackList([{file:'https://cdn.example/sub.vtt',label:'French'}],SITE)[0].language,'fr'));
  check('subtitle download headers survive provider output',()=>assert.equal(p.trackList([{file:'https://cdn.example/sub.vtt',label:'French'}],SITE)[0].headers.Referer,SITE));
  check('thumbnail tracks are excluded',()=>assert.equal(p.trackList([{file:'https://cdn.example/tiles.vtt',kind:'thumbnails'}],SITE).length,0));
  check('packed assignments decode without executing scripts',()=>{const s=p.unpackAssignments("eval(function(p,a,c,k,e,d){return p}('0.1=\"2\";',3,3,'window|kaken|safe'.split('|')))");assert(s.includes('window.kaken="safe";'));});
  let calls=0;
  const invalid=load(()=>{calls++;return Promise.reject(Error('Unexpected'));});
  for(const args of [['bad','tv',1,1],['1','invalid'],['1','tv',null,1],['1','tv',1,0]])assert.equal((await invalid.getStreams(...args)).length,0);
  check('invalid input makes no network request',()=>assert.equal(calls,0));
  assert.equal((await load(()=>Promise.reject(Error('Unexpected')),null).getStreams('1','tv',1,1)).length,0);passed++;console.log('PASS missing TMDB key fails cleanly');
  const hls=load((u)=>Promise.resolve(response(externalMaster,u)));
  const s={name:'DonghuaStream | Rumble',title:'Rumble | Auto',url:'https://cdn.example/master.m3u8',headers:{Referer:SITE},subtitles:[],_type:'hls'};
  const audio=await hls.expand(s,{start:Date.now()});
  check('external audio preserves master instead of silent child',()=>{assert.equal(audio.length,1);assert.equal(audio[0].url,s.url);assert(audio[0].title.includes('1080p'));});
  const expanded=await load(u=>Promise.resolve(response(master,u))).expand({...s},{start:Date.now()});
  check('independent qualities expose Auto and both resolutions',()=>assert.equal(expanded.length,3));
  const htmlError=await load(u=>Promise.resolve(response('<html>Error</html>',u))).expand({...s},{start:Date.now()});
  check('confirmed HTML errors are not presented as HLS',()=>assert.equal(htmlError.length,0));
  const retained=await load(()=>Promise.reject(Error('Timeout'))).expand({...s},{start:Date.now()});
  check('a failed probe retains the player-provided HLS URL',()=>assert.equal(retained.length,1));
  const removed=await load(u=>Promise.resolve(response('',u,404))).expand({...s},{start:Date.now()});
  check('404 playlists are omitted',()=>assert.equal(removed.length,0));
  const opts=JSON.stringify({flashvars:{metadata:JSON.stringify({videos:[{name:'full',url:'https://okcdn.example/video.mp4'}]})}}).replace(/"/g,'&quot;');
  let seenRequests=[];
  const integrated=load((u,o)=>{
    seenRequests.push(u);
    if(u.startsWith('https://api.themoviedb.org/'))return Promise.resolve(response(meta,u));
    if(u.includes('/?s='))return Promise.resolve(response(cards,u));
    if(u===SITE+'/anime/renegade/')return Promise.resolve(response(episodeList('Renegade Immortal','1'),u));
    if(u===SITE+'/correct/')return Promise.resolve(response(episodePage,u));
    if(u.includes('dailymotion.com/player/metadata/'))return Promise.resolve(response({qualities:{auto:[{type:'application/x-mpegURL',url:'https://dm.example/master.m3u8'}]},subtitles:{data:{en:{label:'English',urls:['https://dm.example/en.srt']}}}},u));
    if(u.includes('rumble.com/embedJS/'))return Promise.reject(Error('one server failed'));
    if(u==='https://ok.ru/videoembed/123')return Promise.resolve(response('<div data-options="'+opts+'"></div>',u));
    if(u==='https://play.streamplay.co.in/embed/public')return Promise.resolve(response("eval(function(p,a,c,k,e,d){return p}('0.1=\"2\";',3,3,'window|kaken|token'.split('|')))" ,u));
    if(u==='https://play.streamplay.co.in/api/'){assert.equal(o.method,'POST');assert.equal(o.body,'token');return Promise.resolve(response({sources:[{file:'https://allsub.example/video.mp4',label:'1080p'}],tracks:[{file:'https://allsub.example/fr.vtt',label:'French'}]},u));}
    if(u==='https://dm.example/master.m3u8')return Promise.resolve(response(master,u));
    throw Error('Unmocked URL '+u);
  });
  const output=await integrated.getStreams('223911','tv',1,1);
  check('TMDB-to-site-to-host complete pipeline',()=>{assert.equal(output.length,5);assert(output.some(s=>s.name.includes('Dailymotion')));assert(output.some(s=>s.name.includes('OK.ru')));assert(output.some(s=>s.name.includes('All Sub Player')));});
  check('one broken server leaves the other servers intact',()=>assert(!output.some(s=>s.name.includes('Rumble'))));
  check('only media links are returned, with subtitle attachments',()=>{assert(output.every(s=>!s.url.includes('/embed/')));assert(output.find(s=>s.name.includes('All Sub Player')).subtitles.some(t=>t.language==='fr'));});
  check('explicit HLS type survives provider output',()=>assert(output.filter(s=>s.name.includes('Dailymotion')).every(s=>s.type==='hls')));
  for(const type of ['series','show','other']){
    const aliased=await integrated.getStreams('223911',type,1,1);
    check(type+' media alias uses TV episode requests',()=>assert.equal(aliased.length,output.length));
  }
  // Execute loading and deterministic parsing in the same JS engine family used by Nuvio TV.
  const QuickJS=await getQuickJS(),runtime=QuickJS.newRuntime(),context=runtime.newContext();
  try{
    runtime.setInterruptHandler(()=>false);
    const quickSource=source.replace('module.exports = { getStreams: getStreams };','module.exports = { getStreams: getStreams, master: master, decode64: decode64, unpackAssignments: unpackAssignments };');
    const prelude='var module={exports:{}}; var console={log:function(){}}; var require=function(){return {}};';
    let r=context.evalCode(prelude+quickSource);if(r.error)throw Error(context.dump(r.error));r.value.dispose();
    r=context.evalCode('JSON.stringify({loaded:typeof module.exports.getStreams,decoded:module.exports.decode64("PGltZz4="),master:module.exports.master("#EXTM3U", "https://example.com/")})');
    if(r.error)throw Error(context.dump(r.error));const value=JSON.parse(context.dump(r.value));r.value.dispose();
    check('QuickJS loads provider and executes parsing helpers',()=>{assert.equal(value.loaded,'function');assert.equal(value.decoded,'<img>');assert.deepEqual(value.master.variants,[]);});
  }finally{context.dispose();runtime.dispose();}
  console.log(`\n${passed} checks passed. Live hosts and TV playback need separate testing.`);
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
