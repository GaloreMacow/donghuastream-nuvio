const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),cheerio=require('cheerio');
const source=fs.readFileSync(path.join(__dirname,'../providers/donghuastream.js'),'utf8');
const fixtures=JSON.parse(fs.readFileSync(path.join(__dirname,'sites.json'),'utf8'));
const keys=Object.keys(fixtures),meta={name:'Renegade Immortal',alternative_titles:{results:[{title:'Xian Ni'}]},seasons:[{season_number:1,episode_count:200}]};
let passed=0;function check(name,fn){fn();passed++;console.log('PASS '+name);}
function response(body,url){return {ok:true,status:200,url,text:()=>Promise.resolve(typeof body==='string'?body:JSON.stringify(body))};}
function load(fetch,timers={}){const box={module:{exports:{}},URL,console:{warn(){},log(){}},TMDB_API_KEY:'fixture',require:()=>cheerio,fetch,...timers};vm.runInNewContext(source.replace('module.exports = { getStreams: getStreams };','module.exports = {getStreams,SITES,rankCards,chooseEpisode,mirrors,supportedMirror,pageStreams,findPage,bounded};'),box);return box.module.exports;}
(async()=>{
 const p=load(()=>Promise.reject(Error('Unexpected request')));
 keys.forEach((key,index)=>{const f=fixtures[key],site=p.SITES[index+1];
  check(site.name+' matches catalog and exact episode',()=>{const cards=p.rankCards(f.search,meta,1,'tv',site);assert.equal(cards.length,1);assert.equal(p.chooseEpisode(f.series,cards[0],meta,'tv',1,key==='hdonghua'?146:162),f.page);assert.equal(p.chooseEpisode(f.series,cards[0],meta,'tv',1,999),'');});
  check(site.name+' extracts supported player controls',()=>{const mirrors=p.mirrors(f.episode,f.page);assert(mirrors.filter(m=>p.supportedMirror(m,{site})).length>0);assert(!mirrors.some(m=>/a-ads|\/\/t\.co\/|nblmovies/.test(m.url)));});
 });
 check('relay iframe is extracted even alongside the server menu',()=>assert(p.mirrors(fixtures.luciferin.relay,fixtures.luciferin.page).some(m=>m.url.includes('ok.ru/videoembed/'))));
 check('numbered sequels cannot match the original title',()=>{const site=p.SITES[3];assert.equal(p.rankCards('<div class="bsx"><a title="Renegade Immortal 2" href="'+site.url+'/anime/sequel/"></a></div>',meta,1,'tv',site).length,0);});
 check('bracketed aliases retain sequel and part numbers',()=>{const s=p.SITES[3];const cards='<div class="bsx"><a title="Renegade Immortal (Part 2)" href="'+s.url+'/anime/part-2/"></a></div>';assert.equal(p.rankCards(cards,meta,1,'tv',s).length,0);});
 function network(url){
  if(url.includes('api.themoviedb.org'))return Promise.resolve(response(meta,url));
  const site=p.SITES.find(s=>url.startsWith(s.url+'/'));
  if(site){const i=p.SITES.indexOf(site),f=i?fixtures[keys[i-1]]:fixtures.anime4i;
   if(url.includes('/?s='))return Promise.resolve(response(f.search.replaceAll('https://anime4i.com',i?'https://anime4i.com':site.url),url));
   if(/\/v\/\d+\/?$/.test(url))return Promise.resolve(response(fixtures.luciferin.relay,url));
   if(url===f.page||(!i&&url.includes('episode-162')))return Promise.resolve(response(f.episode,url));
   return Promise.resolve(response(f.series.replaceAll('https://anime4i.com',i?'https://anime4i.com':site.url),url));
  }
  if(url.includes('dailymotion.com/player/metadata/'))return Promise.resolve(response({qualities:{'1080':[{type:'video/mp4',url:'https://cdn.example/'+url.split('/').pop()+'.mp4'}]}},url));
  if(url.includes('rumble.com/embedJS/'))return Promise.resolve(response({ua:{mp4:{720:{url:'https://cdn.example/'+url.split('v=')[1]+'.mp4'}}}},url));
  if(url.includes('ok.ru/videoembed/')){const data={flashvars:{metadata:JSON.stringify({videos:[{name:'full',url:'https://cdn.example/'+url.split('/').pop().split('?')[0]+'.mp4'}]})}};return Promise.resolve(response('<div data-options="'+JSON.stringify(data).replaceAll('&','&amp;').replaceAll('"','&quot;')+'"></div>',url));}
  return Promise.reject(Error('Unsupported fixture request'));
 }
 const full=load(network),streams=await full.getStreams(223911,'tv',1,162);
 check('combined lookup returns multiple sites and preserves full resolution labels',()=>{for(const key of ['AnimeXin','Lucifer Donghua .in','Lucifer Donghua .org','AnimeKhor','Donghua World'])assert(streams.some(s=>s.name.startsWith(key+' | ')),key);assert(streams.every(s=>/1080p|720p/.test(s.quality)));});
 const a4=await full.pageStreams(fixtures.anime4i.page,{start:Date.now(),site:p.SITES[2]});
 check('Anime4i resolves its supported players',()=>assert(a4.some(s=>s.name.startsWith('Anime4i | '))));
 check('repeated shared media URLs are deduplicated',()=>assert.equal(new Set(streams.map(s=>s.url)).size,streams.length));
 check('language variants remain distinct',()=>{assert(streams.some(s=>s.name.includes('AnimeXin | OK.ru | English')));assert(streams.some(s=>s.name.includes('AnimeXin | OK.ru | Indonesian')));});
 const broken=load(u=>u.startsWith('https://anime4i.com/')?Promise.reject(Error('Site unavailable')):network(u));const surviving=await broken.getStreams(223911,'tv',1,162);
 check('one failed site leaves other results available',()=>assert(surviving.some(s=>s.name.startsWith('AnimeXin | '))));
 const hd=await full.pageStreams(fixtures.hdonghua.page,{start:Date.now(),site:p.SITES[8]});
 check('H-Donghua resolves Dailymotion and direct video with subtitles',()=>{assert(hd.some(s=>s.name.includes('Dailymotion')));assert(hd.some(s=>s.url.includes('archive.org')&&s.subtitles.some(t=>t.language==='en')));});
 const ds=p.SITES[7],card=p.rankCards(fixtures.dongsub.search,meta,1,'tv',ds)[0];let called=false;
 const api=load(u=>{if(u.includes('/wp-json/')){called=true;assert(decodeURIComponent(u).includes('Episode 161'));return Promise.resolve(response([{title:'Renegade Immortal (Xian Ni) Episode 161 English Subtitles',url:ds.url+'/exact-161/'}],u));}return Promise.resolve(response(fixtures.dongsub.series,u));});
 const found=await api.findPage([card],meta,'tv',1,161,{start:Date.now(),site:ds});
 check('DongSub older episodes use exact public search API',()=>{assert(called);assert.equal(found,ds.url+'/exact-161/');});
 const timed=load(network,{setTimeout:(fn)=>setTimeout(fn,2),clearTimeout});const fallback=await timed.bounded(new Promise(()=>{}),9000,()=>['partial']);
 check('optional deadline returns completed results without hanging',()=>assert.equal(fallback[0],'partial'));
 console.log('\n'+passed+' multi-site checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
