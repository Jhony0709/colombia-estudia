'use client';

/**
 * Formulario conversacional (6/10, `.claude/skills/experiencia-colombia-estudia` §4): una
 * pregunta a la vez, lo respondido queda arriba como píldora editable, un solo `<form>` y un
 * solo envío al final. Lo usa el registro; sirve para cualquier flujo de 4+ preguntas del
 * estudiante.
 *
 * Los pasos los arma quien lo usa, con sus valores (controlados fuera); aquí vive solo el
 * recorrido: qué paso toca, cuáles están respondidos, el tecleo de cada pregunta la primera
 * vez y el foco. Los pasos se identifican por `id`, no por posición: si una respuesta cambia
 * qué pasos existen (menor de edad → sin política), el recorrido sigue siendo correcto.
 *
 * Dentro de una columna (`AuthShell`) el historial no tiene scroll propio: la página baja
 * hasta la pregunta nueva. El `column-reverse` de §4 es para flujos a pantalla completa.
 *
 * Coreografía de un paso (motion/react, tokens del contrato, interrumpible):
 * 1. la respuesta y su pregunta salen con fade (`fast`, `easing.exit`);
 * 2. al terminar, la respuesta aparece como píldora en el historial (eco) y el resto se
 *    recoloca con `layout` (`normal`, sin saltos);
 * 3. la pregunta nueva entra (`normal`, `easing.enter`, sube `distance.sm`) y se teclea;
 * 4. sus campos entran en escalera cuando termina el tecleo (CSS, `.convo-answer`).
 * Con movimiento reducido todo dura 0: corte seco.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/atoms/button';
import { TypedPrompt } from '@/components/atoms/motion';
import { motionReduced } from '@/lib/motion/preference';
import { useMotionTokens } from '@/lib/motion/use-motion-tokens';
import { cn } from '@/lib/utils';

export interface ConversationStepApi {
  /** Pasa al siguiente paso sin validar: para opciones que responden al pulsarlas. */
  advance: () => void;
}

export interface ConversationStep {
  id: string;
  /** Sección del avance («Sobre ti», «Contacto»…). */
  section: string;
  prompt: string;
  /** Lo que queda en el historial una vez respondido. */
  answer: string;
  field: (api: ConversationStepApi) => ReactNode;
  /** `choice`: el campo responde solo (botones) y no hay «Continuar». */
  kind?: 'input' | 'choice';
  /** El mensaje si no se puede seguir todavía; `null`, válido. */
  validate?: () => string | null;
  /** Acción secundaria junto a «Continuar» (p. ej. «Omitir»). Responde y avanza. */
  secondary?: { label: string; onSelect: () => void };
}

export interface ConversationFinale {
  section: string;
  prompt: string;
  content: ReactNode;
}

const FINALE = '__finale';

