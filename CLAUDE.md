# CLAUDE.md — Proyecto Japón 2027

## 🎯 Propósito

Guía de comportamiento para Claude Code. Define patrones, restricciones y decisiones
arquitectónicas de este proyecto para evitar over-engineering, inconsistencias y sorpresas.

**La referencia canónica completa es `PROJECT.md` — léelo SIEMPRE antes de tocar código.**
Este archivo es solo el resumen de comportamiento; si algo contradice a PROJECT.md, gana PROJECT.md.

> Nota histórica: la primera versión de este archivo (16-jul-2026) describía por error un stack
> TypeScript/Node/SQL con `src/models`, `src/repositories` y Jest. Nada de eso existe ni existió
> en este repo. Corregido el 19-jul-2026.

## 📋 Stack real

- **App:** UNA página (`index.html`, ~5.6k líneas: HTML + CSS + JS vanilla). Sin framework,
  sin build, sin TypeScript, sin dependencias de runtime. Leaflet 1.9 por CDN.
- **Offline:** `sw.js` (service worker cache-first).
- **Publicación:** GitHub Pages. **Sync:** Firebase RTDB compartida entre los 3 móviles.
- **Tests:** `node tests/run-all.js` (Node ≥18, sin frameworks de test).
- **Dev-time:** importadores en `tools/` (Node puro; Playwright SOLO para el de María).

## 🏗️ Estructura real de directorios

```
japon/
├── index.html               LA app entera (datos horneados entre marcadores)
├── sw.js                    Service worker offline
├── index-pre-source.html    App original, referencia SOLO LECTURA (no borrar)
├── tools/                   Importadores dev-time (import→bake→seed)
├── import/                  Datos extraídos que se hornean en index.html
├── tests/                   Suite de regresión + run-all.js
├── design/                  Sistema de diseño modular (+ DIRECTION.md, DESIGN.md)
├── Itinerario.docx          Fuente de la procedencia "ours"
├── JAPON-DEFINITIVO-Dani.pdf  Fuente de los lugares de Dani
└── PROJECT.md · PRODUCT.md · PARITY.md · CLAUDE.md
```

## ✅ Patrones que USAMOS (respétalos)

- **Single-file**: toda la app vive en `index.html`. Los datos de fuentes externas NO se
  escriben a mano: los hornean los importadores de `tools/` entre marcadores.
- **Render por secciones**: funciones `renderX()` que reconstruyen `innerHTML`; handlers con
  `addEventListener` tras cada render (cero `onclick` inline, cerrado en Fase 11).
- **Comentarios en español** que explican el PORQUÉ (decisiones, invariantes), no el qué.
- **Ejes separados**: procedencia (historia, inmutable) ≠ estado (planificado/confirmado) ≠
  zona (derivada de coordenadas, nunca persistida). No mezclarlos.
- **Tests contra el código real**: `run-all.js` extrae el JS de `index.html` y lo ejecuta con
  stubs de DOM/Leaflet. Los tests dependen del contrato del DOM (ids, clases-gancho, `data-pid`).

## ❌ NUNCA hagas esto

- **No añadas frameworks, build steps ni dependencias de runtime.** La app es un archivo.
- **No escribas en Firebase fuera de los 3 `fb.set`** (`pushRemote`/`pushPlaces`/`pushTitle`):
  la política v2-only de PROJECT.md §5 es el invariante nº 1. Jamás `state/days`/`state/transfers`.
- **No renombres** ids canónicos de lugares, tokens CSS, ni claves compartidas de localStorage.
- **No toques plantillas sin actualizar `tests/` en el MISMO commit** (suite en verde siempre).
- **No borres** `index-pre-source.html` ni los nodos de archivo de la nube.
- **No dejes TODOs o FIXMEs sin contexto.**
- **No re-implementes lo descartado** (PROJECT.md §8: presupuesto, días variables, IA de 5
  pestañas Hoy/Plan/Ideas/Mapa/Guía rechazada el 19-jul-2026, etc.) sin decisión del usuario.

## 🔄 Cuando tengas dudas, PREGUNTA

Antes de proceder, pregunta si:

1. Necesito añadir una dependencia (aunque sea dev-time) o un fichero nuevo de primer nivel.
2. El cambio toca la política de Firebase, el modelo de datos persistido o el esquema compartido.
3. Voy a cambiar patrones o convenciones ya establecidas (o algo listado en PROJECT.md §12).
4. La solución cubre un caso edge que el usuario no mencionó explícitamente.

**Regla de oro**: es mejor frenar y preguntar que generar código que luego haya que rehacer.

## 📝 Estándares de código

- **Naming**: `camelCase` funciones/variables, `MAYUS_SNAKE` para constantes de datos horneados.
- **Líneas**: máximo ~100 caracteres. Identación 2 espacios.
- **Comentarios**: solo el porqué; sin em-dashes en comentarios (los `–` de datos/copy sí).
- **Commits**: verbo presente, uno por fase, mensaje descriptivo; suite verde antes de commitear.
- **Verificación**: `node tests/run-all.js` + smoke HTTP con `.claude/serve.ps1` antes de cada commit.

## 🚀 Estado actual

- **Fase 12** (EN CURSO): procedencia, importadores (F1–F3b), pestaña Itinerarios; última
  materialización **12.57** (la Ruta 21 días: quinto itinerario + catálogo v11 + docx descargable).
- Pestañas vigentes: Ideas · Itinerarios (Realidad · Ruta · Propuesta · Dani · María) ·
  Confirmado · Hoteles · Guía.
- Decisiones del 19-jul-2026: propuesta de 5 pestañas RECHAZADA; el reparto de alojamientos
  del 12 al 25 de abril está SIN DECIDIR (ver PROJECT.md §9).

Historia completa de fases, invariantes y supuestos: `PROJECT.md` §7, §12 y §13.

---

**Última actualización:** 19 de julio de 2026
**Mantenedor:** amenedorubn
**Sincronización:** Archivado en Git. Actualizar cuando cambien decisiones arquitectónicas.

---

## Cómo usar este archivo

1. Claude Code lo lee automáticamente al abrir el repo.
2. Si algo no está claro, Claude preguntará antes de proceder.
3. Actualiza este archivo cada vez que tomes una nueva decisión arquitectónica.
4. Commit y push después de cambios. El historial en Git es tu audit trail.
