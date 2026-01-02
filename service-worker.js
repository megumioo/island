/* ===================================
   小航小刀小岛 - Service Worker
   版本：1.0.0
   功能：PWA离线缓存和后台同步
   =================================== */

const CACHE_NAME = 'island-app-v1.0.0';
const CACHE_VERSION = '1.0.0';
const LAST_CACHE_CLEAN = 'last_cache_clean';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/favicon.ico',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 需要缓存的API（GitHub API）
const API_CACHE = [
  'https://api.github.com/user',
  'https://api.github.com/gists'
];

// 最大缓存时间（7天）
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

// 安装Service Worker
self.addEventListener('install', event => {
  console.log('🏝️ Service Worker 安装中...');
  
  // 跳过等待，立即激活新Service Worker
  self.skipWaiting();
  
  // 预缓存关键资源
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 正在缓存应用资源...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('✅ 所有关键资源已缓存');
      })
      .catch(error => {
        console.error('❌ 缓存失败:', error);
      })
  );
});

// 激活Service Worker
self.addEventListener('activate', event => {
  console.log('🔧 Service Worker 激活中...');
  
  event.waitUntil(
    Promise.all([
      // 清理旧缓存
      clearOldCaches(),
      // 立即接管所有客户端
      self.clients.claim()
    ])
  );
});

// 清理旧缓存
async function clearOldCaches() {
  const cacheKeys = await caches.keys();
  const currentDate = Date.now();
  
  // 检查是否需要清理缓存
  const lastClean = await getLastCleanTime();
  const shouldClean = !lastClean || (currentDate - lastClean > MAX_CACHE_AGE);
  
  if (shouldClean) {
    console.log('🧹 清理旧缓存...');
    
    for (const key of cacheKeys) {
      // 删除不是当前版本的缓存
      if (key !== CACHE_NAME) {
        console.log(`🗑️ 删除缓存: ${key}`);
        await caches.delete(key);
      }
    }
    
    // 更新清理时间
    await setLastCleanTime(currentDate);
  }
  
  return true;
}

// 获取上次清理时间
async function getLastCleanTime() {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(LAST_CACHE_CLEAN);
  
  if (response) {
    const text = await response.text();
    return parseInt(text, 10);
  }
  
  return null;
}

// 设置上次清理时间
async function setLastCleanTime(timestamp) {
  const cache = await caches.open(CACHE_NAME);
  const response = new Response(timestamp.toString());
  await cache.put(LAST_CACHE_CLEAN, response);
}

// 拦截网络请求
self.addEventListener('fetch', event => {
  // 跳过非GET请求和浏览器扩展请求
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  // 处理GitHub API请求（带授权头的不缓存）
  if (event.request.url.includes('api.github.com')) {
    // 如果有授权头，不缓存响应
    if (event.request.headers.has('Authorization')) {
      event.respondWith(networkFirst(event.request));
    } else {
      event.respondWith(cacheFirst(event.request));
    }
    return;
  }
  
  // 处理静态资源请求
  if (isStaticAsset(event.request.url)) {
    event.respondWith(cacheFirst(event.request));
  } else {
    event.respondWith(networkFirst(event.request));
  }
});

// 判断是否为静态资源
function isStaticAsset(url) {
  const currentOrigin = self.location.origin;
  const assetUrls = STATIC_ASSETS.map(asset => {
    if (asset.startsWith('http')) return asset;
    return currentOrigin + asset;
  });
  
  return assetUrls.some(assetUrl => url === assetUrl);
}

