# Dominio, buzones y correo de la plataforma — albafuturoeducativo.com

Creado el 8/10. Decisiones (Jhonny, 8/10): el dominio lo compra el cliente en **Cloudflare**;
buzones en **Zoho Mail Lite** (cristian@, ana@, info@); la plataforma envía por **Resend** desde
el **dominio raíz** (`no-reply@albafuturoeducativo.com`). Origen: reunión con el cliente del 3/10.

Quién hace qué: el cliente paga y es dueño de las cuentas (Cloudflare, Zoho, Resend); Jhonny entra
como miembro y configura. Nada de esto se hace desde el código: el código ya está listo (§9).

## 0. Costos de referencia (consultados el 8/10/2026; confirmar al pagar)

| Servicio             | Plan                       | Costo                                                                               |
| -------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| Cloudflare Registrar | `.com` a precio de costo   | ~10,5 USD/año, renovación igual                                                     |
| Zoho Mail            | Mail Lite 5 GB, pago anual | ~1 USD por usuario/mes (3 buzones ≈ 36 USD/año)                                     |
| Resend               | Free                       | 0 USD: 3.000 correos/mes, 100/día, 3 dominios. Pro (20 USD/mes) al pasar de 100/día |

## 1. Comprar el dominio (cliente, Cloudflare)

1. Crear la cuenta en dash.cloudflare.com con un correo que ya tengan (aún no existe info@).
   Activar la verificación en dos pasos.
2. _Domain Registration → Register Domains_ → `albafuturoeducativo.com`. Datos del titular: los
   de la institución. Renovación automática **activada**.
3. _Manage Account → Members_ → invitar a Jhonny (Administrator). Así nadie comparte contraseñas.

El DNS queda en Cloudflare. Regla para todo lo que sigue: **nube gris (DNS only)** en cada
registro. El proxy naranja rompe Vercel (certificado) y no aplica al correo.

## 2. La web en el dominio (Vercel)

1. Proyecto en Vercel → _Settings → Domains_ → añadir `albafuturoeducativo.com` y
   `www.albafuturoeducativo.com` (redirige a la raíz).
2. Copiar a Cloudflare los registros que Vercel muestre (normalmente `A @` y `CNAME www`), en
   gris. Esperar el «Valid Configuration» y el certificado.
3. _Settings → Environment Variables_ (Production): `NEXT_PUBLIC_APP_URL=https://albafuturoeducativo.com`.

## 3. Buzones (Zoho Mail Lite)

1. zoho.com/mail → _Mail Lite_ → «usar un dominio que ya tengo» → `albafuturoeducativo.com`.
   Centro de datos: **US** (los registros de abajo son los de zoho.com).
2. Verificar el dominio con el TXT que da Zoho (`zoho-verification=zb…` en `@`).
3. Crear `cristian@` y `ana@`. Para `info@`, dos opciones: buzón propio (una licencia más) o
   **grupo** que reparte a cristian y ana (no gasta licencia). Decide el cliente.
4. Registros en Cloudflare (los valores exactos los da Zoho en _Domains → Email configuration_):

| Tipo | Nombre             | Valor                          | Prioridad |
| ---- | ------------------ | ------------------------------ | --------- |
| MX   | `@`                | `mx.zoho.com`                  | 10        |
| MX   | `@`                | `mx2.zoho.com`                 | 20        |
| MX   | `@`                | `mx3.zoho.com`                 | 50        |
| TXT  | `@`                | `v=spf1 include:zoho.com ~all` | —         |
| TXT  | `zmail._domainkey` | el que da Zoho (DKIM)          | —         |

**Un solo SPF en la raíz.** El de Resend vive en el subdominio `send` (§4), así que no se mezclan.

## 4. Envío de la plataforma (Resend)

1. resend.com: cuenta del cliente (o la de Jhonny con equipo del cliente) → _Domains → Add
   Domain_ → `albafuturoeducativo.com`, región `us-east-1`.
2. «Sign in to Cloudflare»: Resend crea solo sus registros (Domain Connect). A mano, si no:

