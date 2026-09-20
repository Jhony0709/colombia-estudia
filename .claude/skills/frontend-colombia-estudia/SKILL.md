---
name: frontend-colombia-estudia
description: Construir o cambiar una pantalla de Colombia Estudia, de principio a fin. Usar ANTES de escribir un componente, colocar una frontera cliente/servidor, animar algo o dar por terminada una pantalla. Destila lo aprovechable de skills externas (Vercel React, Emil Kowalski, Anthropic frontend-design) traducido a nuestros tokens y a nuestra arquitectura; enruta al contrato que manda en cada caso.
---

# Frontend Colombia Estudia

**Precedencia, igual que en las otras dos skills**: `reference/03-ui/tokens.md`,
`reference/03-ui/accesibilidad.md`, `reference/03-ui/layout-y-componentes.md`, `DESIGN.md` y
`plan/11-ux.md` ganan sobre esta skill; esta skill gana sobre cualquier skill externa o
default de modelo.

**Esta skill no es una cuarta voz: es la puerta.** No repite lo que ya está escrito, lo
enruta. Lo único propio es lo que ninguno de los tres documentos cubría: dónde va la frontera
cliente/servidor, cómo se elige la duración de una animación dentro de la escala, y cómo se
detecta una pantalla que parece generada.

| Momento                                       | Dónde manda                 |
| --------------------------------------------- | --------------------------- |
| Qué forma tiene la pantalla, qué componente   | `layout-y-componentes.md`   |
| Qué valor usar                                | `tokens.md`                 |
| Qué se anima y cómo                           | `motion-colombia-estudia`   |
| Barrido antes de cerrar (`/audit-ui`)         | `ui-craft-colombia-estudia` |
| Frontera cliente/servidor, coste, autocrítica | **aquí**                    |

---

## 1. La frontera cliente/servidor

Destilado de `vercel/react-best-practices`, atado a nuestra arquitectura. Es lo que más caro
nos ha salido: los tres incidentes de abajo pasaron de verdad.

### F1 — `'use client'` lo más abajo posible, nunca en una página

Una pantalla de staff es un Server Component que lee de la base al renderizar. Se marca
cliente **la hoja que necesita estado o un hook del navegador**, no su contenedor.

`SideNav` es cliente por una sola razón, `usePathname`; y esa razón está escrita en su
cabecera. Si no puedes escribir esa frase en una línea, el componente no debería ser cliente.

**Detección**: `rg -n "'use client'" apps/web/app --type tsx` — cada acierto en un `page.tsx`
o `layout.tsx` es un hallazgo.

### F2 — `server-only` no cruza la frontera, ni siquiera un valor

Importar **cualquier cosa** de un módulo con `import 'server-only'` desde un componente
cliente envenena el bundle y revienta la ruta entera en ejecución, no en compilación.

Ocurrió el 18/9: `person-roles.tsx` (cliente) importaba la constante `ROLES` de
`people.service.ts`; `/personas/[personId]` devolvía 500 siempre. El arreglo no fue quitar
`server-only`: fue mover los catálogos a `lib/people/catalogs.ts`, que no sabe de servidor.

**Regla**: un dato que los dos lados necesitan vive en `lib/`, nunca en `features/*/server/`.
Lo vigila `lint:arch` (`features-no-cruzan-server`); si `lint:arch` calla y aun así lo
sospechas, míralo a mano.

### F3 — Lo que cruza la frontera se paga en bytes

Lo que un Server Component pasa como props a uno cliente se serializa y viaja. Pasar la fila
entera cuando el componente usa tres campos manda el resto al navegador, incluido lo que no
debería salir nunca del servidor.

**Caso nuestro**: `answerKey`. La clave de respuestas jamás viaja con el examen; el editor la
pide por su ruta con `no-store` (`layout-y-componentes.md`, `endpoints.md:61`). Esa regla es
de seguridad, pero el criterio —manda lo mínimo— vale para todo.

