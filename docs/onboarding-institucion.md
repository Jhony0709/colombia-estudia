# Runbook: dar de alta una institución

Manual hoy, por script; automatizable cuando haya una tercera. Cada paso deja rastro.

1. **Contrato y datos**: contrato de licencia + contrato de encargo de tratamiento de datos
   (Ley 1581: la institución es responsable, la plataforma encargada). Nombre legal, NIT,
   contacto de soporte, política de tratamiento de datos (URL y versión), logo, color.
2. **Tenant**: `Institution` con `slug`, marca y contacto (`scripts/institution/create.ts`),
   `RestrictionPolicy` vacía, `AuditLog institution.created`.
3. **Dominio propio** (decisión 3): la institución aporta el dominio (p. ej.
   `app.validaya.com`); CNAME a Vercel, `Institution.primaryDomain`, SSL automático.
   Remitente de correo `Institution.emailFromName <no-responder@colombiaestudia.co>` (o el
   dominio de la institución si verifica su DNS en Resend).
4. **Vimeo**: añadir el dominio a la lista de embeds permitidos de la cuenta de la institución.
5. **Wompi**: hoy las llaves van en variables de entorno (una sola institución recaudando).
   Con la segunda institución pasan a la base, cifradas, por institución. Sandbox primero.
6. **Primer ADMIN**: `Person` + `Membership ADMIN` + invitación.
7. **Programa**: programa, módulos, asignaturas (el admin lo hace en `/admin/institucion`),
   o importación si vienen de otra plataforma (`/admin/importar`, `dryRun` primero).
8. **Cohorte piloto**: crear, cargar CSV en seco, corregir, confirmar, invitar.
9. **Verificación**: test de aislamiento en staging con dos instituciones; recorrido con
   teclado y lector de pantalla en el dominio nuevo; backup restaurado.
10. **Capacitación**: operaciones (matrículas, cartera, invitaciones) y autores (editor,
    publicación, legado).

Lo que aún no existe y frena una tercera institución: `Person` global multi-institución,
facturación por institución, llaves de Wompi por institución en la base (hoy variables de
entorno: una sola cuenta recaudadora). Está en `ROADMAP.md`.
