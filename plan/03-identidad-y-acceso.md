# 03 — Identidad y acceso

## Objetivo

Un solo camino para saber quién es la persona, de qué institución, con qué matrículas y
qué puede hacer sobre qué recurso. Login sin fricción para adultos en móvil, seguro para
staff, sin auto-registro, y con cada decisión de autorización en un sitio probado.

## Decisiones

- **Supabase Auth con cookies (`@supabase/ssr`)**, flujo PKCE, sin sesión en `localStorage`.
  Auto-registro **deshabilitado** en el proyecto: las cuentas nacen por invitación.
- **Tenant por host**: `Institution.primaryDomain`. Sin institución para el host → 404.
  **Aplazado (Jhonny, 16/9)**: en el primer alcance hay un solo tenant fijo, la institución
  de slug `colombia-estudia` (`apps/web/lib/authz/tenant.ts`); `getRequestContext()` la
  resuelve por slug (caché igual) y una fila ausente es error de despliegue, no 404. El
  middleware sigue reenviando `x-tenant-host` para volver a la resolución por host cuando
  exista una segunda institución.
- **Autorización en el servidor, con alcance**: `resolveCapabilities` (dominio puro) +
  `withCapability` (wrapper). El cliente solo oculta; nunca decide.
- **MFA (TOTP) obligatoria para `ADMIN` y `OPERATIONS`**, opcional para el resto. Es lo
  mínimo para quien ve cartera y PII de cien personas.
- **Rate limiting en el borde** (Vercel WAF, reglas por ruta) para `/auth/*`,
  `/api/auth/*`, `/api/invitations/*`, `/api/certificates/*`. Sin Redis.

## Middleware (`apps/web/middleware.ts`)

Corre en el Edge, en cada request salvo assets. Hace exactamente cinco cosas, en orden, y
nada más (la lógica de negocio no vive aquí):

```ts
export async function middleware(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
  const res = NextResponse.next({ request: { headers: withRequestId(req.headers, requestId) } });

  // 1. Tenant: el host viaja al servidor; la resolución (con caché) ocurre en getRequestContext()
  res.headers.set('x-tenant-host', req.nextUrl.hostname);

  // 2. Sesión: refresca el token de Supabase y reescribe cookies (patrón oficial de @supabase/ssr)
  const { supabase, response } = createMiddlewareClient(req, res);
  const {
    data: { user },
  } = await supabase.auth.getUser(); // getUser, nunca getSession: valida contra el servidor

  // 3. Rutas protegidas: sin usuario → /auth/login?next=…  (solo redirige; la capacidad la verifica el layout/handler)
  if (isProtected(req.nextUrl.pathname) && !user) return redirectToLogin(req);

  // 4. Cabeceras de seguridad (ver 04-seguridad.md): CSP con nonce, HSTS, frame-ancestors, Permissions-Policy
  applySecurityHeaders(response, { nonce: generateNonce() });

  // 5. Request id de vuelta al cliente para soporte
  response.headers.set('x-request-id', requestId);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp|woff2)).*)'],
};
```

Por qué no resolvemos la institución en el middleware: el Edge no debe hablar con
Postgres en cada request. `getRequestContext()` (Node, `React.cache` por request + LRU en
memoria con TTL 5 min) la resuelve una vez por request desde `x-tenant-host`.

## Contexto de request (`lib/authz/request-context.ts`)

```ts
export const getRequestContext = cache(async (): Promise<RequestContext> => {
  const host = headers().get('x-tenant-host')!;
  const institution = await resolveInstitution(host); // LRU + DB; null → notFound()
  const user = await getSupabaseUser(); // null si anónimo
  if (!user) return { institution, person: null, capabilities: new Map(), requestId };
  const person = await db(institution.id).person.findUnique({
    where: { authUserId: user.id },
    include: {
      memberships,
      enrollments: { include: { cohort, paymentPlan, accommodation } },
      guardianOf,
      partnerContacts,
    },
  });
  const accountStatusByEnrollment = deriveAll(person.enrollments, now);
  const capabilities = resolveCapabilities({
    memberships,
    enrollments,
    guardianships,
    partnerContactOf,
    accountStatusByEnrollment,
    restrictionPolicy,
    now,
  });
  return { institution, person, capabilities, requestId };
});
```

Una consulta por request, cacheada; los layouts, las páginas y los handlers la comparten.

## `withCapability` (`lib/authz/with-capability.ts`)