| Tipo | Nombre              | Valor                                                           | Prioridad |
| ---- | ------------------- | --------------------------------------------------------------- | --------- |
| MX   | `send`              | `feedback-smtp.us-east-1.amazonses.com` (el que muestre Resend) | 10        |
| TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                             | —         |
| TXT  | `resend._domainkey` | el que da Resend (DKIM)                                         | —         |

No tocan los MX de Zoho: el MX de Resend está en `send.`, no en la raíz. 3. _Verify DNS Records_ (minutos; hasta 72 h). 4. _API Keys_: dos llaves con **Sending access** restringidas al dominio:

- `vercel-produccion` → Vercel `RESEND_API_KEY`.
- `supabase-smtp` → Supabase (§6). Separadas para poder rotar una sin tumbar la otra
  (`docs/runbooks/rotacion-secretos.md`).

5. Vercel (Production): `RESEND_API_KEY=<vercel-produccion>`, `EMAIL_DOMAIN=albafuturoeducativo.com`.
   Redesplegar. Sin estas dos, la app usa `ConsoleMailer` y **no envía** (`lib/mail/index.ts`).

## 5. DMARC

| Tipo | Nombre   | Valor                                                       |
| ---- | -------- | ----------------------------------------------------------- |
| TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@albafuturoeducativo.com` |

Empezar en `p=none` (solo informa). A las 2–4 semanas, si los informes muestran que solo envían
Zoho y Resend, subir a `p=quarantine`.

## 6. Supabase Auth (proyecto de producción; repetir en staging con su URL)

1. _Authentication → URL Configuration_: Site URL `https://albafuturoeducativo.com`; Redirect URLs
   `https://albafuturoeducativo.com/auth/callback` (y `https://www.…` si se usa).
2. _Authentication → Emails → SMTP Settings_ → activar: host `smtp.resend.com`, puerto `465`,
   usuario `resend`, contraseña = llave `supabase-smtp`; remitente `no-reply@albafuturoeducativo.com`,
   nombre `ALBA Futuro Educativo`. Subir el límite de envíos por hora (con SMTP propio se puede).
3. _Authentication → Emails → Templates_: pegar
   - **Reset Password** ← `supabase/templates/recovery.html`, asunto «Restablece tu contraseña de ALBA Futuro Educativo».
   - **Magic Link** ← `supabase/templates/magic_link.html`, asunto «Tu enlace para entrar a ALBA Futuro Educativo».
     Los demás (Confirm signup, Invite, Change email) no se usan: las cuentas se crean con
     `admin.createUser` y el enlace mágico ya no crea usuarios (`shouldCreateUser: false`).
4. Comprobar que el vencimiento del OTP sea 3600 s (las plantillas dicen «una hora»).

## 7. Datos de la institución

- `/admin/institucion`: nombre del remitente `ALBA Futuro Educativo`, correo de soporte
  `info@albafuturoeducativo.com` (es el `reply_to` de todo lo que envía la app).
- `primaryDomain` no se edita en la app (`app/api/admin/institution/route.ts:6`). En la base:
  `update "Institution" set "primaryDomain" = 'albafuturoeducativo.com' where slug = 'colombia-estudia';`
  Lo usa el recordatorio de cuota para el logo y el enlace.

## 8. Comprobar

1. Enviar una invitación a un Gmail propio y pedir «olvidé mi contraseña» y un enlace mágico.
2. En Gmail, _Mostrar original_: **SPF, DKIM y DMARC = PASS**, remitente
   `no-reply@albafuturoeducativo.com`, responder a `info@…`.
3. mail-tester.com: 9/10 o más.
4. Escribir a cristian@, ana@ e info@ desde fuera y responder desde ellos.
5. Vimeo: añadir `albafuturoeducativo.com` a los dominios permitidos de embed.

## 9. Lo que ya está en el código (8/10)

- `lib/mail/resend-mailer.ts`: Resend por `fetch`, remitente `{emailFromName} <no-reply@EMAIL_DOMAIN>`,
  `reply_to` = correo de soporte.
- `lib/mail/templates/layout.ts`: marco de marca (logo, raya amarilla, botón) para la invitación y
  el recordatorio de cuota; `supabase/templates/*.html` copian el mismo marco (test:
  `__tests__/unit/mail/supabase-templates.test.ts`).
- `app/api/auth/magic-link/route.ts`: `shouldCreateUser: false`.
