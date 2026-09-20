import {
  CONTENT_VERSION_TRANSITIONS,
  EDITABLE_STATUSES,
  PUBLISH_STATUSES,
  canTransition,
  isVersionEditable,
  isVersionLive,
  toPublishStatus,
  type PublishStatus,
} from './transitions';

describe('toPublishStatus', () => {
  it.each(PUBLISH_STATUSES)('keeps %s', (status) => {
    expect(toPublishStatus(status)).toBe(status);
  });

  it('falls back to DRAFT for an unknown value', () => {
    expect(toPublishStatus('WHATEVER')).toBe('DRAFT');
    expect(toPublishStatus('')).toBe('DRAFT');
  });
});

describe('isVersionEditable', () => {
  it('only a draft is editable', () => {
    expect(isVersionEditable('DRAFT')).toBe(true);
    expect(isVersionEditable('PUBLISHED')).toBe(false);
    expect(isVersionEditable('ARCHIVED')).toBe(false);
  });

  it('agrees with EDITABLE_STATUSES', () => {
    for (const status of PUBLISH_STATUSES) {
      expect(isVersionEditable(status)).toBe(EDITABLE_STATUSES.includes(status));
    }
  });
});

describe('isVersionLive', () => {
  it('only a published version is what students read', () => {
    expect(isVersionLive('PUBLISHED')).toBe(true);
    expect(isVersionLive('DRAFT')).toBe(false);
    expect(isVersionLive('ARCHIVED')).toBe(false);
  });
});

describe('canTransition', () => {
  it('publishes a draft', () => {
    expect(canTransition('publish', 'DRAFT')).toEqual({ allowed: true, to: 'PUBLISHED' });
  });

  it('refuses to publish anything that is not a draft', () => {
    expect(canTransition('publish', 'PUBLISHED')).toEqual({
      allowed: false,
      reason: 'WRONG_STATUS',
      from: 'PUBLISHED',
      expected: ['DRAFT'],
    });
    expect(canTransition('publish', 'ARCHIVED')).toMatchObject({ allowed: false });
  });

  it('archives a published version', () => {
    expect(canTransition('archive', 'PUBLISHED')).toEqual({ allowed: true, to: 'ARCHIVED' });
  });

  it('refuses to archive a draft: there is nothing out there to withdraw', () => {
    expect(canTransition('archive', 'DRAFT')).toMatchObject({
      allowed: false,
      reason: 'WRONG_STATUS',
      expected: ['PUBLISHED'],
    });
  });

  it('refuses to archive twice', () => {
    expect(canTransition('archive', 'ARCHIVED')).toMatchObject({ allowed: false });
  });
});

describe('the table itself', () => {
  it('every transition lands on a known status and declares a capability', () => {
    for (const rule of Object.values(CONTENT_VERSION_TRANSITIONS)) {
      expect(PUBLISH_STATUSES).toContain(rule.to);
      expect(rule.from.length).toBeGreaterThan(0);
    }
  });

  it('no transition starts and ends in the same status', () => {
    for (const rule of Object.values(CONTENT_VERSION_TRANSITIONS)) {
      expect(rule.from).not.toContain(rule.to);
    }
  });

  it('every status except the initial one is reachable', () => {
    const reachable = new Set<PublishStatus>(['DRAFT']);
    for (const rule of Object.values(CONTENT_VERSION_TRANSITIONS)) reachable.add(rule.to);
    for (const status of PUBLISH_STATUSES) expect(reachable.has(status)).toBe(true);
  });
});
