// --- INICIO: serviceworker.js (Parte 1 de 2) ---

const CACHE_NAME = 'inventario-pro-cache-v1';
const APP_SHELL_FILES = [
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'logo.png', // Asegúrate de tener tu logo.png en la carpeta
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Evento 'install': Se dispara cuando el Service Worker se instala por primera vez.
self.addEventListener('install', (event) => {
    console.log('Service Worker: Instalando...');
    
    // Esperamos a que la promesa de 'pre-cache' se resuelva.
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Abriendo caché y guardando el App Shell');
                // Agregamos todos los archivos base al caché.
                // Si uno falla, la instalación falla.
                return cache.addAll(APP_SHELL_FILES);
            })
            .then(() => {
                console.log('Service Worker: Instalación completada, App Shell cacheado.');
                // Forzamos al nuevo Service Worker a activarse inmediatamente.
                return self.skipWaiting();
            })
            .catch((err) => {
                console.error('Service Worker: Falló el cacheo del App Shell durante la instalación.', err);
            })
    );
});
// --- INICIO: serviceworker.js (Parte 2 de 2) ---

// Evento 'activate': Se dispara después de 'install' y cuando el SW toma control.
// Es el lugar ideal para limpiar cachés antiguos.
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activando...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Si el nombre del caché no es el actual, se borra.
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Borrando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activado y cachés limpios.');
            // Le dice al SW que tome control de la página inmediatamente.
            return self.clients.claim();
        })
    );
});

// Evento 'fetch': Se dispara CADA VEZ que la página hace una petición de red 
// (pedir un JS, CSS, una imagen, un fetch a una API, etc.)
self.addEventListener('fetch', (event) => {
    
    // Estrategia: "Cache First" para el App Shell y "Network Falling Back to Cache" para lo demás.
    
    const requestUrl = new URL(event.request.url);

    // Solo nos interesan las peticiones GET.
    if (event.request.method !== 'GET') {
        return;
    }

    // Estrategia: Cache First (para nuestro App Shell)
    // Si la URL es parte de nuestro App Shell (archivos locales), busca en el caché primero.
    if (APP_SHELL_FILES.includes(requestUrl.pathname) || APP_SHELL_FILES.includes(requestUrl.href)) {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Si lo encontramos en el caché, lo devolvemos.
                    if (response) {
                        return response;
                    }
                    // Si no, intentamos buscarlo en la red (esto es un respaldo por si algo faltó).
                    return fetch(event.request);
                })
        );
        return; // Salimos de la función aquí.
    }

    // Estrategia: Network Falling Back to Cache (para recursos CDN como fuentes, scripts, etc.)
    // Esta estrategia es buena para recursos que cambian poco pero que no son críticos para el arranque.
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            // 1. Intentamos ir a la red primero.
            return fetch(event.request)
                .then((networkResponse) => {
                    // Si la respuesta es buena, la guardamos en caché y la devolvemos.
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                })
                .catch(() => {
                    // 2. Si la red falla (estamos offline), buscamos en el caché.
                    console.log('Service Worker: Red fallida, buscando en caché:', event.request.url);
                    return cache.match(event.request);
                });
        })
    );
});