### F4 — Fechas: formatear en el servidor y bajar texto

`Intl` no produce la misma cadena en Node y en el navegador, y eso rompe la hidratación con
un error que no se parece a un problema de fechas.

Ocurrió el 18/9 en `personas/[personId]`. El arreglo está anotado en `page.tsx`: se formatea
en el servidor y baja como texto. `lib/i18n/request.ts` fija `timeZone: 'America/Bogota'`.

### F5 — Nada accesorio puede tumbar una petición que ya cumplió

Un log, una invalidación de caché o una métrica **no** pueden convertir un 200 en un 500.

Ocurrió dos veces el 18/9: `revalidatePath` lanzando dentro del `try` de `api-handler` —la
escritura ya estaba guardada y el usuario veía un error, así que reintentaba y creaba la cosa
dos veces— y el logger de `pino` con su hilo muerto tras una recarga en caliente. Los dos se
arreglaron igual: `try/catch` en el sitio accesorio y aviso en el registro.

**Al añadir un efecto después del handler, pregúntate**: si esto lanza, ¿qué ve quien ya
guardó?

### F6 — Importa directo, no por el barril

`import { X } from '@/components'` arrastra todo el índice. Importa del módulo concreto. Lo
pesado y opcional, con `next/dynamic`.

---

## 2. Movimiento: elegir dentro de la escala

`motion-colombia-estudia` dice **qué** se anima y qué está prohibido. Lo que no decía es
**cuál de los cuatro tokens** toca. Destilado de `emil-design-eng` y convertido a tokens:
aquí no se escribe un `ms` ni una curva, nunca.

| Qué se mueve                               | Token              |
| ------------------------------------------ | ------------------ |
| Respuesta a una pulsación, foco, `hover`   | `duration.fast`    |
| Tooltip, popover pequeño, menú (`Menu`)    | `duration.fast`    |
| Diálogo, cajón (`SideNav` en móvil), sheet | `duration.normal`  |
| Acción repetida por teclado                | `duration.instant` |
| Celebración de cohorte completada, una vez | `duration.slow`    |

**Convergencia que vale la pena anotar**: Emil fija como regla dura que una animación de
interfaz no pase de 300 ms. Nuestro `duration.slow` son 500 ms, y la doctrina ya lo reservaba
para una sola celebración. Dos criterios independientes llegan al mismo sitio; `slow` fuera de
esa celebración es un error, no una preferencia.

### M1 — El origen de un popover es su disparador

`transform-origin` desde el disparador, no desde el centro. Un menú que crece desde su propio
centro parece aparecido de la nada; creciendo desde el botón que lo abrió, parece causado por
él. Los diálogos sí crecen centrados.

### M2 — Lo que se repite con el teclado no se anima

Una acción que alguien ejecuta cien veces al día —recorrer una lista, avanzar de pregunta— va
en `duration.instant`. La animación que encanta la primera vez estorba la vigésima.

### M3 — `easing.exit` es acelerada a propósito; no la «arregles»

Emil dice «nunca `ease-in` en interfaz», y nuestro `easing.exit` es una curva acelerada. **No
es una contradicción**: su regla habla de _entradas_, donde arrancar despacio se siente
pesado. Para salidas, acelerar es lo correcto y es lo que hacen los sistemas serios. Queda
escrito aquí para que nadie lo «corrija» dentro de seis meses.

### M4 — Escalonar necesita un token que no existe

Escalonar la entrada de una lista pide un retardo entre elementos, y **no tenemos token para
eso**. Hasta que el contrato lo tenga: no se escalona. Un literal de 40 ms es exactamente lo
que la regla 1 de la doctrina prohíbe.

---

## 3. Autocrítica antes de cerrar

