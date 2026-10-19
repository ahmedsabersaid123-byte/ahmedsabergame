const CACHE='asg-v2';
const FILES=['./','index.html','game.html','manifest.webmanifest','icon-192.png','icon-512.png'];
const LIBS=/https?:\/\/[^\s"'<>)`\\]+\.(?:js|mjs|css|woff2?|ttf)(?=["'\s)<`\\?#]|$)/g;

// تحميل الملفات من أول مرة: لو ملف واحد مش موجود مايبوظش الباقي،
// ولو اللعبة بتحمّل مكتبات من النت (زي Three.js) بنحفظها كمان
async function precache(){
  const c=await caches.open(CACHE);
  await Promise.all(FILES.map(f=>c.add(f).catch(()=>{})));
  const found=new Set();
  for(const p of ['game.html','index.html']){
    try{const r=await c.match(p);if(!r)continue;((await r.clone().text()).match(LIBS)||[]).forEach(u=>found.add(u))}catch(e){}
  }
  await Promise.all([...found].map(u=>fetch(u,{mode:'no-cors'}).then(r=>c.put(u,r)).catch(()=>{})));
}
self.addEventListener('install',e=>{e.waitUntil(precache().then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});

function net(r,ms){return new Promise((ok,no)=>{const t=setTimeout(()=>no(new Error('timeout')),ms);fetch(r).then(x=>{clearTimeout(t);ok(x)},x=>{clearTimeout(t);no(x)})})}
async function fallback(r){
  let m=await caches.match(r,{ignoreSearch:true});
  if(!m&&r.mode==='navigate')m=await caches.match('game.html')||await caches.match('./')||await caches.match('index.html');
  return m||Response.error();
}
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||r.headers.has('range')||/\.apk$/i.test(u.pathname)||!/^https?:$/.test(u.protocol))return;
  if(u.origin!==location.origin){ // مكتبات خارجية: من الحفظ أولاً
    e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{
      if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}
      return res})));
    return;
  }
  // ملفات اللعبة: النت أولاً (مهلة قصيرة)، ولو مفيش نت أو بطيء نفتح من الحفظ
  e.respondWith(net(r,r.mode==='navigate'?4000:8000)
    .then(res=>{if(res.ok&&res.status===200){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})
    .catch(()=>fallback(r)));
});
