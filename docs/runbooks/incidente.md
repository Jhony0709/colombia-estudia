# Runbook — Incidente

**Canal**: correo de la institución + guardia de Jhonny las dos primeras semanas.

## Primero

1. ¿Es uno o son todos? `GET /api/health` y abrir `/auth/login`. Si no abre, es de todos.
2. Pedir el **código** de la pantalla de error («Si escribes a soporte, menciona el
   código…»). Es el `digest` del error: en Sentry se busca tal cual; en los logs de Vercel,
   por `requestId` de la petición.
3. Anotar hora, quién, qué pantalla, qué código.

## Dónde mirar

| Síntoma                            | Dónde                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------- |
| Pantalla de error con código       | Sentry → buscar el digest → traza. Logs de Vercel → `requestId`.                        |
| «No se pudo guardar» en el player  | Logs → `POST /api/learn/lessons/*/evidence`; ¿410 (`ATTEMPT_EXPIRED`)? ¿403?            |
| Un pago no aparece como confirmado | `/cartera/[matrícula]`: ¿registrado sin confirmar? Logs → `wompi-webhook` con `outcome` |
| El job no corrió                   | `AuditLog` → `entity = 'job'` del día. Si no hay fila, Vercel → Cron → último run       |
| Subida de archivo falla            | Logs → `POST /api/media/*/confirm`; ¿magic bytes? ¿tamaño?                              |
| Nadie puede entrar                 | Supabase → Auth → estado; `SUPABASE_*` en Vercel                                        |

## Severidad

- **S1** (todos sin entrar, datos perdidos, pagos duplicados): responder en 15 min, avisar
  a operaciones, decidir rollback si es la primera cohorte (`rollback.md`).
- **S2** (una función rota para varios): responder en 2 h.
- **S3** (uno, con rodeo posible): siguiente día hábil.

## Después

Entrada en `docs/estado.md`: qué pasó, cuánto duró, qué se cambió para que no vuelva. Sin
nombres de estudiantes.
