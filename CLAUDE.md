# CLAUDE.md — Proyecto Japón 2027

## 🎯 Propósito

Guía de comportamiento para Claude Code. Define patrones, restricciones y decisiones arquitectónicas de este proyecto para evitar over-engineering, inconsistencias y sorpresas.

## 📋 Stack actual

- **Lenguaje:** TypeScript
- **Runtime:** Node.js
- **Frameworks:** Ninguno (procedural, lo más simple posible)
- **Database:** SQL puro (PostgreSQL o SQLite)
- **Testing:** Jest o Vitest
- **Package Manager:** npm

## 🏗️ Estructura de directorios

```
JAPAN/
├── src/
│   ├── models/        Data structures y tipos
│   ├── services/      Lógica de negocio
│   ├── repositories/  Acceso a datos (queries)
│   ├── utils/         Helpers reutilizables
│   └── index.ts       Entry point
├── tests/
│   └── *.test.ts      Tests colocalizados
├── docs/
├── .env.example
├── package.json
└── CLAUDE.md          Este archivo
```

## ✅ Patrones que USAMOS (respétalos)

- **Async/await obligatorio**: Todo es async. Sin callbacks, sin Promises encadenadas.
- **Tipado fuerte**: TypeScript con `strict: true` en tsconfig.json. Tipos explícitos siempre.
- **SQL crudo**: No ORM. Queries escritas a mano en funciones en `src/repositories/`.
- **Funciones puras cuando sea posible**: Input → Output. Sin efectos secundarios innecesarios.
- **Errores tipados**: Custom error classes, no strings de error.
- **Models en `src/models/`**: Una interfaz o clase por dominio (User, Project, etc).
- **Tests junto al código**: Archivo.ts y archivo.test.ts en el mismo directorio.
- **Nombres descriptivos**: 3-4 palabras, explícitos. `getUserById` no `get_user`.

## ❌ NUNCA hagas esto

- **No agregues ORMs** (Prisma, TypeORM, Sequelize, etc) sin preguntar primero.
- **No crees carpetas genéricas** tipo `utils/`, `helpers/`, `common/`. Si necesita existir, es código de negocio → obtiene nombre específico.
- **No cambies la estructura de directorios** sin confirmar primero.
- **No importes librerías grandes** para tareas simples. Una función en `utils/` es mejor que una dependencia.
- **No comprimas código** para ahorrar líneas. Readability > densidad.
- **No uses `any`** en TypeScript. Si no puedes tiparlo, pregunta.
- **No dejes TODOs o FIXMEs sin contexto**. Si va a implementarse después, crea una tarea.
- **No agregues dependencias nuevas** sin preguntar. Cada nueva dep = más mantenimiento.

## 🔄 Cuando tengas dudas, PREGUNTA

Antes de proceder, pregunta si:

1. Necesito agregar una dependencia nueva (npm install X)
2. Necesito crear un archivo en una carpeta que no existe aún
3. Esto requiere reescribir más de 3 archivos existentes
4. Voy a cambiar patrones o convenciones ya establecidas
5. La solución cubre un caso edge que no mencionaste explícitamente

**Regla de oro**: Es mejor frenar y preguntar que generar código que luego haya que rehacer.

## 📝 Estándares de código

- **Naming**: `camelCase` para variables y funciones, `PascalCase` para tipos e interfaces.
- **Líneas**: Máximo 100 caracteres. Mejor romper que apilar.
- **Comentarios**: Solo el "por qué". El "qué" debe ser obvio del código.
- **Testing**: Mínimo 1 test por función crítica o endpoint.
- **Commits**: Verbo presente. "Add feature X" no "Added feature X".
- **Formato**: Prettier o similar. Identación 2 espacios.

## 🚀 Fases próximas conocidas

- **Phase 12.51** (actual): Consolidación de features previas
- **Phase 12.52**: [especificar cuando se defina]
- **Phase 13**: [especificar cuando se defina]

Ver `proyecto-japon-2027.md` en Obsidian para contexto completo.

---

**Última actualización:** 16 de julio de 2026  
**Mantenedor:** amenedorubn  
**Sincronización:** Archivado en Git. Actualizar cuando cambien decisiones arquitectónicas.

---

## Cómo usar este archivo

1. Claude Code lo lee automáticamente al abrir el repo.
2. Si algo no está claro, Claude preguntará antes de proceder.
3. Actualiza este archivo cada vez que tomes una nueva decisión arquitectónica.
4. Commit y push después de cambios. El historial en Git es tu audit trail.
