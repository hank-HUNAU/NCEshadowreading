// Service Worker for ilabshadowing
const CACHE_NAME = 'ilabshadowing-v1';
const AUDIO_CACHE = 'ilabshadowing-audio-v1';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/js/main.js',
  '/css/style.css',
  '/data.json',
  '/manifest.json'
];

// 安装：缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME && name !== AUDIO_CACHE) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
});

// 拦截请求
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // MP3 音频文件：缓存优先
  if (url.endsWith('.mp3')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) {
            console.log('[SW] Audio cache hit:', url);
            // 后台更新缓存
            fetch(event.request).then(res => {
              if (res.ok) cache.put(event.request, res);
            });
            return response;
          }
          console.log('[SW] Audio cache miss, fetching:', url);
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res);
            return res;
          });
        });
      })
    );
    return;
  }
  
  // LRC 歌词文件：缓存优先
  if (url.endsWith('.lrc')) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) {
            console.log('[SW] LRC cache hit:', url);
            return response;
          }
          console.log('[SW] LRC cache miss, fetching:', url);
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res);
            return res;
          });
        });
      })
    );
    return;
  }
  
  // 其他静态资源：缓存优先
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request);
    })
  );
});
