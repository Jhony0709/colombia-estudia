'use client';

/**
 * Los tokens de motion como números para `motion/react` (6/10): segundos, curvas y píxeles,
 * leídos de las variables CSS del contrato. Con movimiento reducido, todo dura 0 y no se
 * desplaza nada (corte seco); antes de montar, también 0: el primer render no anima.
 */

import { useEffect, useState } from 'react';
import { useMotionReduced } from './use-motion-reduced';
import { readDuration, readEasing, readLength } from './tokens';

type Curve = [number, number, number, number];

export interface MotionTokenValues {
  fast: number;
  normal: number;
  enter: Curve;
  exit: Curve;
  standard: Curve;
  distanceSm: number;
  distanceMd: number;
}

const CUT: MotionTokenValues = {
  fast: 0,
  normal: 0,
  enter: [0, 0, 1, 1],
  exit: [0, 0, 1, 1],
  standard: [0, 0, 1, 1],
  distanceSm: 0,
  distanceMd: 0,
};

export function useMotionTokens(): MotionTokenValues {
  const reduced = useMotionReduced();
  const [values, setValues] = useState<MotionTokenValues>(CUT);

  useEffect(() => {
    setValues({
      fast: readDuration('--duration-fast') / 1000,
      normal: readDuration('--duration-normal') / 1000,
      enter: readEasing('--easing-enter'),
      exit: readEasing('--easing-exit'),
      standard: readEasing('--easing-standard'),
      distanceSm: readLength('--motion-distance-sm'),
      distanceMd: readLength('--motion-distance-md'),
    });
  }, []);

  return reduced ? CUT : values;
}
