// Basic service worker: cache static assets for offline/viewing
const CACHE = 'orbic-v3-cache-v1';
const ASSETS = ['./','./index.html','./style.css','./app.js','./favicon.svg','./manifest.json'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', e=>{
  if(e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
    // cache new requests (runtime)
    return caches.open(CACHE).then(cache=>{
      cache.put(e.request, resp.clone());
      return resp;
    });
  }).catch(()=>caches.match('./'))));
});
