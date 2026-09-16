/**
 * Tenant selection.
 * Decision (Jhonny, 16/9): one hardcoded tenant for the first scope. Resolution by host
 * (`Institution.primaryDomain`, plan/03 "Tenant por host", PRODUCT_DECISIONS #3) comes back
 * when there is a second institution; the middleware already forwards `x-tenant-host` for it.
 */

/** Slug of the only Institution row the app serves for now. Created by §10's script. */
export const COLOMBIA_ESTUDIA = 'colombia-estudia';
