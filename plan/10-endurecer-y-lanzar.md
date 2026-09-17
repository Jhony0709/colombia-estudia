# 10 — Endurecer y lanzar (fase 6, semanas 16-20)

## Objetivo

Salir a producción con la primera cohorte nueva de Valida YA sabiendo qué pasa cuando
algo falla, con el contenido migrado y verificado, el equipo capacitado y la regla de
rollback ensayada.

## Pasos

### 1. Observabilidad completa

- Dashboards en Sentry: errores por ruta, p95 por endpoint (`apiHandler` emite spans).
- Alertas: tasa de 5xx > 1 % en 5 min; job diario sin `AuditLog job.daily` a las 07:00;
  webhook de Wompi con firma inválida (posible ataque); `health` caído.
- Logs: consulta por `requestId` desde un ticket de soporte en < 1 min (el `x-request-id`
  se muestra en la pantalla de error genérica: "Si escribes a soporte, menciona el código…").
- Vercel Analytics + Speed Insights; presupuesto: LCP < 2,5 s en 4G lento para
  `/aprender` y el player.

### 2. Pruebas de punta a punta y de carga ligera

- Playwright: el vertical slice completo (`06` → `09`) por teclado, con axe en cada
  pantalla, a 320 px y a 1280; `prefers-reduced-motion` activado en una corrida.
- `k6` sobre staging: 100 estudiantes concurrentes en el player y 30 intentos simultáneos;
  p95 < 500 ms en la API; sin errores de serialización no reintentados.
- `EXPLAIN ANALYZE` de las 10 consultas más frecuentes sobre la semilla ×10.

### 3. Seguridad

- Revisión de cabeceras (securityheaders.com sobre staging), CSP sin violaciones en el
  recorrido e2e (report-uri temporal).
- Prueba de aislamiento con dos instituciones reales en staging (demo + "Otra").
- Rotación de secretos ensayada (Supabase service role, Wompi, Resend) siguiendo
  `docs/runbooks/rotacion-secretos.md`.
- Rol `app_writer` sin `UPDATE`/`DELETE` en `AuditLog`/`LearningEvent`, y la app
  conectada con él.
- Anonimización probada sobre una persona de la semilla.

### 4. Respaldo y restauración

Restaurar el backup diario de staging en un proyecto temporal; verificar conteos por
tabla; medir el tiempo; documentar en `docs/runbooks/restore.md`. Storage con versionado.

### 5. Migración definitiva de contenido

D-7: congelación de edición en WordPress (aviso a los autores). D-3: dump → `dryRun` en
staging → resumen coincide con el análisis (110 temas, 7 evaluaciones, 239 preguntas). D-2:
importación en prod → revisión visual de 10 temas al azar y de las 7 evaluaciones por
operaciones (checklist). Vimeo: dominio de producción en la lista de embeds permitidos
(decisión 11, verificar el plan).

### 6. Primera cohorte y corte

D-1: cohorte nueva `PLANNED` en prod, CSV en seco, corrección, confirmación. D: abrir la
cohorte, enviar invitaciones, monitorear aceptaciones (`/personas` muestra el estado).
Redirecciones desde validaya.com hacia el dominio de la plataforma para las rutas de
LearnDash de esa cohorte (las cohortes en curso siguen en LearnDash hasta terminar).

**Rollback** (escrito en `docs/runbooks/rollback.md` y ensayado en staging): si antes de
D+14 la cohorte nueva no puede operar (criterio: > 20 % de estudiantes sin poder entrar
o completar un tema en 48 h, o pérdida de datos), se crea la cohorte en LearnDash, se
matriculan allí y se comunica; lo hecho en la plataforma nueva se conserva pero no se
migra. Después de D+14 no hay vuelta atrás: se corrige hacia adelante.

### 7. Capacitación y soporte

- Operaciones (2 h): cohortes, CSV, invitaciones, cartera, acuerdos, entregas, políticas.
- Autores (2 h): editor, imágenes con alt, video con transcripción, publicar, legado.
- Manuales cortos en `docs/manuales/` (uno por rol, con capturas) y un video de 10 min
  por rol.
- Canal de soporte: correo de la institución; el `requestId` en la pantalla de error;
  guardia de Jhonny las dos primeras semanas.

### 8. Cierre

`docs/estado.md` con lo entregado, la deuda fichada (legado pendiente, subtítulos `AUTO`,
`/familia`, `open_text`), y las métricas de la primera semana. LearnDash en solo lectura
un mes tras terminar la última cohorte en curso; después se apaga y SiteGround queda solo
para validaya.com.

## Criterio de salida

- Restauración ensayada y documentada con tiempo.
- ≥ 90 % de invitaciones aceptadas en 14 días; 0 tickets por progreso o respuestas
  perdidas.
- Alertas probadas provocando cada condición en staging.
- Rollback ensayado en staging; runbooks de incidente, rotación y restauración escritos.
- `docs/estado.md` publicado; `reference/` al día con lo construido.
