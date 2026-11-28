import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Badge,
  Button,
  EmptyState,
  ListItem,
  Message,
  Skeleton,
  Stack,
  Swap,
  Text,
} from '@fluxus-ui/native';
import { Screen } from '@fluxus-ui/native/screen';
import { request } from '../api';
import { copy } from '../copy';
import { longDate } from '../learn/format';
import { openWeb } from '../ui/WebLink';

const t = copy.certificates;

// `CertificateView` de apps/web/features/certificates/server/certificates.service.ts.
export interface Certificate {
  id: string;
  code: string;
  kind: 'MODULE' | 'PROGRAM';
  moduleName: string | null;
  programName: string;
  issuedAt: string;
  revokedAt: string | null;
}

export const getCertificates = () => request<Certificate[]>('/api/learn/certificates');

/** Constancias (reference/03-ui/movil.md, M2): cada una se abre en su página pública. */
export function CertificatesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Certificate[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    () =>
      getCertificates().then(
        (next) => {
          setItems(next);
          setFailed(false);
        },
        (error: unknown) => {
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

  return (
    <Screen scroll>
      <Button variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.back()}>
        {copy.learn.lesson.back}
      </Button>
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
      <Swap id={items === null ? 'loading' : items.length === 0 ? 'empty' : 'list'}>
        {items === null ? (
          <Stack>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Stack>
        ) : items.length === 0 ? (
          <EmptyState title={t.empty}>{t.emptyHint}</EmptyState>
        ) : (
          <Stack gap="1">
            {items.map((item) => (
              <ListItem
                key={item.id}
                title={
                  item.kind === 'MODULE' && item.moduleName ? item.moduleName : item.programName
                }
                description={[
                  item.kind === 'MODULE' ? t.kindModule : t.kindProgram,
                  t.issuedOn(longDate(item.issuedAt)),
                  t.code(item.code),
                ].join(' · ')}
                trailing={item.revokedAt ? <Badge tone="danger">{t.revoked}</Badge> : undefined}
                accessibilityHint={t.open}
                onPress={() => openWeb(`/certificado/${item.code}`)}
              />
            ))}
          </Stack>
        )}
      </Swap>
    </Screen>
  );
}
