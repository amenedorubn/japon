# Product

## Register

product

## Users

Tres amigos españoles planificando y viviendo juntos su viaje a Japón del 8 al 28 de abril de 2027. Contexto real: móviles (~390 px) por la noche planificando cada uno desde su casa, y a pie por Japón con una mano ocupada. Ocasionalmente en portátil para sesiones largas de planificación. El trabajo a hacer: decidir entre los tres qué ver cada día, cómo moverse entre sitios, cuánto costará por persona, y tener toda la información del viaje (vuelos, hoteles, reservas) a un toque, compartida entre los tres móviles en tiempo real.

## Product Purpose

Planificador de viaje todo-en-uno de un solo archivo (GitHub Pages + Firebase RTDB compartido). Desde la Fase 10 es LA app del viaje: reemplazó a la "app original" de los viajeros sobre su misma base de datos, con su catálogo fusionado y su itinerario consolidado (los nodos antiguos quedan como archivo de solo lectura, cero riesgo para sus datos). Éxito = los tres la usan de verdad durante el viaje: itinerario editable con horas coherentes, mapa con rutas reales, catálogo de +100 sitios curados con ficha rica, presupuesto automático por persona, sincronización silenciosa entre los tres móviles y funcionamiento completo sin conexión.

## Brand Personality

Sereno, artesanal, fiable. Sensación de app de pago premium: Apple HIG encontrándose con el minimalismo japonés (papel washi, tinta sumi, un rojo torii como único acento). Denso pero calmado: mucha información, cero ruido. El emoji es el lenguaje icónico deliberado de la app (es un cuaderno de viaje personal, no un SaaS).

## Anti-references

- SaaS genérico: gradientes morados, glow de neón, tarjetas idénticas en grid de tres.
- Apps de agencia de viajes: fotos de stock, banners, urgencia comercial.
- Dashboards fríos: esto es un cuaderno de viaje compartido, no un panel de métricas.
- Cualquier cosa que parezca "hecha por una IA": eyebrows en cada sección, em-dashes, decoración sin propósito.

## Design Principles

1. **La herramienta desaparece en la tarea.** Familiaridad ganada (HIG): controles estándar, jerarquía clara, cero afordancias inventadas.
2. **Denso pero calmado.** Toda la información del día cabe en una pantalla de móvil sin sensación de agobio; el espacio y la tipografía ordenan, no las cajas.
3. **El movimiento comunica estado.** Micro-feedback en cada pulsación (<200 ms), transiciones solo donde explican un cambio; nada decorativo, nada en acciones frecuentes.
4. **Un acento, con intención.** El rojo torii marca acción primaria, selección y "hoy"; todo lo demás es papel y tinta.
5. **Los datos de los viajeros son sagrados.** Nada visual puede costar funcionalidad verificada: paridad (PARITY.md) y política de escritura v2 son invariantes.

## Accessibility & Inclusion

WCAG AA como suelo: contraste ≥4.5:1 en texto normal (verificado en claro y oscuro), focus visible en todo control, objetivos táctiles ≥44 px en la barra inferior, `prefers-reduced-motion` respetado en toda animación, hover solo bajo `(hover:hover)`. Ambos temas (claro/oscuro) son ciudadanos de primera.
