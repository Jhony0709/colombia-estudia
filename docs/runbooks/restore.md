# Runbook — Restaurar un backup

**Objetivo**: saber cuánto tarda y que de verdad funciona antes de necesitarlo (plan/10 §4).

## Base de datos (Supabase)

1. En el proyecto de staging: Database → Backups → elegir el diario más reciente.
2. Restaurar **en un proyecto temporal** (nunca sobre el que está en uso): crear proyecto
   `colombia-estudia-restore-AAAAMMDD`, restaurar ahí.
3. Verificar conteos por tabla contra el original (SQL Editor):

   ```sql
   select 'Person', count(*) from "Person"
   union all select 'Enrollment', count(*) from "Enrollment"
   union all select 'LessonProgress', count(*) from "LessonProgress"
   union all select 'Attempt', count(*) from "Attempt"
   union all select 'Payment', count(*) from "Payment"
   union all select 'AuditLog', count(*) from "AuditLog"
   union all select 'LearningEvent', count(*) from "LearningEvent";
   ```

4. Apuntar la aplicación de staging al proyecto temporal (`DATABASE_URL`) y recorrer:
   login, `/aprender`, un tema, `/cartera`. Si todo abre, el backup sirve.
5. Borrar el proyecto temporal.
6. Anotar el tiempo total aquí y la fecha del ensayo.

| Fecha | Tiempo total | Conteos coinciden | Notas |
| ----- | ------------ | ----------------- | ----- |
|       |              |                   |       |

## Storage

El bucket `media` tiene que tener **versionado** activado (Storage → bucket → settings).
Restaurar un objeto borrado: Storage → objeto → versiones → restaurar. Ensayar con un PDF
de prueba y anotar aquí.

## Qué no se restaura

Los usuarios de Auth viven aparte (Supabase Auth): un restore de la base no los toca. Si
hay que restaurar Auth, es el backup del proyecto entero, no el de la base.
