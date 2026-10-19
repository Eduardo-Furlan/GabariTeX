import React from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { cn } from './cn';

export interface CountUpProps {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  decimals = 0,
  duration = 700,
  prefix = '',
  suffix = '',
  className,
}) => {
  const animatedValue = useCountUp(value, duration);

  const formattedAnimated = animatedValue.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const formattedFinal = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span
      data-value={value}
      aria-label={`${prefix}${formattedFinal}${suffix}`}
      className={cn('tabular-nums inline-block', className)}
    >
      <span aria-hidden="true">
        {prefix}
        {formattedAnimated}
        {suffix}
      </span>
      <span className="sr-only">
        {prefix}
        {formattedFinal}
        {suffix}
      </span>
    </span>
  );
};
