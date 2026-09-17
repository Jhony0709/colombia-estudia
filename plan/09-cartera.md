# 09 — Cartera (fase 5, semanas 14-15)

## Objetivo

Operaciones sabe quién está al día sin abrir Excel; el estudiante paga en línea o por
transferencia y ve su estado; los errores se anulan, no se borran; nada de esto toca el
acceso académico de un menor.

## Pasos

### 1. Estado de cuenta (`packages/domain/src/account-status.ts`)

Ya escrito en fase 1; aquí se conecta: `GET /api/billing` calcula el estado por matrícula
en el servidor (una consulta con cuotas y acuerdos, cálculo en memoria) y lo devuelve con
la próxima cuota, el vencido total y el acuerdo vigente.

### 2. Planes y cuotas

`POST /api/billing/plans`: para una matrícula (`payerType`, total, número de cuotas, primer
vencimiento, periodicidad) o para toda una cohorte de aliado (un plan por matrícula,
`payerType PARTNER`). Genera `Installment` con `position` y `dueOn`. Editar cuotas no
pagadas: solo montos y fechas, auditado; las pagadas no se tocan.

### 3. Pagos manuales en dos pasos

Formulario (cuota, monto, método, referencia, fecha) → resumen ("Vas a registrar $300.000
por transferencia a la cuota 3 de {nombre}, vence el 15/10") → confirmar. Transacción
serializable: `Payment.confirmedAt`, recálculo de `Installment.status`, `AuditLog
payment.confirmed`, `Notification payment_confirmed` al pagador. Anular: motivo
obligatorio, recálculo, `payment.voided`.

### 4. Wompi (`features/billing/wompi`)

- **Checkout**: `POST /api/learn/account/pay { installmentId }` crea la referencia
  `ce-{installmentId}-{n}` (n = intento), calcula la firma de integridad (SHA256 de
  referencia + monto en centavos + moneda + secreto de integridad) y devuelve la URL del
  Web Checkout con `redirect-url` a `/aprender/mi-cuenta?pago={ref}`.
- **Webhook** `POST /api/webhooks/wompi`: verifica el checksum del evento
  (`WOMPI_EVENTS_SECRET`), lee `transaction.id`, `reference`, `status`, `amount_in_cents`;
  **consulta la transacción** en la API de Wompi antes de confiar; `APPROVED` → crea y
  confirma `Payment { method: GATEWAY, gatewayRef: transaction.id }` (único → duplicado es
  no-op), recalcula; `DECLINED`/`ERROR` → `Notification` al pagador con "no se completó";
  siempre 200 tras registrar.
- **Conciliación**: el job consulta transacciones `PENDING` de más de 1 h por referencia.
- **Sandbox** en staging con las llaves de prueba; e2e con el evento firmado de ejemplo.
- La comisión: quien la asuma se configura por institución (`Institution.settings.gatewayFeeBy`);
  la UI muestra el total con o sin recargo y la opción "transferencia sin costo" siempre.

### 5. Acuerdos de pago

Formulario (cuotas nuevas: número, montos, fechas; firmante) → vista previa del calendario
→ confirmar: transacción que pasa las pendientes a `VOID`, crea las nuevas con
`agreementId`, `PaymentAgreement ACTIVE`, `AuditLog agreement.signed`, notificación.
`FULFILLED` automático cuando todas las del acuerdo están `PAID` (job).

### 6. Pantallas

`/cartera`: tabla por cohorte con estado derivado (`StatusChip`), próxima cuota, vencido,
acuerdo; filtros (cohorte, aliado, estado) en la URL; acciones por fila; exportar.
`/cartera/[enrollmentId]`: cuotas, pagos, acuerdos, historial. `/aprender/mi-cuenta`:
cuotas con estado, "Pagar en línea" / "Datos para transferencia", pagos, acuerdo.
`/aliado`: cartera de su cohorte si paga.

### 7. Política y recordatorios

`/admin/politicas`: los dos flags con su advertencia; auditado. Job diario:
`notifyPayerOnOverdue` → `Notification overdue_reminder` (dedupe por cuota y día) + correo;
`agreement_overdue` a operaciones. Ningún flag académico; ninguna columna de suspensión.

## Criterio de salida

- Registrar, confirmar y anular deja `Installment.status` y el estado derivado correctos
  en los tres pasos; dos confirmaciones en paralelo → un `Payment`.
- Acuerdo firmado anula pendientes y crea nuevas; estado `IN_AGREEMENT`; cuota del acuerdo
  vencida → `OVERDUE`.
- Webhook con firma inválida → 401; evento duplicado → un solo `Payment`; monto del evento
  distinto al de la transacción consultada → se registra y no se confirma.
- Un menor con cartera vencida sigue entrando a `/aprender` (test explícito).
- `/cartera` a 320 px con scroll propio de la tabla; acciones financieras en dos pasos
  probadas por teclado.
