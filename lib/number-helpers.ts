export function parseDanishDecimal(input: string | number): number | null {
  if (typeof input === 'number') {
    return isFinite(input) ? input : null;
  }

  let str = String(input).trim();

  str = str.replace(/[\s\u00A0]/g, '');
  str = str.replace(/kr\.?/gi, '').replace(/DKK/gi, '').replace(/[€$£]/g, '');
  str = str.trim();

  if (!str) return null;

  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(str)) return null;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(str)) return null;

  let sign = 1;
  if (/^\(.*\)$/.test(str)) {
    sign = -1;
    str = str.slice(1, -1).trim();
  } else if (str.startsWith('-')) {
    sign = -1;
    str = str.slice(1);
  } else if (str.endsWith('-')) {
    sign = -1;
    str = str.slice(0, -1);
  }

  str = str.trim();
  if (!str) return null;

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  if (!isFinite(num)) return null;

  return sign * num;
}

/**
 * Formats a number as Danish format with thousands separators and 2 decimals
 *
 * Examples:
 * - 8120.00 => "8.120,00"
 * - 31456.23 => "31.456,23"
 */
export function formatDanishNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('da-DK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function roundToHundreds(value: number): number {
  if (value === 0) return 0;
  if (value > 0) return Math.ceil(value / 100) * 100;
  return -Math.ceil(Math.abs(value) / 100) * 100;
}

interface FormatCurrencyOptions {
  roundToHundreds?: boolean;
  decimals?: number;
  style?: 'currency' | 'plain';
}

export function formatCurrency(
  value: number,
  options: FormatCurrencyOptions = {}
): string {
  const { roundToHundreds: doRound = false, decimals = 2, style = 'currency' } = options;
  let num = value;
  if (doRound) {
    num = roundToHundreds(num);
  }

  if (style === 'currency') {
    const formatted = num.toLocaleString('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    if (num < 0 && !formatted.startsWith('-') && !formatted.startsWith('\u2212')) {
      return '-' + formatted;
    }
    return formatted;
  }

  const formatted = num.toLocaleString('da-DK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (num < 0 && !formatted.startsWith('-') && !formatted.startsWith('\u2212')) {
    return '-' + formatted;
  }
  return formatted;
}

/**
 * Run some tests to verify the parser works correctly
 */
export function testDanishDecimalParser() {
  const tests: { input: string | number; expected: number | null }[] = [
    { input: '8.120,00', expected: 8120.00 },
    { input: '31.456,23', expected: 31456.23 },
    { input: '1.234', expected: 1.234 },
    { input: '123,45', expected: 123.45 },
    { input: '-119', expected: -119 },
    { input: '119', expected: 119 },
    { input: '-1.234,56', expected: -1234.56 },
    { input: '1.234.567,89', expected: 1234567.89 },
    { input: '0,50', expected: 0.50 },
    { input: '10 kr', expected: 10 },
    { input: '1.234 DKK', expected: 1.234 },
    { input: '1 234,56', expected: 1234.56 },
    { input: '€123,45', expected: 123.45 },
    { input: '31.456,23-', expected: -31456.23 },
    { input: '(1.234,00)', expected: -1234.00 },
    { input: '(500)', expected: -500 },
    { input: '123,45-', expected: -123.45 },
    { input: '10-12-2002', expected: null },
    { input: '03.11.2025', expected: null },
    { input: '2025-11-03', expected: null },
    { input: '01-01-25', expected: null },
  ];

  console.log('🧪 Testing Danish decimal parser:');
  let allPassed = true;

  tests.forEach(({ input, expected }) => {
    const result = parseDanishDecimal(input);
    const passed = result === expected;

    if (!passed) {
      console.error(`❌ FAILED: "${input}" => ${result} (expected ${expected})`);
      allPassed = false;
    } else {
      console.log(`✅ PASSED: "${input}" => ${result}`);
    }
  });

  if (allPassed) {
    console.log('🎉 All tests passed!');
  } else {
    console.error('💥 Some tests failed!');
  }

  return allPassed;
}
