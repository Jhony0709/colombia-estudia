#!/usr/bin/env node
/**
 * Create demo institution with ADMIN and empty program.
 * SSOT: plan/02-fundaciones.md §10
 *
 * Usage:
 *   ADMIN_PASSWORD='...' pnpm --filter @colombia-estudia/scripts \
 *     institution:create \
 *     --domain staging.colombiaestudia.co \
 *     --admin-email admin@colombiaestudia.co \
 *     --admin-name "Jhonny Admin" \
 *     --support-email soporte@colombiaestudia.co
 *
 * --dry-run: Show what would be created without touching database or auth.
 */

import { parseArgs } from 'node:util';
import {
  buildDemoInstitution,
  validatePassword,
  TENANT_SLUG,
  type CreateInstitutionArgs,
} from './build.js';

const { values } = parseArgs({
  options: {
    domain: { type: 'string' },
    'admin-email': { type: 'string' },
    'admin-name': { type: 'string' },
    'support-email': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(`
Usage: institution:create [options]

Options:
  --domain         Primary domain of the institution (required)
  --admin-email    Email of the ADMIN user (required)
  --admin-name     "Given Family" name of the ADMIN (required)
  --support-email  Support email shown in the UI (required)
  --dry-run        Show what would be created without database access
  -h, --help       Show this help message

Environment:
  ADMIN_PASSWORD   Password for the ADMIN user (min 12 chars, required)
  DATABASE_URL     Prisma connection string (required unless --dry-run)
  SUPABASE_URL     Supabase project URL (required unless --dry-run)
  SUPABASE_SECRET_KEY  Supabase service role key (required unless --dry-run)
`);
  process.exit(0);
}

// Validate required args
const requiredArgs = ['domain', 'admin-email', 'admin-name', 'support-email'] as const;
const missingArgs = requiredArgs.filter((arg) => !values[arg]);
if (missingArgs.length > 0) {
  console.error(`Missing required arguments: ${missingArgs.join(', ')}`);
  process.exit(1);
}

const args: CreateInstitutionArgs = {
  domain: values.domain!,
  adminEmail: values['admin-email']!,
  adminName: values['admin-name']!,
  supportEmail: values['support-email']!,
};

const password = process.env.ADMIN_PASSWORD;
const passwordError = validatePassword(password);
if (passwordError && !values['dry-run']) {
  console.error(passwordError);
  process.exit(1);
}

const data = buildDemoInstitution(args);

if (values['dry-run']) {
  console.log('=== DRY RUN ===');
  console.log('\nWould create Institution:');
  console.log(JSON.stringify(data.institution, null, 2));
  console.log('\nWould create Person (ADMIN):');
  console.log(JSON.stringify(data.admin, null, 2));
  console.log('\nWould create Membership: role=ADMIN');
  console.log('\nWould create Program:');
  console.log(JSON.stringify(data.program, null, 2));
  console.log('\nWould create AuditLog: entity=institution, action=created');
  console.log('\n=== END DRY RUN ===');
  process.exit(0);
}

// Dynamic imports to avoid instantiating clients during --dry-run
const { PrismaClient } = await import('@prisma/client');
const { createClient } = await import('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY are required');
  process.exit(1);
}

const prisma = new PrismaClient();
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Idempotency check
  const existing = await prisma.institution.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true, name: true, primaryDomain: true },
  });

  if (existing) {
    console.log(`Institution already exists:`);
    console.log(`  id: ${existing.id}`);
    console.log(`  name: ${existing.name}`);
    console.log(`  domain: ${existing.primaryDomain ?? '(none)'}`);
    console.log('\nNo changes made.');
    process.exit(0);
  }

  // Create Supabase Auth user
  console.log(`Creating Supabase Auth user: ${data.admin.email}`);
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.admin.email,
    password: password!,
    email_confirm: true,
  });

  if (authError) {
    if (authError.code === 'email_exists') {
      console.error(`Error: Email ${data.admin.email} already has a Supabase Auth account.`);
      console.error('Use a different email or delete the existing auth user first.');
      process.exit(1);
    }
    console.error(`Supabase Auth error: ${authError.message}`);
    process.exit(1);
  }

  const authUserId = authData.user.id;
  console.log(`Created Auth user: ${authUserId}`);

  // Transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      const institution = await tx.institution.create({
        data: {
          slug: data.institution.slug,
          name: data.institution.name,
          primaryDomain: data.institution.primaryDomain,
          supportEmail: data.institution.supportEmail,
          emailFromName: data.institution.emailFromName,
          dataPolicyVersion: data.institution.dataPolicyVersion,
        },
      });
      console.log(`Created Institution: ${institution.id}`);

      const person = await tx.person.create({
        data: {
          institutionId: institution.id,
          givenName: data.admin.givenName,
          familyName: data.admin.familyName,
          email: data.admin.email,
          authUserId,
        },
      });
      console.log(`Created Person: ${person.id}`);

      const membership = await tx.membership.create({
        data: {
          institutionId: institution.id,
          personId: person.id,
          role: 'ADMIN',
        },
      });
      console.log(`Created Membership: ${membership.id} (ADMIN)`);

      const program = await tx.program.create({
        data: {
          institutionId: institution.id,
          code: data.program.code,
          name: data.program.name,
        },
      });
      console.log(`Created Program: ${program.id}`);

      await tx.auditLog.create({
        data: {
          institutionId: institution.id,
          actorId: person.id,
          entity: data.auditEntity,
          entityId: institution.id,
          action: data.auditAction,
        },
      });
      console.log(`Created AuditLog: institution created`);

      return { institution, person, program };
    });

    console.log('\n=== SUCCESS ===');
    console.log(`Institution ID: ${result.institution.id}`);
    console.log(`Admin Person ID: ${result.person.id}`);
    console.log(`Program ID: ${result.program.id}`);
    console.log(`\nNext step: Log in at https://${data.institution.primaryDomain}/auth/login`);
  } catch (error) {
    console.error('Transaction failed, rolling back Auth user...');
    await supabase.auth.admin.deleteUser(authUserId);
    console.error('Auth user deleted.');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
