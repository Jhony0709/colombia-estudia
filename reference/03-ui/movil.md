# 03 — App móvil

Decisión: `PRODUCT_DECISIONS.md`, «App móvil con Expo y `@fluxus-ui/native`» (27/11). La app es un
cliente más de la API: no decide acceso, progreso ni cartera. Lo que no está aquí no existe en
la app; se escribe aquí antes que en `apps/mobile`.

## Paquetes

| Paquete                  | Qué es                                                                                                                                                                    | Regla                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/mobile`            | La app, con Expo 58 (`expo ~58.1.0`). React, React Native, Reanimated y worklets van en las versiones que fija `expo/bundledNativeModules.json`, no en las últimas de npm | Nueva dependencia, con aprobación (`CLAUDE.md`)                                         |
| `packages/fluxus-native` | Copia de `@fluxus-ui/native` (`~/development/fluxus/packages/native`) mientras no esté en npm: `src/` y un `package.json` sin `devDependencies`                           | **No se edita aquí** (`VENDOR.md`). Lo que falte se pide en Fluxus y se vuelve a copiar |

En el monorepo conviven React 18.3 (web) y el de Expo (app): `apps/mobile/metro.config.js` hace
que React, React Native, Reanimated y worklets se resuelvan siempre desde la app.

Los tipos, igual: el `package.json` raíz fija `@types/react` 18 (el de la web) para que pnpm no
hoistee el 19 y lo tomen los `.d.ts` de `next` y compañía; la app usa el 19 con
`apps/mobile/tsconfig.check.json`, que lo fuerza para todo su programa.

**Navegación:** `expo-router` (rutas en `apps/mobile/app/`). Sin sesión, `app/_layout.tsx` pinta
la pantalla de acceso; con ella, `app/index.tsx` lleva a cada rol a su inicio (`src/roles.ts`).

## Sesión

**Por token desde M0** (Jhonny, 27/11). La app no usa cookies (`credentials: 'omit'`):

- entrar: `POST /api/auth/token` con correo y contraseña → `{ accessToken, refreshToken, expiresAt }`;
- cada pedido: `Authorization: Bearer <accessToken>`, que el servidor valida con Supabase en
  `getSupabaseUser` (`apps/web/lib/auth/supabase-server.ts`); con `Bearer` no mira la cookie, y
  un token que no sirve es anónimo (401);
- renovar: `POST /api/auth/refresh` con el `refreshToken`, un minuto antes de que caduque o ante
  un 401; varios pedidos esperan la misma renovación y se reintentan una vez;
- salir: `POST /api/auth/logout` con `Bearer` revoca esa sesión en Supabase; la app borra sus
  tokens aunque el servidor no responda.

Solo el `refreshToken` queda en el teléfono, en `expo-secure-store` (Keychain en iOS, Keystore
en Android); el `accessToken` vive en memoria, así que al abrir la app lo primero es renovar.
Si la renovación responde 400 o 401, la app olvida la sesión y vuelve a «Sin sesión»; sin red,
la conserva. Una cuenta del equipo con segundo factor obligatorio recibe primero
tokens `aal1` y el `factorId`; con el código, `POST /api/auth/token/mfa` los cambia por un par
`aal2`. Con `aal1` las rutas del equipo responden 403 (`apps/web/lib/authz/request-context.ts`,
`mfaPending`). Si nunca activó el factor, 403: se activa en la web. La sesión dura lo que diga la configuración de sesiones del proyecto de
Supabase; la app no pone otro tope.

**Lo que solo se comprueba en un teléfono:** la sesión sobrevive a cerrar la app; se renueva
sola; «Salir» la borra y ya no sirve en el servidor.

## Pantallas

### M0 — Acceso

Una pantalla, con `Text`, `TextField`, `Button` y `Message` de `@fluxus-ui/native`.

| Estado                           | Qué se ve                                                                                                     | De dónde sale                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Comprobando                      | Nada que leer todavía; el lector oye «Cargando»                                                               | `GET /api/me` al abrir                                               |
| Sin sesión                       | Correo, contraseña, «Entrar» y «¿Olvidaste tu contraseña?» (abre `/auth/recuperar` de la web en el navegador) | Sin tokens guardados, o `GET /api/me` → 401                          |
| Campo vacío o correo sin `@`     | Error bajo el campo, sin llamar al servidor                                                                   | En la app                                                            |
| Enviando                         | «Entrar» ocupado; no admite otra pulsación                                                                    | —                                                                    |
| Correo o contraseña incorrectos  | Aviso de error con el mensaje del servidor                                                                    | 401 `UNAUTHENTICATED` de `POST /api/auth/token`                      |
| Correo que el servidor no acepta | «Revisa el correo y la contraseña»                                                                            | 400 `VALIDATION_ERROR` (Zod)                                         |
| Demasiados intentos              | «Espera unos minutos y vuelve a intentarlo»                                                                   | 429 `RATE_LIMITED` (10 en 10 min, el mismo cupo que el login web)    |
| Sin conexión o servidor caído    | «No pudimos conectar. Revisa tu conexión»                                                                     | Error de red o 5xx                                                   |
| Código del segundo factor        | «Código de verificación» (6 dígitos, el de la app de autenticación) y «Verificar»                             | `POST /api/auth/token` → `{ mfa }`; luego `POST /api/auth/token/mfa` |
| Código incorrecto                | Error bajo el campo                                                                                           | 400 de `POST /api/auth/token/mfa`                                    |
| Segundo factor sin activar       | «Activa el segundo factor en la web», con enlace                                                              | 403 de `POST /api/auth/token`                                        |
| Otro rol                         | «La app es para el equipo y los estudiantes. Usa la web», con enlace; la sesión se cierra                     | `GET /api/me` sin `ADMIN`, `OPERATIONS` ni `STUDENT`                 |
| Sesión iniciada                  | ADMIN u OPERATIONS → «Mensajes» (M1); STUDENT → «Mi ruta» (M2)                                                | `GET /api/me`                                                        |

### M1 — Equipo: Mensajes

Para ADMIN y OPERATIONS (Jhonny, 27/11), lo mismo que `/mensajes` en la web, sin lo que pide
pantalla grande.

| Pantalla         | Qué hace                                                                                                                                                                                                    | Endpoint                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Bandeja          | Pestañas «En espera», «Míos» y «Abiertos»; cada fila con el nombre, el último mensaje y cuánto hace                                                                                                         | `GET /api/conversations?view=waiting\|mine\|open`                                                                       |
| Chat             | Los mensajes, con audio, foto, video y documento; «Tomar chat», responder con texto y «Cerrar»                                                                                                              | `GET /api/conversations/[id]`, `POST …/take`, `POST …/messages`, `POST …/close`                                         |
| Archivo del chat | La URL firmada para el reproductor o el visor                                                                                                                                                               | `GET …/messages/[messageId]/media?as=url`                                                                               |
| Al día           | Con la app en primer plano, cada 5 s; si cambió, vuelve a pedir la bandeja o el chat. Con un chat abierto marca que quien lo atiende lo ve                                                                  | `GET /api/conversations/pulse?id=`                                                                                      |
| Solicitudes      | Lo que piden los estudiantes (como `/solicitudes`): «Abiertas» y «Cerradas»; quién, qué, desde cuándo y lo que hace falta para decidir. «Habilitar», «Dar otra oportunidad» y «Descartar», con confirmación | `GET /api/access-requests?status=`, `PATCH /api/access-requests/[id]`, `PUT /api/cohorts/enrollments/[id]/modules/[id]` |

Con «Hazlo en la web»: plantilla de seguimiento, crear persona, link de pago, botones de
respuesta y citar un mensaje; de las solicitudes, matricular (la hoja de matrícula), habilitar
con fechas y la cartera. **Fuera de M1:** notificaciones push y que el «Abrir chat» del
aviso por WhatsApp abra la app (M4).

### M2 — Estudiante

Reglas de todas las pantallas (Jhonny, 27/11): lo pulsado que llama al servidor devuelve su
promesa y espera solo (`useAsyncPress` de `@fluxus-ui/native`); lo que cambia de contenido pasa por
`Swap`; mientras carga, `Skeleton` con la forma de lo que viene; un error, `Message` con
«Reintentar»; sin conexión, lo mismo con el texto de red, y lo ya cargado se queda a la vista. La
app no decide acceso, progreso ni cartera: pinta lo que dice el servidor.

Navegación: «Mi ruta» es el inicio del estudiante (`app/aprender/index.tsx`) y lleva una lista a
Notificaciones (con las no leídas), Mi cuenta, Calendario y Constancias, todas en la app. Un
`href` del servidor que la app tiene se abre en la app (`apps/mobile/src/links.ts`); el resto, en
el navegador de la app (`src/ui/browser.tsx`); una dirección que no es web (`mailto:`, `tel:`), en
el sistema. Lo pulsado espera mientras el navegador está abierto y, si no se pudo abrir, lo dice
un aviso (`Toast`) desde un solo sitio.

| Pantalla             | Endpoint                                                                                                                                            | Piezas                                                                                                                                                                                             | Estados propios                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mi ruta              | `GET /api/learn/enrollments` (el selector, si hay más de una) y `GET /api/learn/cohort?enrollmentId=` (`apps/web/app/api/learn/cohort/route.ts:15`) | `Select`, `Card`, `Progress`, `Accordion` por etapa, `ListItem` por paso, `Badge`, `EmptyState`                                                                                                    | Cada `gate` (`cohort.service.ts:35`) con el texto de `learn.gate.*`; etapa bloqueada, por fecha o por cuota (`learn.moduleAccess.*`); paso bloqueado por otro (`learn.blockedBy`); `awaitingPlan` y `partnerFunded` en un `Message`; examen o actividad → abre la web                                                                                                                                                                                                                             |
| Tema                 | `GET /api/learn/lessons/[assignmentId]` (`…/route.ts:15`) y `POST …/evidence` (`…/evidence/route.ts:26`)                                            | WebView a la altura de su contenido, `Accordion` de transcripciones, `Button` anterior y siguiente                                                                                                 | Cada `gate` del tema (`lesson.service.ts:42`, `learn.lesson.gate.*`); `justCompleted` → `Message` de éxito; entrega → la web                                                                                                                                                                                                                                                                                                                                                                      |
| Notificaciones       | `GET /api/notifications` (`route.ts:19`), `PATCH …/[id]/read` (`[notificationId]/read/route.ts:15`), `PATCH …/read-all` (`read-all/route.ts:13`)    | `ListItem` agrupado por día (Hoy, Ayer, fecha), `Badge` «Sin leer», `Button` «Marcar todas como leídas», `EmptyState`                                                                              | Pulsar un aviso lo marca leído y abre su `href` (en la web son dos controles, «Ver» y «Marcar leída»: `components/organisms/notification-list/NotificationList.tsx`); el `href` que la app tiene (`src/links.ts`) se abre en la app, el resto en la web                                                                                                                                                                                                                                           |
| Mi cuenta y pagar    | `GET /api/learn/account` (`route.ts:8`, `{ accounts, onlinePayment }`), `POST /api/learn/account/pay` (`pay/route.ts:21`)                           | `Card` por matrícula, `Badge` del estado, `ListItem` por cuota, `Disclosure` de pagos, `Button` «Pagar en línea» (abre Bold en el navegador de la app) y «Enviarme el link al correo»              | Solo la cuota que da `summary.next`, y solo con `onlinePayment`; al cerrar el navegador se vuelve a pedir la cuenta. 404 → «No tienes cuentas por pagar». «Datos para transferencia», en la web (el correo de soporte no viene en la respuesta). Tras pagar, Bold vuelve a `/aprender/mi-cuenta` de la web dentro del navegador de la app, que no tiene la sesión: la persona lo cierra y la app vuelve a pedir la cuenta (el pago puede seguir «En proceso» hasta que llegue el webhook de Bold) |
| Calendario           | `GET /api/learn/calendar` (`route.ts:11`)                                                                                                           | `ListItem` en «Hoy», «Próximos 7 días» y «Después» (los mismos cortes que `aprender/calendario/page.tsx:86-100`, por día en Bogotá), `Disclosure` de lo pasado, `Badge` «Hecho», `Button` «Unirse» | «Unirse» solo con `joinable` y `href` del servidor; si no, «El enlace se activa 15 minutos antes»; el fin de acceso, una vez arriba; un cuestionario abre la web; vacío                                                                                                                                                                                                                                                                                                                           |
| Constancias          | `GET /api/learn/certificates` (`route.ts:11`)                                                                                                       | `ListItem` por constancia, `Badge` del tipo y «Revocada»                                                                                                                                           | Pulsar abre `/certificado/[code]` de la web (verificar, compartir, PDF); vacío. «Certificado de estudios» (pedirlo) queda en la web                                                                                                                                                                                                                                                                                                                                                               |
| Olvidé mi contraseña | `POST /api/auth/recover` (`recover/route.ts:19`)                                                                                                    | `TextField`, `Button`, `Message`                                                                                                                                                                   | Desde la pantalla de acceso; responde siempre lo mismo (`:34`) y el enlace del correo vuelve a la web (`:28-29`); 429 con su texto                                                                                                                                                                                                                                                                                                                                                                |

**El tema** (`app/aprender/tema/[id].tsx`):

- El HTML del servidor, ya saneado, en una `react-native-webview` a la altura de su contenido
  (la página manda su alto), dentro del scroll de la pantalla; `baseUrl` es la web, para que
  las rutas relativas y el Vimeo funcionen como allí. Un enlace del tema abre el navegador de la
  app. El CSS sale de los tokens del tema (claro u oscuro) y escala con la letra del sistema
  (`PixelRatio.getFontScale`; `textZoom` en Android).
- **La evidencia la mide la app y la decide el servidor**, como
  `apps/web/app/(student)/aprender/tema/[assignmentId]/evidence-recorder.tsx`: segundos con la
  pantalla a la vista y la app en primer plano, el final del contenido a la vista, la posición y
  la duración del video de Vimeo (el script de la WebView escucha `playProgress`/`timeupdate`) y
  la transcripción abierta y leída hasta el final. Se manda cada 20 s si algo cambió, al
  instante al encenderse una bandera o al cruzar el video el 90 %, y al salir o pasar a segundo
  plano; lo que no llegó se manda en el siguiente envío. `justCompleted` → «Tema completado».
- Un tema con actividad, o un examen: «Hazlo en la web».
- Anterior y siguiente: los de `navigation`; uno bloqueado dice por qué.

**Fuera de M2:** exámenes y actividades (M3); notificaciones push y publicar en las tiendas
(M4); registro, catálogo, pedir habilitación, opinión, pedir certificado, reportar un problema y
biblioteca.

### Push — Equipo (27/11)

Decisión: `PRODUCT_DECISIONS.md`, «Notificaciones push: sobre la campana, con Expo». Un push es la
entrega de un aviso de la campana: nace en `notify` y nada más lo crea.

- **Qué avisa:** mensajes (`conversation_message`, `conversation_waiting`) y solicitudes
  (`enrollment_requested`, `unlock_requested`, `attempt_requested`).
- **Cuándo:** en horario de asesores (`advisorsOpen`); fuera, solo la campana.
- **Qué muestra:** el título y el texto del aviso, también con la pantalla bloqueada. El toque
  lleva al `href` del aviso y lo deja leído en la campana (`src/push/PushTaps.tsx`).
- **Sin contador en el icono:** la app del equipo no tiene campana donde bajarlo.
- **Permiso:** se pide en la bandeja, con un botón (`src/push/PushCard.tsx`), no al abrir la app.
  Android necesita antes sus canales: `mensajes` y `solicitudes`.
- **Dispositivo:** con permiso, la app guarda su token de Expo al entrar (`PUT /api/push/devices`,
  `src/push/push.ts`). Antes de cerrar sesión lo borra (`DELETE`) y se da de baja del servicio de
  push, haya red o no: un teléfono sin sesión no recibe avisos.
- **Entrega:** una fila por aviso y teléfono (`PushDelivery`). Se envía al crear el aviso; el cron
  de cada minuto reintenta (hasta cinco veces, cada vez más tarde) y lee los recibos. Un token
  que Expo da de baja se borra.

**Credenciales (28/11):** proyecto de EAS `jhonnyq/alba-futuro-educativo`; identificador
`com.albafuturoeducativo.app` en las dos plataformas. Android: app en el proyecto de Firebase
`alba-futuro-educativo` (`apps/mobile/google-services.json`) y su cuenta de servicio en EAS para FCM
v1. iOS: App ID con Push Notifications en el equipo de Apple `QL4RRHD3G9` y la clave de APNs del
equipo en EAS. Expo Go no recibe push: hace falta un build (`eas.json`, perfil `development`).
**Falta:** ver un aviso llegar a un teléfono; los avisos del estudiante.

## Tema

`apps/mobile/theme/alba.tokens.json` es el tema de ALBA en el formato de Fluxus, escrito con los
valores exactos de `packages/design-tokens/src/values/light.ts` y `dark.ts` (convertidos a OKLCH
con `fluxus/packages/ui/scripts/hex-to-oklch.mjs`, que comprueba que vuelven al mismo hex).
`apps/mobile/theme/alba.ts` se genera con
`node ~/development/fluxus/packages/ui/scripts/build-native-tokens.mjs --theme … --out …`, que
pasa el validador de contraste de Fluxus. No se edita a mano. Equivalencias: `03-ui/tokens.md`,
«Tema nativo».

Los tokens de ALBA sin sitio en Fluxus van en el mismo tema bajo `app.` (SPEC de Fluxus §15.9),
con los valores del contrato: `app.surface.note`, `app.status.locked.{base,muted,on-base}` y
`app.brand.{yellow,on-yellow,red}`. Se leen con `useTheme<typeof theme>()`, que da las claves
exactas: una mal escrita no compila.

**Claro y oscuro:** siguen al sistema (`userInterfaceStyle: "automatic"` en
`apps/mobile/app.json`; en Android lo aplica `expo-system-ui`, aprobado el 27/11).

**Letra:** Atkinson Hyperlegible Next en tres caras estáticas (400, 600, 700) sacadas del mismo
variable de la web (`apps/web/app/fonts/README.md`), cargadas con `expo-font` y pasadas a
`<ThemeProvider fonts>`.

## Accesibilidad

El contrato de `03-ui/accesibilidad.md`, sección «App móvil», sin rebaja.

## Lo que solo se comprueba en un teléfono

Jest no ejecuta código nativo ni pinta. Por fase, en iOS y Android: VoiceOver y TalkBack
recorren cada control con su nombre y su estado; la letra del sistema al 200 % no recorta nada;
el movimiento reducido corta las animaciones; las tres pruebas de la sesión.
