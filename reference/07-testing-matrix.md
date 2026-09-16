# 07 — Matriz de pruebas

Qué se prueba, dónde y con qué umbral. Sin esto no cierra una fase.

| Nivel         | Herramienta                                            | Qué cubre                                                                                                                                                                                                                   | Umbral                                                |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Unit          | Jest                                                   | `packages/domain/*` (capacidades con alcance, estado de cuenta, política de intento, validación de publicación, calificación, completado, métricas), `packages/types/content` (parser Markdown, Zod)                        | ≥ 90 % líneas en `packages/domain` y `packages/types` |
| Integración   | Jest + Supabase local                                  | Cliente Prisma extendido: **un test por tabla** "institución A no ve filas de B"; invariante de `Installment.status` en la transacción del pago; `answerKey` nunca sale por `/api/learn/*`; importador `dryRun` idempotente | 100 % de las tablas                                   |
| API           | Jest (route handlers)                                  | Por endpoint con recurso en la URL: "misma institución, otra cohorte → 403"; menor sin consentimiento → 403; acceso vencido → 410 con resultados aún legibles                                                               | Todos los endpoints de `endpoints.md`                 |
| e2e           | Playwright + `@axe-core/playwright`                    | Vertical slice completo (importar CSV → asignar → aprender → evaluar → resultados → cartera) por teclado; a 320 px; axe en player, evaluación, mi-cuenta, cartera                                                           | 0 violaciones axe; pasa por teclado                   |
| a11y estático | pa11y-ci, eslint-plugin-jsx-a11y, Storybook addon-a11y | Rutas del MVP y cada story                                                                                                                                                                                                  | 0 errores                                             |
| Tokens        | Jest                                                   | Cada par texto/fondo del contrato ≥ 4.5:1 (3:1 UI) en claro y oscuro                                                                                                                                                        | 100 %                                                 |
| Manual        | Persona                                                | Recorrido con VoiceOver/TalkBack y espaciado de texto forzado, una vez por fase                                                                                                                                             | Hallazgos fichados y cerrados antes de cerrar la fase |

## Criterios de aceptación por fase (verificables)

- **Fase 1**: aislamiento por tabla en verde; `resolveCapabilities` cubre los 15 casos de
  la tabla de `acceso-y-cartera.md`; `attempt-policy` con `extraTimeFactor`, `dueAt` y
  `accessUntil`; deploy en staging con institución de prueba.
- **Fase 2**: CSV de 60 personas con 5 filas inválidas importa 55 y lista las 5 con motivo
  en < 2 minutos; una fila sin `birthDate` se rechaza; un menor sin acudiente se rechaza.
- **Fase 3**: `dryRun` del importador reproduce los conteos del análisis y reporta la
  deduplicación del clon; 10 temas OCR revisados publican sin excepción; `publish` rechaza
  cada regla de la tabla con mensaje y línea.
- **Fase 4**: las 7 evaluaciones migradas, respondidas con las mismas respuestas que un
  intento de LearnDash, dan el mismo puntaje; un intento vencido con respuestas guardadas
  queda `SUBMITTED` y calificado; el player pasa axe y teclado a 320 px; una entrega
  devuelta y reenviada termina `APPROVED` y completa el tema; completar un módulo emite su
  certificado en la siguiente corrida del job y `/certificado/[code]` lo verifica.
- **Fase 5**: registrar, confirmar y anular un pago deja `Installment.status` y el estado
  derivado correctos en los tres pasos; un acuerdo firmado anula las cuotas pendientes y
  crea las nuevas; un pago en sandbox de Wompi confirma la cuota por webhook una sola vez
  aunque el evento llegue dos veces.
- **Fase 6**: restauración de backup probada; ≥ 90 % de los activos con invitación aceptada
  en 14 días; 0 tickets por progreso perdido; regla de rollback escrita y ensayada.
