import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Accordion,
  Badge,
  Button,
  Card,
  EmptyState,
  ListItem,
  Message,
  Progress,
  Row,
  Select,
  Skeleton,
  Stack,
  Swap,
  Text,
} from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { copy } from '../copy';
import { setUnread } from '../notifications/unread';
import { PushCard } from '../push/PushCard';
import { useSession } from '../SessionProvider';
import { openWeb } from '../ui/WebLink';
import {
  getOutline,
  listEnrollments,
  onWeb,
  unreadNotifications,
  webPathOf,
  type CohortOutline,
  type MyEnrollment,
  type RouteItem,
  type RouteModule,
} from './api';
import { longDate, money } from './format';
import { gateText } from './gates';

const t = copy.learn;

/** Por qué una etapa no está abierta; lo decide el servidor (`access`, `installment`). */
function accessText(module: RouteModule): string | null {
  const { access } = module;
  if (access.state === 'OPEN') return null;
  if (access.state === 'NOT_YET') return t.moduleAccess.NOT_YET(longDate(access.from));
  if (access.state === 'CLOSED') return t.moduleAccess.CLOSED(longDate(access.until));
  return module.installment
    ? t.moduleAccess.INSTALLMENT(module.installment.position, money(module.installment.amount))
    : t.moduleAccess.LOCKED;
}

function itemDescription(item: RouteItem): string {
  const what = [
    item.form ? t.form[item.form] : null,
    item.estimatedMinutes ? t.minutes(item.estimatedMinutes) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const why = !item.enabled
    ? item.blockedBy
      ? t.blockedBy(item.blockedBy)
      : item.unavailableReason === 'NOT_YET'
        ? t.notYet
        : item.unavailableReason === 'CLOSED'
          ? t.closed
          : t.lockedModule
    : onWeb(item)
      ? t.onWeb
      : null;
  return [what, why].filter(Boolean).join('. ');
}

const TONE = { NOT_STARTED: 'neutral', IN_PROGRESS: 'info', COMPLETED: 'success' } as const;

function Step({ item }: { item: RouteItem }) {
  const router = useRouter();
  const open = !item.enabled
    ? undefined
    : onWeb(item)
      ? () => openWeb(webPathOf(item))
      : () => router.push(`/aprender/tema/${item.assignmentId}`);
  return (
    <ListItem
      title={item.title}
      description={itemDescription(item)}
      trailing={
        <Badge tone={TONE[item.status]} look="dot">
          {t.status[item.status]}
        </Badge>
      }
      onPress={open}
    />
  );
}

function Modules({ modules, resume }: { modules: RouteModule[]; resume: RouteItem | null }) {
  const current = modules.find((m) => m.items.some((i) => i.assignmentId === resume?.assignmentId));
  return (
    <Accordion
      defaultOpen={current ? [current.id] : []}
      items={modules.map((module) => {
        const why = accessText(module);
        return {
          key: module.id,
          title: why ? `${module.name} · ${t.moduleLocked}` : module.name,
          content: (
            <Stack>
              {why && <Message tone="info">{why}</Message>}
              {module.items.length === 0 ? (
                <Text tone="muted">{t.moduleEmpty}</Text>
              ) : (
                module.items.map((item) => <Step key={item.assignmentId} item={item} />)
              )}
            </Stack>
          ),
        };
      })}
    />
  );
}

function Outline({ outline }: { outline: CohortOutline }) {
  const router = useRouter();
  if (outline.gate) {
    const { title, body } = gateText(outline.gate);
    return <EmptyState title={title}>{body}</EmptyState>;
  }
  const { cohort, progress, resume } = outline;
  return (
    <Stack gap="4">
      {cohort && (
        <Card>
          <Stack>
            <Row wrap justify="space-between">
              <Text variant="title">{cohort.programName}</Text>
              {cohort.programFree && <Badge tone="success">{t.free}</Badge>}
            </Row>
            <Text tone="muted">{cohort.name}</Text>
            <Progress
              value={progress.completed}
              max={Math.max(progress.total, 1)}
              label={t.progressLabel(cohort.programName)}
            />
            <Text variant="caption" tone="muted">
              {t.progress(progress.completed, progress.total)}
            </Text>
            {resume?.enabled && (
              <Button
                variant="primary"
                onPress={() =>
                  onWeb(resume)
                    ? openWeb(webPathOf(resume))
                    : router.push(`/aprender/tema/${resume.assignmentId}`)
                }
              >
                {t.resume(resume.title)}
              </Button>
            )}
          </Stack>
        </Card>
      )}
      {outline.partnerFunded && <Message tone="info">{t.partnerFunded}</Message>}
      {outline.awaitingPlan && (
        <Message tone="info" title={t.noPlan}>
          {t.noPlanBody}
        </Message>
      )}
      <Modules modules={outline.modules} resume={resume} />
    </Stack>
  );
}

// Avisos, Calendario y Mi cuenta están en las pestañas; las constancias, aquí.
function More() {
  const router = useRouter();
  return (
    <Stack gap="1">
      <Text variant="title">{t.more}</Text>
      <ListItem title={t.certificates} onPress={() => router.push('/aprender/certificados')} />
    </Stack>
  );
}

/** Mi ruta, el inicio del estudiante (reference/03-ui/movil.md, M2). */
export function Route() {
  const { signOut } = useSession();
  const [enrollments, setEnrollments] = useState<MyEnrollment[]>([]);
  // La matrícula elegida no es estado: cambiarla no debe volver a disparar la carga del foco.
  const picked = useRef<string | null>(null);
  const [outline, setOutline] = useState<CohortOutline | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (enrollmentId: string | null = picked.current) => {
    try {
      const [list, next] = await Promise.all([listEnrollments(), getOutline(enrollmentId)]);
      setEnrollments(list);
      setOutline(next);
      setFailed(false);
    } catch (error) {
      setFailed(true);
      throw error;
    }
    // Lo que no sea el contenido no detiene la pantalla.
    unreadNotifications().then(setUnread, () => undefined);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  return (
    <Screen scroll>
      <Row justify="space-between" wrap>
        <Text variant="heading">{t.title}</Text>
        <Button variant="ghost" onPress={signOut}>
          {copy.signOut}
        </Button>
      </Row>
      {enrollments.length > 1 && (
        <Select
          label={t.program}
          value={outline?.enrollmentId ?? null}
          options={enrollments.map((e) => ({
            value: e.enrollmentId,
            label: e.cohort.programName,
            description: e.cohort.name,
          }))}
          onChange={(value) => {
            picked.current = value;
            return load(value);
          }}
        />
      )}
      {failed && (
        <>
          <Message tone="danger">{copy.loadFailed}</Message>
          <Button variant="secondary" onPress={() => load()}>
            {copy.retry}
          </Button>
        </>
      )}
      <Swap id={outline ? `outline:${outline.enrollmentId ?? 'none'}` : 'loading'}>
        {outline ? (
          <Outline outline={outline} />
        ) : (
          <Stack>
            <Skeleton height={160} />
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Stack>
        )}
      </Swap>
      <PushCard body={copy.push.student} />
      <More />
    </Screen>
  );
}
