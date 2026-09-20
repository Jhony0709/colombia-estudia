# Runbook — Rollback de la primera cohorte nueva

**Cuándo**: antes de D+14, si la cohorte nueva no puede operar. Criterio (plan/10 §6):
más del 20 % de los estudiantes sin poder entrar o completar un tema en 48 h, o pérdida de
datos. Después de D+14 no hay vuelta atrás: se corrige hacia adelante.

**Quién decide**: Jhonny con operaciones de Valida YA. Quien ejecuta: Jhonny.

## Pasos

1. **Congelar**: en `/cohortes/[id]` cerrar la cohorte («Cerrar»). Los estudiantes ven
   «tu cohorte ya cerró» y nadie sigue acumulando progreso que no se va a migrar.
2. **Exportar lo hecho** (se conserva, no se migra): `/cohortes/[id]/avance` → «Exportar
   CSV»; `/cartera` → «Exportar CSV» con el filtro de la cohorte; entregas y pagos quedan
   en la base para consulta.
3. **Crear la cohorte en LearnDash** con el mismo grupo y matricular con el CSV original
   (el mismo que se importó aquí: `docs/estado.md` tiene el formato).
4. **Comunicar**: correo a los estudiantes con el enlace de LearnDash y una frase honesta
   («volvemos a la plataforma anterior mientras arreglamos…»). Plantilla en
   `docs/manuales/operaciones.md` §Comunicados.
5. **Redirecciones**: quitar las de validaya.com hacia la plataforma para esa cohorte.
6. **Cartera**: los pagos ya confirmados aquí valen; operaciones los registra en su
   control de LearnDash a mano desde el CSV del paso 2.
7. **Registrar**: una entrada en `docs/estado.md` con la fecha, el criterio que se
   cumplió y qué se aprendió.

## Ensayo en staging

Antes de D: seguir los pasos 1, 2 y 7 sobre la cohorte de prueba de staging y medir
cuánto tarda cada uno. Anotar los tiempos aquí:

| Paso | Tiempo | Notas |
| ---- | ------ | ----- |
| 1    |        |       |
| 2    |        |       |
| 7    |        |       |
