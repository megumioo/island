const CACHE_NAME = 'island-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './service-worker.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  './icons/icon-152x152.png',
  './icons/icon-180x180.png',
  './icons/icon-144x144.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // 处理添加到主屏幕的路径错误
  if (event.request.mode === 'navigate') {
    const requestUrl = new URL(event.request.url);
    
    // 如果是错误的根路径，重定向到正确的路径
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
      const correctUrl = new URL('/island-c/index.html', requestUrl.origin);
      event.respondWith(Response.redirect(correctUrl, 301));
      return;
    }
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        // 克隆请求，因为请求流只能使用一次
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // 检查是否收到有效的响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // 克隆响应，因为响应流只能使用一次
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});

// 处理后台同步
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // 这里可以实现后台数据同步逻辑
      console.log('Background sync triggered')
    );
  }
});