'use client';

/**
 * Las preguntas y —cuando se piden— sus respuestas correctas, en una sola lista.
 * SSOT: reference/04-business-logic/contenido-y-evaluaciones.md, revisión de UX del 18/9.
 *
 * Hasta hoy esta pantalla pintaba las cinco preguntas **dos veces**: aquí como formulario
 * («Enunciado», «Opción 1», «Opción 2») y otra vez más abajo, en la clave, con el enunciado y
 * las opciones repetidos como texto. Para marcar la respuesta de la pregunta 4 había que bajar
 * por delante de todo el formulario y reconocerla por el enunciado. Ahora la correcta se marca
 * en la opción donde está escrita.
 *
 * Lo que la separación exige sigue en pie: `content` y `answerKey` son objetos distintos, por
 * rutas distintas y con `no-store`, y la clave **no se pide al servidor hasta que alguien pulsa
 * «mostrar las respuestas»** (`assessment-editor.tsx`). Lo que se ha ido es el panel aparte de
 * plan/07-contenido-y-migracion.md:48: en su lugar hay una columna que se revela.
 *
 * El tipo de pregunta pasó de cuatro radios a un `select`. Con la clave dentro de la tarjeta,
 * cinco preguntas ponían 20 radios de «cómo se responde» al lado de 15 de «cuál es la
 * correcta»: el mismo control, con el mismo aspecto, significando dos cosas distintas.
 */

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { Menu, MenuItem, MenuSeparator } from '@/components/molecules/menu';
import {
  QUESTION_TYPES,
  emptyQuestion,
  hasOptions,
  move,
  nextOptionCode,
  withType,
  type AnswerKeyDraft,
  type AssessmentDraft,
  type Question,
  type QuestionType,
} from './question-model';

/** Un aviso del validador ya traducido, atado a la pregunta que lo causa. */
export interface QuestionIssue {
  message: string;
  fix: string | null;
  blocking: boolean;
}

const FIELD_CLASS =
  'border-border bg-surface-base text-text type-body min-h-touch rounded-control w-full border px-3';

