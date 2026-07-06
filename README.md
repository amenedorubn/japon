# 🇯🇵 Japón 2027 · Planificador de viaje

Web/app de planificación del viaje a Japón (8–28 de abril de 2027). Todo en un único `index.html`, sin dependencias que instalar: lista para GitHub Pages.

## ✨ Qué hace

- **Cuenta atrás** en vivo hasta el despegue (y modo "día N del viaje" cuando estéis allí).
- **Itinerario de 21 días** con paradas ordenadas: hora y duración **editables**, notas, marcar visitado, añadir/quitar/reordenar paradas.
- **Trayectos entre sitios** con alternativas reales de transporte (metro, JR, shinkansen, bus, ferry, a pie): líneas y conexiones, duración y precio por persona, todo editable. Botones que abren Google Maps ya configurado en modo transporte público o a pie.
- **Mapa por días** (Leaflet + OpenStreetMap) con rutas que siguen **calles reales** (motor OSRM), no líneas rectas ni curvas decorativas. El tiempo del trayecto a pie se calcula automáticamente con la ruta real.
- **Catálogo de +100 sitios** con ficha: qué es, consejo, precio de entrada, horario, web oficial, Google Maps y vuestros reels de Instagram guardados.
- **Presupuesto automático** de entradas y transporte (¥ y €), por día y total.
- **Guía**: checklist de preparativos con progreso, consejos y frases útiles.
- **Sincronización opcional en la nube** (☁️): el plan se comparte entre los móviles de los viajeros usando la misma base de Firebase del proyecto anterior. También funciona 100 % sin conexión (se guarda en el dispositivo) y hay exportar/importar JSON como copia de seguridad.

## 🚀 Publicar en GitHub Pages

1. Crea un repositorio (por ejemplo `japon-2027`).
2. Sube `index.html` (y este `README.md`).
3. En el repositorio: **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
4. En un minuto tendrás la web en `https://TU_USUARIO.github.io/japon-2027/`.

En el móvil: abre la web y "Añadir a pantalla de inicio" para usarla como app.

## 🔧 Notas técnicas

- Un solo archivo HTML con CSS y JS vanilla. Leaflet 1.9 por CDN, tiles de CARTO/OSM y rutas del servidor público OSRM de FOSSGIS (con caché local para no repetir peticiones).
- Los datos editados se guardan en `localStorage` y, con la nube activada, en Firebase Realtime Database (ruta `proyectos/japon27-app-v2`, separada de la web antigua).
- "Restablecer plan sugerido" (pestaña Guía) vuelve al itinerario original sin tocar la web antigua.
