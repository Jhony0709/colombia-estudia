'use client';

/**
 * La clave de respuestas, marcada sobre las preguntas.
 * SSOT: contenido-y-evaluaciones.md («nunca en el mismo objeto»), revisión de UX del 18/9.
 *
 * Antes era otro `textarea` de JSON: había que escribir `{"p1":{"correct":["a"],"points":20}}`
 * a mano, con el código de la pregunta y el de la opción que nadie ve en pantalla. Ahora se
 * marca la opción correcta donde está escrita.
 *
 * Los puntos no se piden aquí: salen de la pregunta. El validador exige que coincidan
 * (`points-mismatch`), y pedir el mismo número dos veces solo sirve para dejarlos distintos.
 */

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/atoms/button';
import { FormField, FormInput } from '@/components/atoms/form-field';
import { hasOptions, type AnswerKeyDraft, type Question } from './question-model';

export function AnswerKeyBuilder({
  questions,
  value,
  onChange,
}: {
  questions: Question[];
  value: AnswerKeyDraft;
  onChange: (next: AnswerKeyDraft) => void;
}) {
  const t = useTranslations('assessmentEditor');

  const set = (code: string, correct: string[], feedback?: string) => {
    const previous = value[code];
    onChange({
      ...value,
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

  if (questions.length === 0) {
    return <p className="type-body text-text-muted max-w-reading">{t('keyNoQuestions')}</p>;
  }

  return (
    <ol className="space-y-4">
      {questions.map((question, index) => (
        <li key={question.code}>
          <KeyCard
            question={question}
            number={index + 1}
            entry={value[question.code]}
            onSet={(correct, feedback) => set(question.code, correct, feedback)}
          />
        </li>
      ))}
    </ol>
  );
}

function KeyCard({
  question,
  number,
  entry,
  onSet,
}: {
  question: Question;
  number: number;
  entry: { correct: string[]; feedback?: string } | undefined;
  onSet: (correct: string[], feedback?: string) => void;
}) {
  const t = useTranslations('assessmentEditor');
  const feedbackId = useId();
  const correct = entry?.correct ?? [];
  const options = question.options ?? [];
  const multiple = question.type === 'multiple_choice';

  return (
    <div className="bg-surface-sunken rounded-control space-y-3 p-4">
      <p className="type-body-emphasis text-text max-w-reading">
        {number}. {question.text.trim() === '' ? t('questionWithoutText') : question.text}
      </p>

      {/* Sin respuesta marcada no se publica, y se dice aquí en vez de dejarlo solo para el
          panel de avisos: el sitio donde falta algo es el sitio donde hay que decirlo. */}
      {correct.length === 0 && (
        <p className="type-caption text-status-warning-base">{t('keyMissingHere')}</p>
      )}

      {hasOptions(question.type) ? (
        <fieldset className="border-0 p-0">
          <legend className="type-label text-text">
            {multiple ? t('keyPickMany') : t('keyPickOne')}
          </legend>
          <div className="mt-2 space-y-2">
            {options.map((option) => {
              const checked = correct.includes(option.code);
              return (
                /*
                  La fila entera es el objetivo, no el círculo de 20 px.
                  `reference/03-ui/tokens.md` fija 44 px como mínimo para cualquier cosa que se
                  pulse, y el resto de la aplicación usa `min-h-touch`; estos controles
                  nacieron sin él. Un radio de 20 px sin área alrededor se falla con el
                  trackpad, y fallarlo aquí es no poder marcar la respuesta correcta.
                */
                <label
                  key={option.code}
                  className="type-body text-text min-h-touch rounded-control hover:bg-surface-sunken max-w-reading flex cursor-pointer items-start gap-3 p-2"
                >
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={`clave-${question.code}`}
                    checked={checked}
                    onChange={() =>
                      onSet(
                        multiple
                          ? checked
                            ? correct.filter((code) => code !== option.code)
                            : [...correct, option.code]
                          : [option.code]
                      )
                    }
                    className="mt-1 h-5 w-5 shrink-0"
                  />
                  {option.text.trim() === '' ? t('optionWithoutText') : option.text}
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <div className="space-y-2">
          <p className="type-label text-text">{t('keyAcceptedAnswers')}</p>
          <p className="type-caption text-text-muted max-w-reading">{t('keyAcceptedHint')}</p>
          <ul className="space-y-2">
            {correct.map((answer, position) => (
              <li key={position} className="flex items-end gap-2">
                <div className="flex-1">
                  <FormField
                    label={t('keyAnswerNumber', { number: position + 1 })}
                    name={`respuesta-${question.code}-${position}`}
                  >
                    <FormInput
                      name={`respuesta-${question.code}-${position}`}
                      value={answer}
                      onChange={(event) =>
                        onSet(correct.map((a, i) => (i === position ? event.target.value : a)))
                      }
                    />
                  </FormField>
                </div>
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => onSet(correct.filter((_, i) => i !== position))}
                >
                  {t('keyRemoveAnswer')}
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="quiet" onClick={() => onSet([...correct, ''])}>
            {t('keyAddAnswer')}
          </Button>
        </div>
      )}

      <div>
        <label htmlFor={feedbackId} className="type-label text-text block">
          {t('keyFeedback')}
        </label>
        <p className="type-caption text-text-muted max-w-reading">{t('keyFeedbackHint')}</p>
        <textarea
          id={feedbackId}
          rows={2}
          value={entry?.feedback ?? ''}
          onChange={(event) => onSet(correct, event.target.value)}
          className="border-border bg-surface-sunken text-text type-body rounded-control mt-1 w-full border p-3"
        />
      </div>
    </div>
  );
}
