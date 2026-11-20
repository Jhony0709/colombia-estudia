// Comprueba la integración de Bold con las llaves de PRUEBA: crea un link de $1.000, lo consulta
// y dice en qué unidad acepta Bold la fecha de vencimiento. No imprime la llave.
// Uso: BOLD_API_KEY=<llave de identidad de pruebas> node packages/scripts/bold/check.mjs
const API = process.env.BOLD_API_URL || 'https://integrations.api.bold.co';
const key = process.env.BOLD_API_KEY;
if (!key) {
  console.error('Falta BOLD_API_KEY (la llave de identidad de pruebas).');
  process.exit(1);
}
const headers = { Authorization: `x-api-key ${key}`, 'Content-Type': 'application/json' };
const inOneDay = Date.now() + 24 * 3600 * 1000;

async function create(unit, expiration) {
  const reference = `ce-check-${unit}-${Date.now().toString(36)}`;
  const res = await fetch(`${API}/online/link/v1`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount_type: 'CLOSE',
      amount: { currency: 'COP', total_amount: 1000, tip_amount: 0 },
      reference,
      description: 'Prueba de integración',
      expiration_date: expiration,
    }),
  });
  const body = await res.json().catch(() => null);
  const id = body?.payload?.payment_link;
  console.log(`\n[${unit}] crear → HTTP ${res.status}${id ? `, link ${id}` : ''}`);
  if (!id) return console.log(`[${unit}] errores:`, JSON.stringify(body?.errors ?? body));
  const got = await (
    await fetch(`${API}/online/link/v1/${id}`, { headers })
  )
    .json()
    .catch(() => null);
  const seen = {
    status: got?.status,
    total: got?.total,
    is_sandbox: got?.is_sandbox,
    reference: got?.reference,
    expiration_date: got?.expiration_date,
    transaction_id: got?.transaction_id,
  };
  console.log(`[${unit}] consultar →`, JSON.stringify(seen));
  console.log(`[${unit}] enviado: ${expiration} · nuestra referencia: ${reference}`);
  console.log(`[${unit}] para pagarlo con los datos de prueba: ${body.payload.url}`);
}

const methods = await fetch(`${API}/online/link/v1/payment_methods`, { headers });
console.log(
  `métodos de pago → HTTP ${methods.status}`,
  JSON.stringify(await methods.json().catch(() => null))
);
await create('nanosegundos', inOneDay * 1_000_000);
await create('milisegundos', inOneDay);
console.log(
  '\nLa unidad correcta es la que deja el link ACTIVE con expiration_date a un día de hoy.'
);
