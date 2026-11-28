import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Message,
  Row,
  Skeleton,
  Stack,
  Swap,
  Tabs,
  Text,
  useTheme,
} from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { ApiError } from '../api';
import { copy } from '../copy';
import { ago } from '../messages/time';
import { WebLink } from '../ui/WebLink';
import {
  dismissRequest,
  grantAttempt,
  listRequests,
  unlockModule,
  type RequestRow,
  type RequestsView,
} from './api';

const t = copy.requests;
const VIEWS: RequestsView[] = ['pending', 'closed'];

/** Lo pulsado: qué hacer y qué decir cuando sale bien. */
type Act = (action: () => Promise<unknown>, done: string) => Promise<void>;

function what(row: RequestRow): { title: string; context: string } {
  const { cohort, module } = row;
  if (row.kind === 'ENROLL') {
    return {
      title: t.kind.ENROLL(cohort.programName),
      context: t.kind.ENROLLContext(cohort.code, module.name),
    };
  }
  if (row.kind === 'ATTEMPT') {
    return {
      title: t.kind.ATTEMPT(row.assessment?.title ?? module.name),
      context: t.kind.ATTEMPTContext(module.name, cohort.code),
    };
  }
  return {
    title: t.kind.UNLOCK(module.name),
    context: t.kind.UNLOCKContext(cohort.programName, cohort.code),
  };
}

/** Lo que hace falta saber para decidir; la cartera la cuenta el servidor. */
function ForDeciding({ row }: { row: RequestRow }) {
  if (row.kind === 'ENROLL') {
    return row.person.isMinor && !row.person.hasGuardian ? (
      <Badge tone="warning">{t.context.minorNoGuardian}</Badge>
    ) : (
      <Text variant="caption" tone="muted">
        {t.context.noEnrollment}
      </Text>
    );
  }
  if (!row.billing) {
    return (
      <Text variant="caption" tone="muted">
        {t.context.noPlan}
      </Text>
    );
  }
  if (row.billing.overdue === 0) return <Badge tone="success">{t.context.upToDate}</Badge>;
  return (
    <WebLink path={`/cartera/${row.enrollmentId}`}>
      {t.context.overdue(row.billing.overdue)}
    </WebLink>
  );
}

function Actions({ row, act }: { row: RequestRow; act: Act }) {
  const [confirming, setConfirming] = useState(false);
  const { module } = row;
  // Dentro de `Swap`: la tarjeta cambia de alto sin saltar.
  return (
    <Swap id={confirming ? 'confirm' : 'actions'}>
      {confirming ? (
        <Row wrap>
          <Button
            variant="danger"
            onPress={() => act(() => dismissRequest(row.id), t.actions.dismissed)}
          >
            {t.actions.confirmDismiss}
          </Button>
          <Button variant="ghost" onPress={() => setConfirming(false)}>
            {t.actions.cancel}
          </Button>
        </Row>
      ) : (
        <Stack gap="2">
          {row.kind === 'ENROLL' &&
            (row.cohort.open ? (
              // La hoja de matrícula pide pantalla grande.
              <WebLink path="/solicitudes">{t.actions.enrollOnWeb}</WebLink>
            ) : (
              <Text variant="caption" tone="muted">
                {t.actions.cohortClosed}
              </Text>
            ))}
          {row.kind === 'ATTEMPT' && (
            <Button
              variant="primary"
              onPress={() =>
                act(
                  () => grantAttempt(row.id),
                  t.actions.granted(row.assessment?.title ?? module.name)
                )
              }
            >
              {t.actions.grant}
            </Button>
          )}
          {row.kind === 'UNLOCK' && row.enrollmentId && (
            <>
              <Button
                variant="primary"
                onPress={() =>
                  act(
                    () => unlockModule(row.enrollmentId!, module.id),
                    t.actions.unlocked(module.name)
                  )
                }
              >
                {t.actions.unlock}
              </Button>
              <WebLink
                path={`/cohortes/${row.cohort.id}/matriculas/${row.enrollmentId}#componentes`}
              >
                {t.actions.withDates}
              </WebLink>
            </>
          )}
          <Button variant="ghost" onPress={() => setConfirming(true)}>
            {t.actions.dismiss}
          </Button>
        </Stack>
      )}
    </Swap>
  );
}

