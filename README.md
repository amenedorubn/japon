# 🇯🇵 Japón 2027 · Planificador de viaje

Web/app de planificación del viaje a Japón (8–28 de abril de 2027). Todo en un único `index.html`, sin dependencias que instalar: lista para GitHub Pages.

## ✨ Qué hace

- **Cuenta atrás** en vivo hasta el despegue (y modo "día N del viaje" cuando estéis allí).
- **Itinerario de 21 días** con paradas ordenadas: hora y duración **editables**, notas, marcar visitado, añadir/quitar/reordenar paradas.
- **Trayectos entre sitios** con alternativas reales de transporte (metro, JR, shinkansen, bus, ferry, a pie): líneas y conexiones, duración y precio por persona, todo editable. Botones que abren Google Maps ya configurado en modo transporte público o a pie.
- **Mapa por días** (Leaflet + OpenStreetMap) con rutas que siguen **calles reales** (motor OSRM), no líneas rectas ni curvas decorativas. El tiempo del trayecto a pie se calcula automáticamente con la ruta real.
- **Catálogo de +100 sitios** con ficha: qué es, consejo, precio de entrada, horario, web oficial, Google Maps y vuestros reels de Instagram guardados.
- **Guía**: checklist de preparativos con progreso, consejos y frases útiles.
- **Sincronización opcional en la nube** (☁️): el plan se comparte entre los móviles de los tres viajeros usando la misma base de Firebase del proyecto anterior. Hay exportar/importar JSON como copia de seguridad (las copias antiguas, también las de la app original, se siguen pudiendo importar).
- **Funciona sin conexión de verdad**: un service worker (`sw.js`) guarda la app, el PDF y las librerías en el dispositivo. Abierta una vez con red, después funciona entera sin cobertura por Japón; al recuperar la conexión se actualiza sola para la siguiente apertura.

## 🚀 Publicar en GitHub Pages

1. Crea un repositorio (por ejemplo `japon-2027`).
2. Sube `index.html`, `sw.js` (la app sin conexión), `JAPON-DEFINITIVO-Dani.pdf` (el documento que abre la vista "Ruta Dani") y este `README.md`.
3. En el repositorio: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
4. En un minuto tendrás la web en `https://TU_USUARIO.github.io/japon-2027/`.

En el móvil: abre la web y "Añadir a pantalla de inicio" para usarla como app.

## 🔧 Notas técnicas

- Un solo archivo HTML con CSS y JS vanilla (más `sw.js`, el service worker de la caché offline). Leaflet 1.9 por CDN, tiles de CARTO/OSM y rutas del servidor público OSRM de FOSSGIS (con caché local para no repetir peticiones).
- Los datos editados se guardan en `localStorage` y, con la nube activada, en Firebase Realtime Database (ruta compartida `proyectos/viaje-japon`, la misma que la app original; esta app solo escribe `state/v2`, `tripTitle` y `state/places`).
- Documentación del proyecto: `PROJECT.md` (referencia canónica), `PRODUCT.md` / `DESIGN.md` (producto y sistema visual), `PARITY.md` (paridad con la app original), `tests/run-all.js` (suite de regresión).
- "Vaciar el plan" (pestaña Guía) deja los 21 días sin paradas (vuelos, hoteles y catálogo se conservan). La propuesta de itinerario generada en desarrollo vive como referencia "Propuesta" dentro de la pestaña Plan, plantable parada a parada.
