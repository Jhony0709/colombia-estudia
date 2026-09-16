# 04 — Ajustes razonables (PIAR)

Es el diferenciador del producto. Ninguna plataforma de bachillerato o de gestión escolar
en Colombia trata los ajustes razonables como reglas que el sistema ejecuta. Hoy el PIAR es
un Word en una carpeta.

## Por qué existe

El **Decreto 1421 de 2017**, en el marco de la Ley 1618 de 2013, obliga a las instituciones
de educación formal —privadas incluidas, y la educación de adultos es formal— a tener un
PIAR por cada estudiante con discapacidad y a aplicarlo. Si la plataforma es el canal por
el que se dicta y se evalúa, un ajuste que el sistema ignora es un ajuste que no existe.

## El modelo

`Accommodation` es una fila **por matrícula**, gestionada con `accommodation.manage`. No es
el PIAR completo —ese sigue siendo un documento pedagógico con objetivos y seguimiento—
sino **la parte ejecutable**:

| Campo                  | Efecto en el sistema                                                              |
| ---------------------- | --------------------------------------------------------------------------------- |
| `extraTimeFactor`      | Multiplica el límite de tiempo de cada intento. 1.5 = 50 % más                    |
| `exemptFromTimer`      | El intento no tiene límite de tiempo (salvo `dueAt` y `accessUntil`)              |
| `allowedAttemptsBonus` | Intentos adicionales sobre el máximo de la versión                                |
| `requiresCaptions`     | El player no reproduce un video sin subtítulos revisados; ofrece la transcripción |
| `allowsAssistiveTech`  | Desactiva restricciones antifraude incompatibles con lectores de pantalla         |
| `notes`                | Indicaciones para el instructor. **No** contiene diagnóstico                      |

Se retiró `simplifiedContent` (auditoría fase 0): no existe variante simplificada de una
versión; volverá cuando exista.

## El principio

**La accesibilidad nunca impide medir correctamente el aprendizaje.** Un ajuste quita una
barrera que no forma parte de la competencia evaluada; no es una ventaja ni cambia la
nota. Por eso el ajuste vive en la matrícula (es de la persona, no de cada examen), se
aplica a todo, y se congela en el intento.

## Reglas

**El motor de evaluaciones consulta `Accommodation` siempre**, no el componente. El plazo
y los intentos disponibles viven en `packages/domain/src/attempt-policy.ts`:

```ts
getAttemptDeadline({ assessmentVersion, assignment, enrollment, accommodation, startedAt }): Date | null
getAttemptsAllowed({ assessmentVersion, accommodation }): number
```

`null` significa sin límite. Ninguna pantalla resta minutos por su cuenta.

**El ajuste se congela en el intento.** `Attempt.appliedAccommodation` guarda una copia al
iniciar. Si coordinación cambia el PIAR en marzo, los intentos de febrero siguen
explicándose con los ajustes vigentes entonces.

**Nunca almacenamos el diagnóstico.** El sistema guarda qué ajuste aplica, no por qué
condición. El dato de salud no entra a esta base de datos.

**El ajuste nunca se usa para segregar.** No hay cohortes "con PIAR", no hay marcas
visibles para compañeros, y los listados por defecto no muestran quién tiene ajustes. Sin
`/familia` en el MVP (decisión 7), el acudiente de un menor conoce los ajustes por
operaciones; cuando exista login de acudiente los verá ahí (coherente con el Decreto 1421,
que lo hace parte del proceso).

## Lo que le vendes a la institución

Que el cumplimiento del Decreto 1421 deje de depender de la memoria de un administrador.
`GET /api/inclusion/report` saca del `AuditLog` qué se otorgó, a quién, quién lo autorizó
y cuándo, por cohorte. Es la evidencia que hoy nadie tiene.
