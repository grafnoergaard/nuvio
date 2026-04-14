export const DANISH_MONTHS = [
  'Januar',
  'Februar',
  'Marts',
  'April',
  'Maj',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'December',
];

export function getMonthName(monthNumber: number): string {
  return DANISH_MONTHS[monthNumber - 1] || '';
}

export function getMonthOptions() {
  return DANISH_MONTHS.map((name, index) => ({
    value: index + 1,
    label: name,
  }));
}
