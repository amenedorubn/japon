# Product

## Register

product

## Users

Tres amigos españoles planificando y viviendo juntos su viaje a Japón del 8 al 28 de abril de 2027. Contexto real: móviles (~390 px) por la noche planificando cada uno desde su casa, y a pie por Japón con una mano ocupada. Ocasionalmente en portátil para sesiones largas de planificación. El trabajo a hacer: decidir entre los tres qué ver cada día, cómo moverse entre sitios, cuánto costará por persona, y tener toda la información del viaje (vuelos, hoteles, reservas) a un toque, compartida entre los tres móviles en tiempo real.

## Product Purpose

Planificador de viaje todo-en-uno de un solo archivo (GitHub Pages + Firebase RTDB compartido). Desde la Fase 10 es LA app del viaje: reemplazó a la "app original" de los viajeros sobre su misma base de datos, con su catálogo fusionado y su itinerario consolidado (los nodos antiguos quedan como archivo de solo lectura, cero riesgo para sus datos). Éxito = los tres la usan de verdad durante el viaje: itinerario editable con horas coherentes, mapa con rutas reales, catálogo de +100 sitios curados con ficha rica, sincronización silenciosa entre los tres móviles y funcionamiento completo sin conexión. (El presupuesto se ELIMINÓ del producto en 12.47; los precios de la ficha de un sitio son datos informativos del catálogo.)

La **fuente de verdad de la planificación** son los documentos compartidos de Google Drive de los tres viajeros. La app va por detrás y se pone al día a mano, sin importador: su trabajo es hacer esa entrada agradable. El itinerario que vino sembrado durante el desarrollo NO es el viaje real: es una propuesta de exploración que se muestra hasta que el plan real la reemplaza día a día, y nunca se presenta como definitiva.

## Visión a largo plazo: de planificador a compañero de viaje

La app está evolucionando de ser solo un planificador de itinerario a un **compañero de viaje** con tres capas mentales claramente separadas. Es la estrella polar del producto: **toda funcionalidad futura debe encajar de forma natural en una de estas tres capas.**

- **✈️ Confirmado.** Vuelos, hoteles reservados y cualquier información que ya está fija.
- **🗓️ Planificación.** El itinerario día a día que estamos construyendo activamente.
- **🧭 Exploración.** Lugares que podrían llegar a formar parte del viaje (Exploración/`ai`, Dani, Instagram o cualquier otra fuente).

No es una petición de rediseño ahora: es la filosofía de producto a largo plazo que guía cada iteración. Antes de añadir una función, la pregunta es "¿a qué capa pertenece?". Si no encaja limpiamente en una de las tres, probablemente aún no pertenece al producto.

## Dirección de rediseño (antes de la Fase 12)

El rediseño visual de la Fase 9 se considera **demasiado conservador**: la app todavía se parece a una versión limpia de la app original. Antes de implementar la Fase 12 haremos una iteración DEDICADA de rediseño de producto/UX con las cuatro Skills de diseño (animation-vocabulary, design-taste-frontend, emil-design-eng, impeccable), con el mandato de **retar la interfaz, no pulirla**: jerarquía e información, modelo de interacción, animación con propósito, estados de **día vacío** y **día completado** (deliberadamente sin definir: los diseña la Skill), transiciones y divulgación progresiva. Objetivo: que se sienta como un producto de viaje premium moderno, no como el rediseño anterior.

## Procedencia y separación conceptual

Dos ejes independientes gobiernan cada lugar del viaje.

**Procedencia (estable, histórica).** De dónde salió un lugar. Cinco valores fijos que NO cambian nunca:
- **Nuestros** (`ours`): **los lugares de Itinerario.docx, nuestro documento curado** (corrección 12.48; NO se define por "añadido a mano"). Un hotel con reserva confirmada también es nuestro.
- **Dani** (`dani`): recomendaciones de Dani.
- **María** (`maria`): las listas de Google Maps que curó María.
- **Instagram** (`instagram`): inspiración guardada.
- **IA** (`ai`): todo lo demás — ideas generadas durante el desarrollo de la app y añadidos sin otra procedencia. No son recomendaciones ni forman parte del viaje real hasta que decidimos incluirlas. (Ojo: **Exploración** es el nombre de una CAPA, no la etiqueta de esta procedencia.)

La procedencia es historia: adoptar o planificar un lugar no la cambia. Un lugar de Dani sigue siendo de Dani; uno de IA sigue siendo de IA. Lo que cambia es si decidimos incluirlo en el viaje, no de dónde vino.

**Estado / capa (dinámico, eje aparte).** Qué hacemos con un lugar y cómo de avanzado está: **planificado** (está en el itinerario) y **confirmado** (marcado a propósito como cierto). Deliberadamente NO añadimos favourite / visited / want todavía: el modelo se mantiene mínimo y ampliable.

**Tres modelos mentales, siempre visualmente separados:**
- **Confirmado**: hoy SOLO vuelos y los dos hoteles reservados. Información cierta. Confirmar es una ACCIÓN DELIBERADA (marcamos algo como confirmado al editarlo); nada llega a Confirmado por sí solo. Los hoteles se tratan como los vuelos: hechos, no lugares normales.
- **Planificación**: el itinerario que decidimos los tres, procedente de nuestros documentos de Google Drive. La app se pone al día a mano. Nada aquí está necesariamente confirmado.
- **Exploración**: lo de IA (`ai`), Dani e Instagram, mientras no lo programemos a propósito.

El itinerario sembrado en desarrollo YA NO vive dentro del plan (corrección 12.49): se retiró de una vez y existe solo como la referencia **"Propuesta"** (solo lectura), desde la que cada parada se puede plantar a propósito en nuestro viaje con ＋. Toda parada del plan es una decisión; los días sin decidir son invitaciones (Washi), nunca propuesta disfrazada de plan.

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
6. **Confirmado, planificación y exploración no se mezclan.** Cada cosa se muestra en su registro: lo confirmado (vuelos, hoteles reservados) transmite certeza; la planificación es editable y nuestra; la exploración recede (sin acento, claramente "todavía no es el viaje"). La procedencia de un lugar es historia estable y se distingue de si lo hemos incluido en el plan.
7. **Los precios no dominan.** El presupuesto salió del producto (12.47). Los únicos precios visibles son datos informativos de la ficha de un sitio o de una opción de transporte, nunca sumatorios ni costes ambientales.

## Accessibility & Inclusion

WCAG AA como suelo: contraste ≥4.5:1 en texto normal (verificado en claro y oscuro), focus visible en todo control, objetivos táctiles ≥44 px en la barra inferior, `prefers-reduced-motion` respetado en toda animación, hover solo bajo `(hover:hover)`. Ambos temas (claro/oscuro) son ciudadanos de primera.
