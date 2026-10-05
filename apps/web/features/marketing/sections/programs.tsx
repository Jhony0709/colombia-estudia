import { getTranslations } from 'next-intl/server';
import { ArrowRight, Award, BookOpen, Compass, UsersRound } from 'lucide-react';
import { SiteContainer } from '../site-container';
import { PhotoMask } from '../brand/photo-mask';
import { FEATURED_PROGRAM, PROGRAM_SERVICES } from '../content';
import { Reveal } from '../motion/Reveal';
import { Stagger } from '../motion/Stagger';
import { motionTokens } from '../motion/tokens';
import type { ContactLink } from '../contact-links';

const SERVICE_ICON = { start: Compass, tutor: UsersRound, diploma: Award } as const;

/**
 * «Encuentra el camino que se adapta a ti» (ALBA, 5/10) sobre azul muy claro. El programa real
 * (bachillerato acelerado) es la tarjeta navy que ocupa ~42 % del ancho, con su foto; las otras
 * tres son servicios que vienen con él, no productos inventados. En el teléfono, una columna.
 *
 * Movimiento («aparece un camino»): las tarjetas entran escalonadas (80 ms, 24 px). Al pasar el
 * ratón, las de servicio suben 4 px; la navy no sube: su foto se acerca y el círculo crece.
 */
export async function Programs({ contact }: { contact: ContactLink }) {
  const t = await getTranslations('landing.programs');
  const program = FEATURED_PROGRAM.key;
  const external = contact.external ? { target: '_blank', rel: 'noreferrer' } : {};
  return (
    <section
      id="programas"
      aria-labelledby="programas-title"
      className="scroll-mt-20 bg-[var(--site-tint)] pb-16 pt-6 lg:pb-24 lg:pt-10"
    >
      <SiteContainer>
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-3">
            <p className="site-eyebrow m-0">{t('eyebrow')}</p>
            <h2 id="programas-title" className="site-h2 m-0 max-w-[36rem]">
              {t('title')}
            </h2>
          </div>
          <a
            href={contact.href}
            {...external}
            className="site-btn site-btn--secondary site-btn--sm"
          >
            {t('link')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </Reveal>

        <Stagger
          as="ul"
          step={motionTokens.stagger.base}
          className="m-0 mt-10 grid list-none gap-5 p-0 md:grid-cols-2 lg:grid-cols-[minmax(0,1.9fr)_repeat(3,minmax(0,1fr))]"
        >
          <li className="site-on-dark site-card--lg site-program-feature relative grid overflow-hidden bg-[var(--site-navy)] sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:col-span-2 lg:col-span-1">
            <div className="flex flex-col gap-4 p-6 sm:p-7">
              <BookOpen aria-hidden="true" className="size-8 text-[var(--site-yellow)]" />
              <h3 className="site-h3 m-0 !text-[1.25rem]">{t(`featured.${program}.name`)}</h3>
              <Tags tags={t.raw(`featured.${program}.tags`) as string[]} />
              <p className="site-small m-0">{t(`featured.${program}.description`)}</p>
              <a
                href={contact.href}
                {...external}
                aria-label={t(`featured.${program}.cta`)}
                className="site-round mt-auto bg-[var(--site-yellow)] text-[var(--site-navy)] hover:bg-[var(--site-yellow-hover)]"
              >
                <ArrowRight aria-hidden="true" className="size-5" />
              </a>
            </div>
            <PhotoMask
              id={FEATURED_PROGRAM.media}
              shape="arch"
              className="hidden aspect-auto h-full min-h-[18rem] sm:block"
              sizes="(min-width: 1024px) 16vw, 40vw"
            />
          </li>

          {PROGRAM_SERVICES.map(({ key, href }) => {
            const Icon = SERVICE_ICON[key];
            return (
              <li key={key} className="site-card site-card--lg site-lift flex flex-col gap-4 p-6">
                <Icon aria-hidden="true" className="size-8 text-[var(--site-blue)]" />
                <h3 className="site-h3 m-0">{t(`services.${key}.title`)}</h3>
                <Tags tags={t.raw(`services.${key}.tags`) as string[]} />
                <p className="site-small m-0">{t(`services.${key}.body`)}</p>
                <a
                  href={href}
                  aria-label={t(`services.${key}.cta`)}
                  className="site-round mt-auto border border-[var(--site-line)] text-[var(--site-blue)] hover:border-[var(--site-blue)]"
                >
                  <ArrowRight aria-hidden="true" className="size-5" />
                </a>
              </li>
            );
          })}
        </Stagger>
      </SiteContainer>
    </section>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {tags.map((tag) => (
        <li key={tag} className="site-tag">
          {tag}
        </li>
      ))}
    </ul>
  );
}