`ui-craft` tiene el barrido `/audit-ui`, que se corre **después**. Esto es lo de **antes**:
cinco patrones que delatan una pantalla generada por un modelo. Destilado de
`anthropics/frontend-design`, con lo que aporta de verdad: cada tic traducido a **qué regla
nuestra incumple**, para que sea comprobable en vez de opinable.

| Tic                                                                                                           | Qué incumple aquí                                                                          |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Fondo crema con serif de display y acento terracota                                                           | AP1: la paleta es `surface.*` y `accent.base`; no hay crema ni terracota                   |
| Negro casi puro con un único acento ácido                                                                     | AP1 y AP4: el acento señala acción principal, foco y activo; no decora                     |
| Todo troceado en cards idénticas, un solo radio, la misma sombra gris                                         | §3 y §4: cuatro radios con rol, `elevation-none` en lo que no flota, filas para listas     |
| Degradados como decoración                                                                                    | AP11 y §9.14: si quitas el color, la pantalla se tiene que seguir entendiendo              |
| Etiqueta en VERSALITAS sobre cada título, metadatos unidos con `·`, flecha `→` pegada al texto de cada enlace | AP2 y AP7: `type-overline` tiene su sitio y su uso; el texto vive en `messages/es-CO.json` |

### Las tres preguntas

1. **¿Se entiende sin color?** Si la jerarquía depende del color, la dan mal el encabezado y
   el espacio (`§9.14`). Es la comprobación más barata y la que más arrastra.
2. **¿Cada nivel visual responde a una diferencia funcional?** Una superficie o un borde que
   está «para que se vea separado» sobra (`§3`).
3. **¿Esto impresiona o esto no confunde?** `plan/11-ux.md:7` no pide una pantalla bonita:
   pide una que no pierda nada y funcione con una mano, para un adulto en un celular de gama
   media y a veces con lector de pantalla. Si una decisión solo se defiende por estética, no
   se defiende.

### Longitud de línea

Menos de 80 caracteres de texto corrido. Ya es `size.readingWidth` (68ch) y se aplica con
`max-w-reading` allí donde se lee. Un párrafo a todo lo ancho del marco es un hallazgo.

---

## Checklist

- [ ] ¿Hay algún `'use client'` en un `page.tsx` o un `layout.tsx`?
- [ ] ¿Algún componente cliente importa de `features/*/server/`?
- [ ] ¿Las props que cruzan son las que el componente usa, y nada más?
- [ ] ¿Alguna fecha se formatea en el cliente?
- [ ] Lo accesorio que añadí después del handler: si lanza, ¿rompe la petición?
- [ ] ¿Duración y easing salen de la tabla de arriba, sin un solo literal?
- [ ] ¿El popover crece desde su disparador?
- [ ] ¿Pasa las tres preguntas de la §3?
- [ ] ¿Corrí `/audit-ui` de `ui-craft-colombia-estudia`?

## Procedencia

Lo de fuera que se conservó, y por qué se conservó solo eso:

- **`vercel/react-best-practices`** → §1. Es el único hueco real que tenían los contratos:
  hablaban de artesanía visual, accesibilidad, tokens y movimiento, y de React nada.
- **`emilkowalski/emil-design-eng`** → §2. Se tomaron tres reglas y la tabla de duraciones,
  **traducidas a tokens**. Sus `cubic-bezier` y sus milisegundos literales quedan fuera: la
  regla 1 de `motion-colombia-estudia` los prohíbe.
- **`anthropics/frontend-design`** → §3. Solo su catálogo de tics. Su objetivo declarado —que
  un diseño no parezca plantilla— empuja en dirección contraria a `plan/11-ux.md:7`.
- **Descartadas enteras**: `ui-ux-pro-max` (genera un sistema de diseño que competiría con el
  contrato), `huashu-design` (entregables comerciales, no UI de producto),
  `vercel/web-design-guidelines` (no contiene reglas: las descarga de una URL remota en cada
  revisión, sobre un repo donde los contratos están versionados a propósito).