function RequestCard({ row, act }: { row: RequestRow; act: Act }) {
  const { title, context } = what(row);
  return (
    <Card>
      <Stack gap="2">
        <Text weight="medium">{row.person.name}</Text>
        <Text>{title}</Text>
        <Text variant="caption" tone="muted">
          {context}
        </Text>
        {row.kind === 'ATTEMPT' && row.whatsappAt && (
          <Text variant="caption" tone="muted">
            {t.kind.wroteOnWhatsApp(ago(row.whatsappAt))}
          </Text>
        )}
        {row.status === 'PENDING' ? (
          <>
            <Text variant="caption" tone="muted">
              {ago(row.createdAt)}
            </Text>
            <ForDeciding row={row} />
            <Actions row={row} act={act} />
          </>
        ) : (
          <Text variant="caption" tone="muted">
            {`${t.status[row.status](row.resolvedByName)}${row.resolvedAt ? ` · ${ago(row.resolvedAt)}` : ''}`}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

/** Lo que piden los estudiantes (reference/03-ui/movil.md, M1, «Solicitudes»). */
export function Requests() {
  const theme = useTheme();
  const [view, setView] = useState<RequestsView>('pending');
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const shown = useRef(view);
  useEffect(() => {
    shown.current = view;
  }, [view]);

  // Una respuesta de la pestaña anterior que llega tarde no pisa la actual.
  const load = useCallback(
    (which: RequestsView = view) =>
      listRequests(which).then(
        (next) => {
          if (shown.current !== which) return;
          setRows(next);
          setFailed(false);
        },
        () => {
          if (shown.current === which) setFailed(true);
        }
      ),
    [view]
  );
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const act: Act = async (action, done) => {
    setNotice(null);
    try {
      await action();
    } catch (error) {
      // CONFLICT trae el motivo del servidor: otra persona ya la cerró.
      const conflict = error instanceof ApiError && error.status === 409;
      setNotice({ tone: 'danger', text: conflict ? error.message : copy.actionFailed });
      if (conflict) await load();
      throw error;
    }
    setNotice({ tone: 'success', text: done });
    await load();
  };

  return (
    <Screen scroll>
      <Text variant="heading">{t.title}</Text>
      <Tabs
        label={t.title}
        items={VIEWS.map((key) => ({ key, label: t.views[key] }))}
        value={view}
        onChange={(key) => {
          const next = key as RequestsView;
          shown.current = next;
          setView(next);
          setNotice(null);
          return load(next);
        }}
      />
      {notice && <Message tone={notice.tone}>{notice.text}</Message>}
      {failed && (
        <>
          <Message tone="danger">{copy.loadFailed}</Message>
          <Button variant="secondary" onPress={() => load()}>
            {copy.retry}
          </Button>
        </>
      )}
      <Swap id={rows === null ? 'loading' : `${view}:${rows.length === 0 ? 'empty' : 'rows'}`}>
        {rows === null ? (
          <Stack>
            <Skeleton height={160} />
            <Skeleton height={160} />
          </Stack>
        ) : rows.length === 0 ? (
          view === 'pending' ? (
            <EmptyState title={t.empty}>{t.emptyHint}</EmptyState>
          ) : (
            <EmptyState title={t.emptyClosed} />
          )
        ) : (
          <View style={{ gap: theme.size['space.3'] }}>
            {rows.map((row) => (
              <RequestCard key={row.id} row={row} act={act} />
            ))}
          </View>
        )}
      </Swap>
    </Screen>
  );
}
