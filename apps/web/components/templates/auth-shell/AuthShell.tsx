/**
 * AuthShell: el cascarón de las pantallas de acceso (iniciar sesión, registro, recuperar,
 * restablecer, segundo factor). 23/9; rehecho el 5/10 con la marca ALBA (mockup de Jhonny).
 *
 * Dos columnas desde `lg`. A la izquierda, la foto arriba y un bloque navy abajo que entra con
 * las ondas del isotipo (azul y amarillo), con el titular de la pantalla («Tu historia también
 * puede continuar.», la última palabra en amarillo), una entradilla y tres beneficios. A la
 * derecha, en blanco, el logo centrado, el formulario y una franja de confianza. En el teléfono
 * solo la columna del formulario: la pantalla es del formulario, no de la foto.
 *
 * Tipografía Lexend (la de la marca, como la portada); los colores de la columna izquierda son
 * los de ALBA (`.auth-brand`, globals.css), el formulario sigue los tokens del producto.
 *
 * Lo que NO trae, a propósito: selector de idioma (solo hay `es-CO`), «Continuar con Google»
 * (no hay ese proveedor configurado), cifras o testimonios.
 *
 * SSOT: reference/01-routing/routes.md (`/auth/*`, `/registro`), plan/03-identidad-y-acceso.md.
 */

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Clock3, Laptop, ShieldCheck, TrendingUp, UsersRound } from 'lucide-react';
import { lexend } from '@/app/fonts/site';
import { BrandLogo } from '@/components/atoms/brand-logo';
import { MEDIA, type MediaId } from '@/features/marketing/media';
import { objectPositionClass } from '@/features/marketing/media-placeholder';
import { cn } from '@/lib/utils';

export type AuthIntent = 'login' | 'register' | 'recover';

const PHOTO: Record<AuthIntent, MediaId> = {
  login: 'auth-login',
  register: 'auth-register',
  recover: 'auth-recover',
};

const BENEFITS = [
  ['pace', Clock3],
  ['virtual', Laptop],
  ['support', UsersRound],
] as const;

export interface AuthShellProps {
  intent: AuthIntent;
  /** Política de datos de la institución, si la tiene: enlaza «Tus datos están protegidos». */
  dataPolicyUrl?: string | null;
  children: React.ReactNode;
}

export function AuthShell({ intent, dataPolicyUrl, children }: AuthShellProps) {
  const t = useTranslations('auth.shell');
  const media = MEDIA[PHOTO[intent]];

  return (
    <div
      className={cn(
        'auth-brand bg-surface-base min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,9fr)_minmax(0,8fr)]',
        lexend.variable
      )}
    >
      {/*
        La columna de marca: solo en escritorio, fija a la altura de la pantalla mientras el
        formulario se desplaza. En columna: la foto ocupa lo que sobra y el bloque navy mide lo que
        mide su texto, así el titular nunca se monta sobre la foto en pantallas bajas. La foto lleva
        `alt`: la persona es parte del mensaje.
      */}
      <figure className="auth-panel m-0 hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:self-start">
        <div className="relative min-h-[12rem] flex-1">
          {media && (
            <Image
              src={media.src}
              alt={media.alt}
              width={media.width}
              height={media.height}
              sizes="(min-width: 1024px) 55vw, 0px"
              priority
              className={`absolute inset-0 h-full w-full object-cover ${objectPositionClass(media.focalPoint)}`}
            />
          )}
          {/* Las ondas del isotipo, donde la foto se encuentra con el navy. */}
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 800 200"
            preserveAspectRatio="none"
            className="absolute inset-x-0 -bottom-px h-44 w-full overflow-visible xl:h-56"
          >
            {/* Como el mockup: el navy sube por la izquierda y baja hacia la derecha; encima, una
                banda azul ancha a la izquierda; la cinta amarilla nace dentro del azul y se
                ensancha hacia la derecha, con azul debajo antes del navy. El borde de arriba del
                azul va siempre por encima del de abajo de la cinta: no se asoma la foto entre
                los dos. */}
            <path
              fill="var(--auth-blue)"
              d="M0 0C180 -10 340 40 470 100C560 120 680 100 800 90V202H0Z"
            />
            <path
              fill="var(--auth-yellow)"
              d="M380 128C470 112 600 66 800 26V108C690 118 560 132 380 128Z"
            />
            <path
              fill="var(--auth-navy)"
              d="M0 70C200 70 380 120 520 150C640 176 740 190 800 196V202H0Z"
            />
          </svg>
        </div>
        <figcaption className="flex shrink-0 flex-col gap-7 px-10 pb-10 pt-1 xl:px-14 xl:pb-14">
          <div className="space-y-5">
            <p className="auth-headline m-0">
              {t(`${intent}.titleA`)}{' '}
              <span className="auth-highlight">{t(`${intent}.titleB`)}</span>
            </p>
            <span aria-hidden="true" className="auth-bar block" />
            <p className="auth-lead m-0 max-w-[32rem]">{t(`${intent}.body`)}</p>
          </div>
          <ul className="m-0 grid list-none grid-cols-3 gap-5 p-0">
            {BENEFITS.map(([key, Icon]) => (
              <li key={key} className="flex items-center gap-3">
                <span className="auth-benefit-icon">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span>
                  <span className="auth-benefit-title block">{t(`benefits.${key}.title`)}</span>
                  <span className="auth-benefit-body block">{t(`benefits.${key}.body`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </figcaption>
      </figure>

      <div className="flex min-h-screen flex-col items-center px-4 py-8 sm:px-8 lg:py-12">
        <div className="flex w-full max-w-md flex-1 flex-col justify-center space-y-8">
          <Link href="/" className="rounded-control mx-auto inline-block" aria-label={t('home')}>
            <BrandLogo className="h-16 sm:h-20" priority />
          </Link>
          {children}
        </div>

        <ul className="auth-trust mt-10 grid w-full max-w-xl list-none gap-4 p-4 sm:grid-cols-3 sm:gap-0 sm:p-5">
          <li className="auth-trust-item">
            <ShieldCheck aria-hidden="true" className="size-6 shrink-0" />
            {dataPolicyUrl ? (
              <a
                href={dataPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted hover:text-text underline-offset-2 hover:underline"
              >
                {t('trust.privacy')}
              </a>
            ) : (
              <span>{t('trust.privacy')}</span>
            )}
          </li>
          <li className="auth-trust-item">
            <UsersRound aria-hidden="true" className="size-6 shrink-0" />
            <span>{t('trust.support')}</span>
          </li>
          <li className="auth-trust-item">
            <TrendingUp aria-hidden="true" className="size-6 shrink-0" />
            <span>{t('trust.future')}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
