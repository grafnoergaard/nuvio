'use client';

import { useSettings } from '@/lib/settings-context';
import { roundToHundreds } from '@/lib/number-helpers';

interface AmountProps {
  value: number;
  className?: string;
  currency?: boolean;
}

export function Amount({ value, className, currency = true }: AmountProps) {
  const { settings } = useSettings();
  const decimals = settings.hideDecimals ? 0 : 2;
  let num = settings.roundToHundreds ? roundToHundreds(value) : value;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  let formatted: string;
  if (currency) {
    formatted = absNum.toLocaleString('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } else {
    formatted = absNum.toLocaleString('da-DK', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  const text = isNegative ? `\u2212${formatted}` : formatted;

  let colorClass = '';
  if (settings.colorizeAmounts) {
    if (isNegative) colorClass = 'text-red-600';
    else if (num > 0) colorClass = 'text-green-600';
  }

  const classes = [colorClass, className].filter(Boolean).join(' ');

  return <span className={classes || undefined}>{text}</span>;
}
