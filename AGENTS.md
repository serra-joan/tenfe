# AGENTS.md

## Gestor de paquetes

**Usar siempre `pnpm`**. No usar `npm`, `yarn` ni ningún otro gestor.

```sh
pnpm install        # instalar dependencias
pnpm add <pkg>      # añadir un paquete
pnpm remove <pkg>   # eliminar un paquete
```

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

### Formato general
- Los bloques de encabezados de seguridad (`BASE_HEADERS`) se definen a nivel de módulo, no dentro de cada handler
- Los comentarios solo cuando aportan contexto que el código no expresa por sí solo
