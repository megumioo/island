const CACHE_NAME = 'island-v4';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './service-worker.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-180x180.png',
  './icons/icon-192x192.png',
  './icons/icon-310x310.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('正在缓存应用文件...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('所有文件已成功缓存');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('缓存失败:', error);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('删除旧缓存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker 激活成功');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // 处理添加到主屏幕的路径重定向
  if (event.request.mode === 'navigate') {
    const requestUrl = new URL(event.request.url);
    
    // 如果是错误的根路径，重定向到正确的路径
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
      const correctUrl = new URL('/island-c/index.html', requestUrl.origin);
      console.log('重定向到正确路径:', correctUrl.href);
      event.respondWith(Response.redirect(correctUrl, 301));
      return;
    }
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果在缓存中找到，直接返回
        if (response) {
          console.log('从缓存中获取:', event.request.url);
          return response;
        }
        
        // 否则从网络获取
        console.log('从网络获取:', event.request.url);
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then(response => {
            // 检查响应是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 克隆响应以进行缓存
            const responseToCache = response.clone();
            
            // 将新资源添加到缓存
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('已缓存新资源:', event.request.url);
              });
            
            return response;
          })
          .catch(error => {
            console.error('获取失败:', event.request.url, error);
            
            // 对于导航请求，返回缓存的首页
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            
            // 对于其他请求，可以返回自定义的离线页面
            return new Response('网络连接失败，请检查网络设置', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('后台同步触发:', event.tag);
    event.waitUntil(
      // 这里可以添加后台同步逻辑
      Promise.resolve().then(() => {
        console.log('后台同步完成');
      })
    );
  }
});

self.addEventListener('push', event => {
  console.log('推送通知:', event);
  
  const options = {
    body: '小岛有新消息啦！',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '查看详情',
        icon: './icons/icon-72x72.png'
      },
      {
        action: 'close',
        title: '关闭',
        icon: './icons/icon-72x72.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('小航小刀小岛', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('通知被点击:', event.notification.tag);
  event.notification.close();
  
  if (event.action === 'explore') {
    // 用户点击了"查看详情"
    event.waitUntil(
      clients.matchAll({type: 'window'}).then(windowClients => {
        for (let client of windowClients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
    );
  }
});

// 错误处理
self.addEventListener('error', event => {
  console.error('Service Worker 错误:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('未处理的 Promise 拒绝:', event.reason);
});