export function QuestionsBuilder({
  draft,
  onChange,
  answers,
  onAnswersChange,
  issuesByQuestion,
}: {
  draft: AssessmentDraft;
  onChange: (next: AssessmentDraft) => void;
  /** `null` mientras las respuestas no se han pedido: no están en esta pantalla. */
  answers: AnswerKeyDraft | null;
  onAnswersChange: (next: AnswerKeyDraft) => void;
  issuesByQuestion: Map<string, QuestionIssue[]>;
}) {
  const t = useTranslations('assessmentEditor');
  const instructionsId = useId();

  const setQuestions = (questions: Question[]) => onChange({ ...draft, questions });

  const replace = (index: number, question: Question) =>
    setQuestions(draft.questions.map((current, i) => (i === index ? question : current)));

  const setAnswer = (code: string, correct: string[], feedback?: string) => {
    if (answers === null) return;
    const previous = answers[code];
    onAnswersChange({
      ...answers,
      [code]: {
        correct,
        points: previous?.points ?? 1,
        ...(feedback !== undefined
          ? { feedback }
          : previous?.feedback
            ? { feedback: previous.feedback }
            : {}),
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Las instrucciones en su tarjeta, como cada pregunta: era el único campo de la
          pantalla que flotaba sobre el lienzo. */}
      <div className="bg-surface-base border-border-muted rounded-card elevation-resting border p-5">
        <label htmlFor={instructionsId} className="type-label text-text block">
          {t('instructionsLabel')}
        </label>
        <p className="type-caption text-text-muted max-w-reading">{t('instructionsHint')}</p>
        <textarea
          id={instructionsId}
          rows={2}
          value={draft.instructions}
          onChange={(event) => onChange({ ...draft, instructions: event.target.value })}
          className="border-border bg-surface-base text-text type-body rounded-control mt-1 w-full border p-3"
        />
      </div>

      {draft.questions.length === 0 ? (
        <p className="type-body text-text-muted max-w-reading">{t('noQuestionsYet')}</p>
      ) : (
        <ol className="space-y-4">
          {draft.questions.map((question, index) => (
            <li key={question.code} id={`pregunta-${question.code}`} className="scroll-mt-4">
              <QuestionCard
                question={question}
                index={index}
                total={draft.questions.length}
                showAnswers={answers !== null}
                answer={answers?.[question.code]}
                issues={issuesByQuestion.get(question.code) ?? []}
                onChange={(next) => replace(index, next)}
                onRemove={() => setQuestions(draft.questions.filter((_, i) => i !== index))}
                onMove={(to) => setQuestions(move(draft.questions, index, to))}
                onAnswer={(correct, feedback) => setAnswer(question.code, correct, feedback)}
              />
            </li>
          ))}
        </ol>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          setQuestions([...draft.questions, emptyQuestion(draft.questions, 'single_choice')])
        }
      >
        {t('addQuestion')}
      </Button>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  showAnswers,
  answer,
  issues,
  onChange,
  onRemove,
  onMove,
  onAnswer,
}: {
  question: Question;
  index: number;
  total: number;
  /*
    Si las respuestas están a la vista. **No se deduce de `answer`**: una pregunta todavía sin
    marcar no tiene entrada en la clave, así que deducirlo escondía el control justo en la
    única pregunta donde hacía falta ponerlo —y en una evaluación nueva, en todas.
  */
  showAnswers: boolean;
  /** Su entrada en la clave, si ya tiene una. */
  answer: { correct: string[]; feedback?: string } | undefined;
  issues: QuestionIssue[];
  onChange: (next: Question) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  onAnswer: (correct: string[], feedback?: string) => void;
}) {
  const t = useTranslations('assessmentEditor');
  const textId = useId();
  const typeId = useId();
  const feedbackId = useId();
  const options = question.options ?? [];
  // Verdadero y falso no se editan: son esas dos, siempre.
  const editableOptions = hasOptions(question.type) && question.type !== 'true_false';
  const multiple = question.type === 'multiple_choice';
  const correct = answer?.correct ?? [];
  const [confirming, setConfirming] = useState(false);

  /** Si quitarla pierde algo que alguien escribió. */
  const hasContent =
    question.text.trim() !== '' || options.some((option) => option.text.trim() !== '');

  return (
    <Card
      title={t('questionNumber', { number: index + 1 })}
      action={
        /*
          Tres botones por pregunta eran quince en una evaluación de cinco, y ninguno de los
          tres se usa a menudo: se escribe la pregunta una vez y se reordena alguna vez
          (§7 del contrato). Bajo el `⋯` siguen alcanzables con teclado —Radix implementa el
          patrón *menu button* de APG— y dejan de competir con lo que sí se toca todo el rato,
          que es el enunciado y las opciones.

          El orden se mueve con acciones y no arrastrando: arrastrar no funciona con teclado
          ni con lector de pantalla, y aquí no hay nada que no se pueda decir con «subir» y
          «bajar».
        */
        <Menu label={t('questionMenu', { number: index + 1 })}>
          <MenuItem disabled={index === 0} onSelect={() => onMove(index - 1)}>
            {t('moveUp')}
          </MenuItem>
          <MenuItem disabled={index === total - 1} onSelect={() => onMove(index + 1)}>
            {t('moveDown')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            onSelect={() => {
              // Una pregunta vacía se quita sin preguntar: confirmar que se borra la nada es
              // fricción por nada. Con algo escrito, `plan/11-ux.md:15` manda —resumen antes
              // de lo irreversible— y aquí no hay papelera a la que ir a buscarla.
              if (hasContent) setConfirming(true);
              else onRemove();
            }}
          >
            {t('removeQuestion')}
          </MenuItem>
        </Menu>
      }
    >
      {confirming && (
        <div className="border-status-error-base rounded-card space-y-3 border p-3">
          <p className="type-body text-text max-w-reading">
            {t('removeConfirmBody', { number: index + 1 })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={onRemove}>
              {t('removeConfirm')}
            </Button>
            <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
              {t('removeCancel')}
            </Button>
          </div>
        </div>
      )}
      {/* Los avisos del validador, en la pregunta que falla y no en una lista al final de la
          página: el sitio donde falta algo es el sitio donde hay que decirlo. */}
      {issues.length > 0 && (
        <ul className="space-y-1">
          {issues.map((issue, position) => (
            <li
              key={position}
              className={`type-caption max-w-reading ${
                issue.blocking ? 'text-status-error-base' : 'text-status-warning-base'
              }`}
            >
              {issue.message}
              {issue.fix !== null && <span className="text-text-muted"> {issue.fix}</span>}
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor={textId} className="type-label text-text block">
          {t('questionText')}
        </label>
        <textarea
          id={textId}
          rows={2}
          value={question.text}
          onChange={(event) => onChange({ ...question, text: event.target.value })}
          className="border-border bg-surface-base text-text type-body rounded-control mt-1 w-full border p-3"
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-56">
          <label htmlFor={typeId} className="type-label text-text block">
            {t('questionType')}
          </label>
          <select
            id={typeId}
            value={question.type}
            onChange={(event) => onChange(withType(question, event.target.value as QuestionType))}
            className={`${FIELD_CLASS} mt-1`}
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`type.${type}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="w-28">
          <label htmlFor={`puntos-${question.code}`} className="type-label text-text block">
            {t('questionPoints')}
          </label>
          <input
            id={`puntos-${question.code}`}
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={String(question.points)}
            onChange={(event) =>
              onChange({ ...question, points: Math.max(1, Number(event.target.value) || 1) })
            }
            className={`${FIELD_CLASS} mt-1`}
          />
        </div>
      </div>

      {hasOptions(question.type) && (
        <fieldset className="border-0 p-0">
          <legend className="type-label text-text">{t('optionsLabel')}</legend>

          {showAnswers && (
            <p className="type-caption text-text-muted max-w-reading">
              {multiple ? t('pickManyHint') : t('pickOneHint')}
            </p>
          )}

          {question.type === 'true_false' && !showAnswers && (
            <p className="type-caption text-text-muted">{t('trueFalseFixed')}</p>
          )}

          <ul className="mt-2 space-y-2">
            {options.map((option, position) => {
              const checked = correct.includes(option.code);
              const fixed = question.type === 'true_false';

              return (
                <li key={option.code} className="flex items-center gap-2">
                  {showAnswers && (
                    /* La fila del marcador entera es el objetivo, no el círculo de 20 px:
                       `reference/03-ui/tokens.md` fija 44 px como mínimo. */
                    <label className="min-h-touch rounded-control hover:bg-surface-sunken flex w-20 shrink-0 cursor-pointer items-center justify-center gap-2">
                      <input
                        type={multiple ? 'checkbox' : 'radio'}
                        name={`correcta-${question.code}`}
                        checked={checked}
                        aria-label={t('markCorrect', { number: position + 1 })}
                        onChange={() =>
                          onAnswer(
                            multiple
                              ? checked
                                ? correct.filter((code) => code !== option.code)
                                : [...correct, option.code]
                              : [option.code]
                          )
                        }
                        className="h-5 w-5 shrink-0"
                      />
                      <span
                        className={`type-caption ${checked ? 'text-text' : 'text-text-muted'}`}
                        aria-hidden="true"
                      >
                        {t('correctShort')}
                      </span>
                    </label>
                  )}

                  <input
                    value={option.text}
                    readOnly={fixed}
                    aria-label={t('optionNumber', { number: position + 1 })}
                    onChange={(event) =>
                      onChange({
                        ...question,
                        options: options.map((current, i) =>
                          i === position ? { ...current, text: event.target.value } : current
                        ),
                      })
                    }
                    className={`${FIELD_CLASS} ${fixed ? 'text-text-muted' : ''}`}
                  />

                  {/* Con dos opciones no se puede quitar ninguna: una pregunta de elección
                      con una sola opción no es una pregunta. */}
                  {editableOptions && (
                    <Button
                      type="button"
                      variant="quiet"
                      disabled={options.length <= 2}
                      onClick={() =>
                        onChange({
                          ...question,
                          options: options.filter((_, i) => i !== position),
                        })
                      }
                    >
                      {t('removeOption')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>

          {editableOptions && (
            <Button
              type="button"
              variant="quiet"
              onClick={() =>
                onChange({
                  ...question,
                  options: [...options, { code: nextOptionCode(options), text: '' }],
                })
              }
            >
              {t('addOption')}
            </Button>
          )}
        </fieldset>
      )}

      {/* Respuesta escrita: las formas que se dan por buenas. Solo con las respuestas a la
          vista, porque eso es exactamente lo que son. */}
      {!hasOptions(question.type) && showAnswers && (
        <div className="space-y-2">
          <p className="type-label text-text">{t('keyAcceptedAnswers')}</p>
          <p className="type-caption text-text-muted max-w-reading">{t('keyAcceptedHint')}</p>
          <ul className="space-y-2">
            {correct.map((accepted, position) => (
              <li key={position} className="flex items-center gap-2">
                <input
                  value={accepted}
                  aria-label={t('keyAnswerNumber', { number: position + 1 })}
                  onChange={(event) =>
                    onAnswer(correct.map((a, i) => (i === position ? event.target.value : a)))
                  }
                  className={FIELD_CLASS}
                />
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => onAnswer(correct.filter((_, i) => i !== position))}
                >
                  {t('keyRemoveAnswer')}
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="quiet" onClick={() => onAnswer([...correct, ''])}>
            {t('keyAddAnswer')}
          </Button>
        </div>
      )}

      {/* La retroalimentación va plegada: es opcional, casi siempre está vacía, y abierta
          añadía un `textarea` por pregunta a una pantalla que ya era larga. */}
      {showAnswers && (
        <details open={(answer?.feedback ?? '') !== ''}>
          <summary className="type-label text-text min-h-touch flex cursor-pointer items-center">
            {t('feedbackToggle')}
          </summary>
          <label htmlFor={feedbackId} className="sr-only">
            {t('keyFeedback')}
          </label>
          <p className="type-caption text-text-muted max-w-reading">{t('keyFeedbackHint')}</p>
          <textarea
            id={feedbackId}
            rows={2}
            value={answer?.feedback ?? ''}
            onChange={(event) => onAnswer(correct, event.target.value)}
            className="border-border bg-surface-base text-text type-body rounded-control mt-1 w-full border p-3"
          />
        </details>
      )}
    </Card>
  );
}

export type { QuestionType };