```ts
export const withCapability = <TResource>(
  capability: Capability,
  opts?: { load: (ctx, params) => Promise<TResource | null>; scopeOf: (r: TResource) => Scope },
) => (handler: (ctx: RequestContext, resource: TResource, ...) => Promise<Response>) =>
  async (req, { params }) => {
    const ctx = await getRequestContext()
    if (!ctx.person) throw new APIError('Unauthenticated', 'UNAUTHENTICATED')
    const scopes = ctx.capabilities.get(capability)
    if (!scopes) throw new APIError('Missing capability', 'INSUFFICIENT_CAPABILITY')
    let resource: TResource | undefined
    if (opts) {
      resource = await opts.load(ctx, params)
      if (!resource) throw new APIError('Not found', 'NOT_FOUND')         // otra institución también es 404
      if (!scopeAllows(scopes, opts.scopeOf(resource))) throw new APIError('Out of scope', 'INSUFFICIENT_CAPABILITY')
    }
    return handler(ctx, resource!, req, params)
  }
```

`apiHandler` (`lib/http`) compone `withCapability` + zod + manejo de errores + log. En los
layouts de área se usa `requireCapability(cap)` que redirige a `/` en vez de 403 (regla de
`routes.md`). Test por endpoint con recurso: "misma institución, otra cohorte → 403".

## Flujos

### Login

`/auth/login`: email + contraseña, `autocomplete="username"` / `"current-password"`,
un solo formulario, error genérico ("Correo o contraseña incorrectos") sin revelar si
el correo existe, enlace "¿Olvidaste tu contraseña?" y "Entrar con enlace por correo"
(magic link, alternativa accesible 3.3.8). Tras login: `next` validado (mismo origen,
ruta relativa) o `/`. Staff con MFA pendiente → `/auth/mfa`.

### Invitación (3 pasos, móvil)

1. Operaciones crea la persona y `POST /api/people/invitations` →
   token propio (`randomBytes(32)`, §9c; no `generateLink`: así controlamos copy, marca y
   expiración, y la cuenta de Auth se crea al aceptar) con expiración 7 días; el token
   se guarda hasheado en `Person.invitation` (nuevo campo si hace falta: `invitationTokenHash`,
   `invitationExpiresAt`) y el correo sale por Resend con la marca de la institución.
2. `/invitacion/[token]` → `POST /api/invitations/[token]/accept`: confirma identidad
   (nombre visible, nunca documento), fija contraseña (política abajo), acepta la política
   de datos → `Consent { channel: PLATFORM, policyVersion: institution.dataPolicyVersion }`.
   Menor: pantalla que explica que el acudiente firmó en papel; no hay paso de consentimiento.
3. Sesión iniciada, foco al `h1` de `/aprender`. Token usado o vencido → copy y botón
   "Pedir una invitación nueva" (crea `Notification` a operaciones; rate-limited).

### Recuperación

`/auth/recuperar` → `POST /api/auth/recover` → `resetPasswordForEmail` con redirect a
`/auth/restablecer/[token]`; respuesta siempre "si el correo existe, te enviamos un
enlace". Rate-limited en el WAF.

### Contraseñas

Mínimo 12 caracteres, sin reglas de composición (NIST 800-63B), comprobación contra
contraseñas filtradas (Supabase "leaked password protection"), gestores de contraseñas y
pegar funcionando, mostrar/ocultar contraseña.

### MFA para staff

TOTP con `supabase.auth.mfa`; se exige al primer login de un `ADMIN`/`OPERATIONS`
(`aal2`); códigos de respaldo; el layout `(staff)` verifica `aal`.

### Sesión

Cookies `HttpOnly`, `Secure`, `SameSite=Lax`, dominio de la institución. Duración: 7 días
con refresh; staff 12 h. `/auth/logout` revoca en Supabase y limpia cookies.
Anonimización (`Person.anonymizedAt`) borra el usuario de Auth.

## Datos que faltan en el schema para esto

`Person.invitationTokenHash`, `Person.invitationExpiresAt`, `Person.invitedAt`,
`Person.acceptedAt` — o una tabla `Invitation` (más limpia: historial y reinvitaciones).
**Decisión al empezar la fase 1**: tabla `Invitation { personId, tokenHash, expiresAt,
acceptedAt, createdById }` con `institutionId`. Se añade al schema y a `schema.md` en el
mismo PR.

## Criterio de salida

- `resolveCapabilities` cubre los 15 casos de la tabla; test "otra cohorte → 403" en cada
  endpoint con recurso.
- Login, invitación, recuperación y logout probados e2e por teclado y con lector de
  pantalla; `autocomplete` correcto; sin CAPTCHA.
- MFA exigida a un ADMIN en staging.
- Un host desconocido responde 404; el host de staging resuelve su institución en < 5 ms
  tras el primer request (caché).
