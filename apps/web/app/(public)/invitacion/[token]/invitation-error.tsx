/**
 * Invitation error component.
 * SSOT: plan/03-identidad-y-acceso.md §9c
 *
 * Shows error state and appropriate actions based on error type.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Alert } from '@/components/atoms/alert';
import type { InvitationStatus } from '@/lib/invitations/validate-token';

interface Props {
  status: Exclude<InvitationStatus, 'valid'>;
  token: string;
}

export default function InvitationError({ status, token }: Props) {
  const t = useTranslations('invitation');
  const [requestSent, setRequestSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function handleRequestNew() {
    setLoading(true);
    try {
      await fetch(`/api/invitations/${token}/request-new`, {
        method: 'POST',
      });
      setRequestSent(true);
    } finally {
      setLoading(false);
    }
  }

  const getMessage = () => {
    switch (status) {
      case 'expired':
        return t('expired');
      case 'used':
        return t('used');
      case 'already_registered':
        return t('alreadyRegistered');
      case 'not_found':
      default:
        return t('notFound');
    }
  };

  const showRequestNew = status === 'expired' || status === 'used';
  const showLoginLink = status === 'already_registered';

  if (requestSent) {
    return (
      <section>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="type-heading text-text text-center outline-none"
        >
          {t('requestSent')}
        </h1>
        <Alert severity="success">{t('requestSentDetail')}</Alert>
      </section>
    );
  }

  return (
    <section>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="type-heading text-text text-center outline-none"
      >
        {t('errorTitle')}
      </h1>

      <Alert severity="error">{getMessage()}</Alert>

      <div className="flex flex-col items-center gap-4 pt-4">
        {showRequestNew && (
          <Button onClick={handleRequestNew} loading={loading}>
            {t('requestNew')}
          </Button>
        )}

        {showLoginLink && (
          <Link href="/auth/login">
            <Button variant="secondary">{t('goToLogin')}</Button>
          </Link>
        )}

        {!showRequestNew && !showLoginLink && (
          <Link href="/">
            <Button variant="secondary">{t('goToHome')}</Button>
          </Link>
        )}
      </div>
    </section>
  );
}