// 缓存优先策略
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // 首先尝试从缓存获取
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      // 检查缓存是否过期（针对API）
      if (isAPIRequest(request.url)) {
        const cacheAge = await getCacheAge(request);
        if (cacheAge > 24 * 60 * 60 * 1000) { // 24小时
          // 缓存过期，重新获取
          return updateCache(request, cache);
        }
      }
      
      console.log(`📦 从缓存返回: ${request.url}`);
      return cachedResponse;
    }
    
    // 缓存中没有，从网络获取
    return updateCache(request, cache);
  } catch (error) {
    console.error(`缓存优先策略出错 (${request.url}):`, error);
    
    // 如果离线且没有缓存，返回离线页面
    const offlineResponse = await cache.match('/index.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // 返回一个简单的离线提示
    return new Response('网络连接失败，请检查网络连接或应用处于离线状态。', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// 网络优先策略
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    // 首先尝试从网络获取
    const networkResponse = await fetch(request);
    
    // 如果请求成功，更新缓存
    if (networkResponse && networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
      console.log(`🌐 从网络获取并缓存: ${request.url}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.log(`网络请求失败，尝试从缓存获取: ${request.url}`);
    
    // 网络失败，尝试从缓存获取
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log(`📦 网络失败，从缓存返回: ${request.url}`);
      return cachedResponse;
    }
    
    // 如果离线且没有缓存，返回离线页面
    const offlineResponse = await cache.match('/index.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // 返回一个简单的离线提示
    return new Response('网络连接失败，请检查网络连接。', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// 更新缓存
async function updateCache(request, cache) {
  try {
    const networkResponse = await fetch(request);
    
    // 只缓存成功的响应
    if (networkResponse && networkResponse.status === 200) {
      await cache.put(request, networkResponse.clone());
      console.log(`🔄 更新缓存: ${request.url}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.error(`更新缓存失败 (${request.url}):`, error);
    throw error;
  }
}

// 获取缓存年龄
async function getCacheAge(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse && cachedResponse.headers.has('date')) {
    const dateHeader = cachedResponse.headers.get('date');
    const cachedDate = new Date(dateHeader).getTime();
    return Date.now() - cachedDate;
  }
  
  return Infinity;
}

// 判断是否为API请求
function isAPIRequest(url) {
  return url.includes('api.github.com');
}

// 后台同步事件
self.addEventListener('sync', event => {
  console.log(`🔄 后台同步事件: ${event.tag}`);
  
  if (event.tag === 'sync-island-data') {
    event.waitUntil(syncIslandData());
  }
});

// 同步岛数据（后台任务）
async function syncIslandData() {
  console.log('🔄 执行后台数据同步...');
  
  // 这里可以添加后台数据同步逻辑
  // 例如：检查是否有未同步的本地数据并上传到GitHub
  
  try {
    // 模拟后台同步任务
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ 后台同步完成');
    
    // 发送通知给所有客户端
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        message: '后台数据同步已完成',
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('❌ 后台同步失败:', error);
  }
}

// 推送通知事件
self.addEventListener('push', event => {
  console.log('📱 收到推送通知');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (error) {
      data = { title: '小航小刀小岛', body: event.data.text() };
    }
  }
  
  const title = data.title || '小航小刀小岛';
  const options = {
    body: data.body || '您有一条新通知',
    icon: 'icons/icon-192x192.png',
    badge: 'icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: '打开应用'
      },
      {
        action: 'close',
        title: '关闭'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 通知点击事件
self.addEventListener('notificationclick', event => {
  console.log('🖱️ 通知被点击:', event.notification.data);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // 默认打开应用
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // 如果有打开的窗口，聚焦它
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        
        // 否则打开新窗口
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// 处理消息事件（来自主线程）
self.addEventListener('message', event => {
  console.log('📨 收到来自主线程的消息:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'SYNC_DATA':
      event.ports[0].postMessage({ status: 'syncing' });
      syncIslandData().then(() => {
        event.ports[0].postMessage({ status: 'complete' });
      }).catch(error => {
        event.ports[0].postMessage({ status: 'error', error: error.message });
      });
      break;
      
    case 'GET_CACHE_STATUS':
      caches.open(CACHE_NAME)
        .then(cache => cache.keys())
        .then(keys => {
          event.ports[0].postMessage({
            status: 'success',
            cacheName: CACHE_NAME,
            cacheSize: keys.length,
            version: CACHE_VERSION
          });
        })
        .catch(error => {
          event.ports[0].postMessage({ status: 'error', error: error.message });
        });
      break;
  }
});

console.log('🚀 小航小刀小岛 Service Worker 已加载');