/**
 * La ayuda de la pantalla del tema, para `PageHelp`.
 *
 * Hasta el 19/9 la chuleta del formato era un `details` plegado entre el texto y los
 * minutos: estorbaba a quien ya lo sabía y estaba escondida de quien no. Ahora es un tema de
 * la ayuda contextual, junto a lo que impide publicar y a cómo funcionan los vídeos —las tres
 * preguntas que alguien se hace en esta pantalla, en el orden en que se las hace.
 */

import type { useTranslations } from 'next-intl';
import type { HelpTopic } from '@/components/organisms/page-help';

type T = ReturnType<typeof useTranslations<'editor'>>;

const FORMAT: Array<{ key: Parameters<T>[0]; example: string | null }> = [
  { key: 'helpEmphasis', example: '**negrita**   *cursiva*   `código`' },
  { key: 'helpLink', example: '[Guía de ejercicios](https://…)' },
  { key: 'helpLang', example: ':lang[the text]{lang="en"}' },
  { key: 'helpMath', example: '$x^2$' },
  { key: 'helpHeadings', example: null },
  { key: 'helpVideo', example: null },
  { key: 'helpImage', example: null },
  { key: 'helpTable', example: null },
  { key: 'helpAssets', example: null },
];

export function lessonHelpTopics(t: T, { canPublish }: { canPublish: boolean }): HelpTopic[] {
  return [
    {
      title: t('helpTitle'),
      body: (
        <>
          <p>{t('helpIntro')}</p>
          <ul className="space-y-2">
            {FORMAT.map(({ key, example }) => (
              <li key={key}>
                {example !== null && (
                  <code className="type-caption text-text block whitespace-pre-wrap">
                    {example}
                  </code>
                )}
                <span className="type-caption">{t(key)}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
    {
      title: t('videoTitle'),
      body: <p>{t('videoHint')}</p>,
    },
    {
      title: t('publishTitle'),
      body: (
        <>
          <p>{canPublish ? t('readyToPublish') : t('blockedCapability')}</p>
          <p>{t('videoTranscriptHint')}</p>
        </>
      ),
    },
  ];
}
