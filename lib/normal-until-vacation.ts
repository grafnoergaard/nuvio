import type { VacationMode } from './vacation-mode-service';

export interface NormalUntilVacationPeriod {
  startDate: string;
  endDate: string;
  totalDays: number;
  remainingDays: number;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getInclusiveDays(startDate: string, endDate: string): number {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
}

export function getNormalUntilVacationPeriod(
  plannedVacationMode: VacationMode | null,
  year: number,
  month: number,
  now: Date = new Date(),
): NormalUntilVacationPeriod | null {
  if (!plannedVacationMode) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const vacationStart = parseIsoDate(plannedVacationMode.start_date);

  if (vacationStart <= today) return null;
  if (vacationStart.getFullYear() !== year || vacationStart.getMonth() + 1 !== month) return null;
  if (today.getFullYear() !== year || today.getMonth() + 1 !== month) return null;

  const periodStartDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const periodEndDate = toIsoDate(addDays(vacationStart, -1));

  if (periodEndDate < periodStartDate) return null;

  return {
    startDate: periodStartDate,
    endDate: periodEndDate,
    totalDays: getInclusiveDays(periodStartDate, periodEndDate),
    remainingDays: getInclusiveDays(toIsoDate(today), periodEndDate),
  };
}
