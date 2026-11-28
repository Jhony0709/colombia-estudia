import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  Badge,
  Button,
  Card,
  Disclosure,
  EmptyState,
  ListItem,
  Message,
  Row,
  Skeleton,
  Stack,
  Swap,
  Text,
} from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { ApiError } from '../api';
import { copy } from '../copy';
import { longDate, money } from '../learn/format';
import { WebLink } from '../ui/WebLink';
import { getAccounts, pay, type Account } from './api';

const t = copy.account;
const STATUS_TONE = {
  CURRENT: 'success',
  OVERDUE: 'danger',
  IN_AGREEMENT: 'info',
  PARTNER_PAID: 'neutral',
} as const;
const INSTALLMENT_TONE = {
  OPEN: 'neutral',
  PARTIALLY_PAID: 'info',
  PAID: 'success',
  VOID: 'neutral',
} as const;

type Loaded = { accounts: Account[]; onlinePayment: boolean } | 'none';

function AccountCard({
  account,
  online,
  reload,
}: {
  account: Account;
  online: boolean;
  reload: () => Promise<unknown>;
}) {
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const next = account.summary.next;
  const opens = account.installments.find((i) => i.id === next?.id)?.unlocks ?? [];
  const agreement = account.agreements.find((a) => a.status === 'ACTIVE');

  // La cuota la elige el servidor (`summary.next`); la app solo abre el pago.
  const start = async (delivery: 'redirect' | 'email') => {
    setNotice(null);
    try {
      const answer = await pay(next!.id, delivery);
      if (delivery === 'email') return setNotice({ tone: 'success', text: t.payEmailSent });
      await WebBrowser.openBrowserAsync(answer.url);
      await reload();
    } catch (error) {
      setNotice({ tone: 'danger', text: t.payError });
      throw error;
    }
  };

  return (
    <Card>
      <Stack gap="3">
        <Row wrap justify="space-between">
          <Text variant="title">{account.cohort.programName}</Text>
          {account.status && (
            <Badge tone={STATUS_TONE[account.status]}>{t.statuses[account.status]}</Badge>
          )}
        </Row>
        <Text tone="muted">
          {next
            ? t.nextInstallment(next.position, money(next.amount), longDate(next.dueOn))
            : t.allPaid}
        </Text>
        {agreement && <Text>{t.agreementActive(longDate(agreement.signedAt))}</Text>}
        {next && opens.length > 0 && <Text>{t.opens(next.position, opens.join(', '))}</Text>}
        {notice && <Message tone={notice.tone}>{notice.text}</Message>}
        {next && online && (
          <>
            <Button variant="primary" onPress={() => start('redirect')}>
              {t.payOnline}
            </Button>
            <Button variant="secondary" onPress={() => start('email')}>
              {t.payByEmail}
            </Button>
          </>
        )}
        {next && <WebLink path="/aprender/mi-cuenta">{t.transferData}</WebLink>}
        <Disclosure title={t.installments}>
          <Stack gap="1">
            {account.installments
              .filter((i) => i.status !== 'VOID')
              .map((i) => (
                <ListItem
                  key={i.id}
                  title={`${t.installment(i.position)} · ${money(i.amount)}`}
                  description={t.dueOn(longDate(i.dueOn))}
                  trailing={
                    <Badge tone={i.overdue ? 'danger' : INSTALLMENT_TONE[i.status]} look="dot">
                      {i.overdue ? t.overdue : t.installmentStatuses[i.status]}
                    </Badge>
                  }
                />
              ))}
          </Stack>
        </Disclosure>
        <Disclosure title={t.payments}>
          {account.payments.filter((p) => !p.voidedAt).length === 0 ? (
            <Text tone="muted">{t.noPayments}</Text>
          ) : (
            <Stack gap="1">
              {account.payments
                .filter((p) => !p.voidedAt)
                .map((p) => (
                  <ListItem
                    key={p.id}
                    title={`${t.installment(p.installmentPosition)} · ${money(p.amount)}`}
                    description={`${t.methods[p.method]} · ${longDate(p.paidAt)}`}
                    trailing={
                      <Badge tone={p.confirmedAt ? 'success' : 'warning'} look="dot">
                        {p.confirmedAt ? t.confirmed : t.processing}
                      </Badge>
                    }
                  />
                ))}
            </Stack>
          )}
        </Disclosure>
      </Stack>
    </Card>
  );
}

/** Mi cuenta y pagar (reference/03-ui/movil.md, M2). */
export function AccountScreen() {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    () =>
      getAccounts().then(
        (next) => {
          setData(next);
          setFailed(false);
        },
        (error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return setData('none');
          setFailed(true);
          throw error;
        }
      ),
    []
  );
  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );
  // En Android el navegador de la app no espera a cerrarse: se vuelve a pedir al volver.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (now) => {
      if (now === 'active') load().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [load]);

  return (
    <Screen scroll>
      <Text variant="heading">{t.title}</Text>
      <Text tone="muted">{t.description}</Text>
      {failed && (
        <>
          <Message tone="danger">{copy.loadFailed}</Message>
          <Button variant="secondary" onPress={load}>
            {copy.retry}
          </Button>
        </>
      )}
      <Swap id={data === null ? 'loading' : data === 'none' ? 'none' : 'accounts'}>
        {data === null ? (
          <Stack>
            <Skeleton height={180} />
            <Skeleton height={56} />
          </Stack>
        ) : data === 'none' ? (
          <EmptyState title={t.empty}>{t.emptyHint}</EmptyState>
        ) : (
          <Stack gap="4">
            {data.accounts.map((account) => (
              <AccountCard
                key={account.enrollmentId}
                account={account}
                online={data.onlinePayment}
                reload={load}
              />
            ))}
          </Stack>
        )}
      </Swap>
    </Screen>
  );
}
