/**
 * Tests for buildDemoInstitution and related pure functions.
 * Run with: pnpm --filter @colombia-estudia/scripts test:unit
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDemoInstitution,
  parseName,
  validatePassword,
  TENANT_SLUG,
  type CreateInstitutionArgs,
} from './build.js';

describe('parseName', () => {
  it('parses "Jhonny Admin" into given and family', () => {
    const result = parseName('Jhonny Admin');
    assert.equal(result.givenName, 'Jhonny');
    assert.equal(result.familyName, 'Admin');
  });

  it('parses "Jhonny" (single name) into given with empty family', () => {
    const result = parseName('Jhonny');
    assert.equal(result.givenName, 'Jhonny');
    assert.equal(result.familyName, '');
  });

  it('parses "Juan Carlos Garcia Lopez" into given and multi-word family', () => {
    const result = parseName('Juan Carlos Garcia Lopez');
    assert.equal(result.givenName, 'Juan');
    assert.equal(result.familyName, 'Carlos Garcia Lopez');
  });

  it('handles extra whitespace', () => {
    const result = parseName('  Jhonny   Admin  ');
    assert.equal(result.givenName, 'Jhonny');
    assert.equal(result.familyName, 'Admin');
  });

  it('handles empty string', () => {
    const result = parseName('');
    assert.equal(result.givenName, '');
    assert.equal(result.familyName, '');
  });
});

describe('validatePassword', () => {
  it('returns error for undefined password', () => {
    const result = validatePassword(undefined);
    assert.equal(result, 'ADMIN_PASSWORD is required');
  });

  it('returns error for empty password', () => {
    const result = validatePassword('');
    assert.equal(result, 'ADMIN_PASSWORD is required');
  });

  it('returns error for password shorter than 12 characters', () => {
    const result = validatePassword('short');
    assert.equal(result, 'ADMIN_PASSWORD must be at least 12 characters');
  });

  it('returns undefined for valid password (12 chars)', () => {
    const result = validatePassword('123456789012');
    assert.equal(result, undefined);
  });

  it('returns undefined for valid password (longer)', () => {
    const result = validatePassword('this-is-a-secure-password');
    assert.equal(result, undefined);
  });
});

describe('buildDemoInstitution', () => {
  const args: CreateInstitutionArgs = {
    domain: 'staging.colombiaestudia.co',
    adminEmail: 'admin@colombiaestudia.co',
    adminName: 'Jhonny Admin',
    supportEmail: 'soporte@colombiaestudia.co',
  };

  it('uses the correct tenant slug', () => {
    const result = buildDemoInstitution(args);
    assert.equal(result.institution.slug, TENANT_SLUG);
    assert.equal(result.institution.slug, 'colombia-estudia');
  });

  it('builds institution with correct fields', () => {
    const result = buildDemoInstitution(args);
    assert.equal(result.institution.name, 'Colombia Estudia (demo)');
    assert.equal(result.institution.primaryDomain, 'staging.colombiaestudia.co');
    assert.equal(result.institution.supportEmail, 'soporte@colombiaestudia.co');
    assert.equal(result.institution.emailFromName, 'Colombia Estudia (demo)');
    assert.equal(result.institution.dataPolicyVersion, '1');
  });

  it('parses admin name correctly', () => {
    const result = buildDemoInstitution(args);
    assert.equal(result.admin.givenName, 'Jhonny');
    assert.equal(result.admin.familyName, 'Admin');
    assert.equal(result.admin.email, 'admin@colombiaestudia.co');
  });

  it('builds demo program', () => {
    const result = buildDemoInstitution(args);
    assert.equal(result.program.code, 'DEMO');
    assert.equal(result.program.name, 'Programa demo');
  });

  it('sets audit log fields for institution creation', () => {
    const result = buildDemoInstitution(args);
    assert.equal(result.auditEntity, 'institution');
    assert.equal(result.auditAction, 'created');
  });
});

describe('TENANT_SLUG', () => {
  it('matches the expected value', () => {
    assert.equal(TENANT_SLUG, 'colombia-estudia');
  });
});
