/**
 * AuthShell: el cascarón de las pantallas de acceso (iniciar sesión, registro, recuperar,
 * restablecer, segundo factor). 23/9, tras el mockup de Jhonny.
 *
 * Dos columnas desde `lg`: a la izquierda una foto con un titular corto sobre un velo
 * oscuro (`auth-photo-scrim`, globals.css: el titular blanco tiene que dar 4.5:1 sobre
 * cualquier foto, y las ventanas de estas fotos son claras); a la derecha el logo enlazado a
 * la portada, el formulario y, si la institución tiene política de datos, un pie con «Privacidad». En el teléfono la foto grande
 * desaparece y queda una banda apaisada sin caras sobre el formulario: la pantalla es del
 * formulario, no de la foto.
 *
 * Lo que NO trae, a propósito: cifras de estudiantes, retratos de testimonio, selector de
 * idioma (solo hay `es-CO`). El titular es de la plataforma, no de la institución: cuando la
 * institución quiera el suyo, sale de `lib/institution/settings.ts` como la portada.
 *
 * SSOT: reference/01-routing/routes.md (`/auth/*`, `/registro`), plan/03-identidad-y-acceso.md.
 */

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BrandLogo } from '@/components/atoms/brand-logo';
import { MEDIA, type MediaId } from '@/features/marketing/media';
import { MediaPlaceholder, objectPositionClass } from '@/features/marketing/media-placeholder';

export type AuthIntent = 'login' | 'register' | 'recover';

const PHOTO: Record<AuthIntent, MediaId> = {
  login: 'auth-login',
  register: 'auth-register',
  recover: 'auth-recover',
};

export interface AuthShellProps {
  intent: AuthIntent;
  /** Política de datos de la institución, si la tiene: el enlace «Privacidad» del pie. */
  dataPolicyUrl?: string | null;
  children: React.ReactNode;
}

export function AuthShell({ intent, dataPolicyUrl, children }: AuthShellProps) {
  const t = useTranslations('auth.shell');
  const media = MEDIA[PHOTO[intent]];

  return (
    <div className="bg-surface-canvas min-h-screen lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* La foto: solo en escritorio. `figure` con `alt`, no decoración: la persona de la foto es parte del mensaje. */}
      {media && (
        <figure className="relative hidden min-h-screen lg:block">
          <Image
            src={media.src}
            alt={media.alt}
            width={media.width}
            height={media.height}
            sizes="(min-width: 1024px) 45vw, 0px"
            priority
            className={`absolute inset-0 h-full w-full object-cover ${objectPositionClass(media.focalPoint)}`}
          />
          <div aria-hidden="true" className="auth-photo-scrim absolute inset-0" />
          <figcaption className="absolute inset-x-0 bottom-0 p-12">
            <p className="type-display text-text-on-accent max-w-reading">{t(`${intent}.title`)}</p>
            <span aria-hidden="true" className="bg-brand-yellow rounded-pill mt-4 block h-1 w-12" />
            <p className="type-body text-text-on-accent max-w-reading mt-4">
              {t(`${intent}.body`)}
            </p>
          </figcaption>
        </figure>
      )}

      <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-4 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          <MediaPlaceholder id="auth-strip" className="lg:hidden" sizes="100vw" />
          <Link href="/" className="rounded-control inline-block" aria-label={t('home')}>
            <BrandLogo className="h-20" priority />
          </Link>
          {children}
        </div>

        {/* Pie solo si hay algo que enlazar (23/9: «Ayuda» se quitó a petición de Jhonny). */}
        {dataPolicyUrl && (
          <footer className="type-caption text-text-muted w-full max-w-md">
            <a
              href={dataPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text underline-offset-2 hover:underline"
            >
              {t('privacy')}
            </a>
          </footer>
        )}
      </div>
    </div>
  );
}
