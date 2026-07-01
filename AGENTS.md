# AGENTS.md

---

## Dependencias

- No usar nunca `^` ni `~` en las versiones de las dependencias. Fijar siempre versiones exactas.
- Mantener siempre el archivo `pnpm-lock.yaml` en el repositorio. No eliminarlo ni añadirlo a `.gitignore`.
- Los scripts de instalación están deshabilitados. Si una dependencia necesita ejecutar un paso de compilación o instalación, debe aprobarse explícitamente antes.
- Solo se pueden instalar versiones de paquetes publicadas hace al menos 1 día.
- Antes de añadir una nueva dependencia, verificar que existe y es válida en https://npmjs.com.
- Priorizar paquetes bien mantenidos, con publicador verificado y procedencia (provenance) verificada cuando esté disponible.
- Ejecutar siempre `pnpm install` con el `pnpm-lock.yaml` presente. Nunca ignorarlo ni regenerarlo innecesariamente.
- No añadir dependencias desde repositorios Git ni mediante URLs de archivos `.tar.gz` o similares, salvo aprobación explícita.
- No ejecutar `npm update`, `npx npm-check-updates` ni herramientas de actualización masiva. Revisar y actualizar cada dependencia de forma individual.
- Usar siempre `pnpm`**. No usar `npm`, `yarn` ni ningún otro gestor.

---

## Ejecutar el proyecto

```sh
pnpm astro dev        # servidor de desarrollo (http://localhost:4321)
pnpm astro build      # compilar para producción
pnpm astro preview    # previsualizar el build de producción
```

El proyecto usa **Astro 7** con el adaptador de Vercel (`@astrojs/vercel`) y **Tailwind CSS 4** vía plugin de Vite.

---

## Estilo de código

### Punto y coma
Evitar `;` al final de las sentencias. Solo usar cuando sea estrictamente necesario para evitar ambigüedad (p. ej. líneas que empiezan por `[` o `(`).

```ts
// Correcto
const TARGET = 'https://example.com'
let cache: Data | null = null

// Incorrecto
const TARGET = 'https://example.com';
```

### Comillas
Usar comillas simples `'` para strings en TypeScript/JavaScript. En plantillas Astro/HTML usar comillas dobles `"`.
Si dentro del texto hay `'`, no usar `\'`, mejor cambiar todo el string a `"`

```ts
// Correcto
const text = "En Joan vol saber l'hora."

// Correcto en JS y TS
const text = `En Joan vol saber l'hora`

// Incorrecto
const text = 'En Joan vol saber l\'hora'
```

### Variables
- `const` para valores que no cambian
- `let` solo cuando el valor se reasigna más adelante
- Nunca `var`

### Tipos
Tipar siempre en TypeScript. Los tipos viven en `src/types/`. Evitar `any` salvo que sea imprescindible.

### Funciones asíncronas
Usar `async/await` en lugar de cadenas `.then()`.

### Imports
Los alias `@/` apunta a `src/` y `@public/` a `public/`. Usar estos alias en lugar de rutas relativas cuando sea posible.

Todos los alias están disponibles en tsconfig.json.

### Formato general
- Los bloques de encabezados de seguridad (`BASE_HEADERS`) se definen a nivel de módulo, no dentro de cada handler
- Los comentarios solo cuando aportan contexto que el código no expresa por sí solo

---

## Git
No hacer commit o push si no se especifica.
La estructura para el mensage de commit es la siguiente:
- Lista de nuevas funcionalidades, si las hay.
- Lista de cambios realizados, si los hay.
- Si hay modificaciones de archivos o nuevas funciones en archivos ya existentes, resumir que hace los nuevos cambios. Ej: src/pages/api/trains.json.ts: ahora búsca el valor "next_stop".

