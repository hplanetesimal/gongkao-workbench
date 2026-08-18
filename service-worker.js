const CACHE='xixi-v2';
const ASSETS=['./','./index.html','./mikko88-gongkao-workbench.html','./assets/charts.js','./assets/charts.js?v=3','./_shared/js/echarts.min.js','./_shared/js/xlsx.full.min.js','./近期安排导入模板.xlsx','./manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp}).catch(()=>caches.match('./index.html')))));