export function ConversationalForm({
  steps,
  finale,
  onSubmit,
  jumpTo,
  className,
}: {
  steps: ConversationStep[];
  finale: ConversationFinale;
  onSubmit: () => void;
  /** Vuelve a un paso desde fuera (un error del servidor en ese dato). Cambia `token` para repetir. */
  jumpTo?: { id: string; token: number; error: string } | null;
  className?: string;
}) {
  const t = useTranslations('conversation');
  const [current, setCurrent] = useState<string>(steps[0]?.id ?? FINALE);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  // Lo que pinta el historial: se pone al día cuando la pregunta anterior terminó de salir,
  // para que la pregunta no se vea dos veces (saliendo y ya en el historial).
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const motionValues = useMotionTokens();
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = useRef(new Set<string>());
  const interacted = useRef(false);
  const activeRef = useRef<HTMLDivElement | null>(null);

  const index = steps.findIndex((s) => s.id === current);
  const step: ConversationStep | null = steps[index] ?? null;
  const promptId = `pregunta-${current}`;
  // Teclea solo la primera vez que aparece cada pregunta: al editar, ya se leyó.
  const animatePrompt = !typed.current.has(current);

  useEffect(() => {
    if (!jumpTo) return;
    interacted.current = true;
    setCurrent(jumpTo.id);
    setError(jumpTo.error);
    setRevealed(false);
  }, [jumpTo]);

  // Lo nuevo a la vista cuando monta (tras la salida de lo anterior); nada en la primera carga.
  const activeMounted = useCallback((node: HTMLDivElement | null) => {
    activeRef.current = node;
    if (!node || !interacted.current) return;
    node.scrollIntoView({ block: 'nearest', behavior: motionReduced() ? 'auto' : 'smooth' });
  }, []);

  // Revelada la respuesta, el foco a su primer control: el grupo se llama con la pregunta,
  // así que el lector anuncia la pregunta al entrar.
  useEffect(() => {
    if (!revealed || !interacted.current) return;
    const control = activeRef.current?.querySelector<HTMLElement>(
      '[data-answer] input:not([type=hidden]):not([readonly]), [data-answer] button, [data-answer] a'
    );
    control?.focus({ preventScroll: true });
  }, [revealed, current]);

  // Una tecla durante el tecleo lo termina: escribir nunca espera a la animación.
  useEffect(() => {
    if (revealed) return;
    const finish = () => setRevealed(true);
    window.addEventListener('keydown', finish, { once: true });
    return () => window.removeEventListener('keydown', finish);
  }, [revealed, current]);

  const go = (from: string) => {
    interacted.current = true;
    const nextAnswered = new Set(answered).add(from);
    setAnswered(nextAnswered);
    const after = steps.slice(steps.findIndex((s) => s.id === from) + 1);
    const next = after.find((s) => !nextAnswered.has(s.id))?.id ?? FINALE;
    setError(null);
    setRevealed(false);
    setCurrent(next);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!step) {
      onSubmit();
      return;
    }
    if (step.kind === 'choice') return;
    const problem = step.validate?.() ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    go(step.id);
  };

  const edit = (id: string) => {
    interacted.current = true;
    setError(null);
    setRevealed(false);
    setCurrent(id);
  };

  // El historial: lo respondido antes del paso actual. Lo respondido después (al editar)
  // vuelve a aparecer cuando se confirma.
  const position = !step ? steps.length : index;
  const history = steps.slice(0, position).filter((s) => shown.has(s.id));
  const { fast, normal, enter, exit, standard, distanceSm } = motionValues;
  const sectionNames = [...new Set([...steps.map((s) => s.section), finale.section])];
  const section = !step ? finale.section : step.section;
  const sectionIndex = sectionNames.indexOf(section);

  return (
    <form onSubmit={submit} noValidate className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <p className="type-caption text-text-muted m-0" aria-live="polite">
          {t('progress', {
            n: sectionIndex + 1,
            total: sectionNames.length,
            section,
          })}
        </p>
        <div aria-hidden="true" className="flex gap-1">
          {sectionNames.map((name, i) => (
            <span
              key={name}
              className={cn(
                'rounded-pill duration-normal ease-standard h-1 flex-1 transition-colors',
                i <= sectionIndex ? 'bg-accent-base' : 'bg-border-muted'
              )}
            />
          ))}
        </div>
      </div>

      <LayoutGroup>
        {history.length > 0 && (
          <ol className="m-0 list-none space-y-4 p-0">
            {/* Sin `initial={false}`: la lista monta con su primer elemento, y ese también entra. */}
            <AnimatePresence>
              {history.map((s) => (
                <motion.li
                  key={s.id}
                  layout="position"
                  initial={{ opacity: 0, y: distanceSm }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: fast, ease: exit } }}
                  transition={{ duration: normal, ease: enter }}
                  className="space-y-2"
                >
                  <p className="type-body text-text-muted m-0">{s.prompt}</p>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => edit(s.id)}
                      aria-label={t('editLabel', { question: s.prompt, answer: s.answer })}
                      className="convo-pill bg-surface-sunken text-text type-body rounded-pill min-h-touch hover:bg-border-muted duration-fast inline-flex max-w-full items-center gap-2 px-4 transition-colors"
                    >
                      <span className="truncate">{s.answer}</span>
                      <Pencil aria-hidden className="text-text-muted size-3.5 shrink-0" />
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}

        <AnimatePresence
          mode="wait"
          initial={false}
          onExitComplete={() => setShown(new Set(answered))}
        >
          <motion.div
            key={current}
            ref={activeMounted}
            layout="position"
            initial={{ opacity: 0, y: distanceSm }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: fast, ease: exit } }}
            transition={{
              duration: normal,
              ease: enter,
              layout: { duration: normal, ease: standard },
            }}
            className="scroll-mt-24 space-y-4"
          >
            <TypedPrompt
              id={promptId}
              as="h2"
              text={!step ? finale.prompt : step.prompt}
              animate={animatePrompt}
              complete={revealed}
              onDone={() => {
                typed.current.add(current);
                setRevealed(true);
              }}
              className="type-subheading text-text"
            />
            <div
              role="group"
              aria-labelledby={promptId}
              data-answer=""
              data-revealed={revealed ? '' : undefined}
              className="convo-answer space-y-4"
            >
              {!step ? (
                finale.content
              ) : (
                <>
                  {step.field({ advance: () => go(step.id) })}
                  {error && (
                    <p role="alert" className="type-body text-status-error-base m-0">
                      {error}
                    </p>
                  )}
                  {step.kind !== 'choice' && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit">{t('continue')}</Button>
                      {step.secondary && (
                        <Button
                          type="button"
                          variant="quiet"
                          onClick={() => {
                            step.secondary?.onSelect();
                            go(step.id);
                          }}
                        >
                          {step.secondary.label}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </LayoutGroup>
    </form>
  );
}
