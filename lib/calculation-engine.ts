import { fetchActiveSdsData, SDS_FALLBACK, SdsCalculationRates, SdsPostalRange } from '@/lib/standard-data-service';

export type CalculationRates = SdsCalculationRates;
export type PostalRange = SdsPostalRange;

export const DEFAULT_RATES: CalculationRates = SDS_FALLBACK.calculationRates;
export const DEFAULT_POSTAL_RANGES: PostalRange[] = SDS_FALLBACK.postalRanges;

export async function fetchRates(): Promise<CalculationRates> {
  const sds = await fetchActiveSdsData();
  return sds.calculationRates;
}

export async function fetchPostalRanges(): Promise<PostalRange[]> {
  const sds = await fetchActiveSdsData();
  return sds.postalRanges;
}

export function getRegionalMultiplierFromRanges(postalCode: string, rates: CalculationRates, ranges: PostalRange[]): number {
  const code = parseInt(postalCode, 10);
  if (isNaN(code)) return 0;

  for (const range of ranges) {
    if (code >= range.postal_from && code <= range.postal_to) {
      return (rates as unknown as Record<string, number>)[range.rate_key] ?? 0;
    }
  }

  return 0;
}

export function getRegionalMultiplier(postalCode: string, rates: CalculationRates): number {
  return getRegionalMultiplierFromRanges(postalCode, rates, DEFAULT_POSTAL_RANGES);
}

export function computeAge(birthYear: number, birthDate?: string | null, today: Date = new Date()): number {
  if (birthDate) {
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const hasHadBirthdayThisYear =
      today.getMonth() > birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
    if (!hasHadBirthdayThisYear) age -= 1;
    return age;
  }
  return today.getFullYear() - birthYear;
}

export function getChildRate(birthYear: number, rates: CalculationRates, birthDate?: string | null): number {
  const age = computeAge(birthYear, birthDate);
  if (age <= 2) return rates.child_0_2;
  if (age <= 12) return rates.child_3_12;
  return rates.child_13_17;
}

export interface CalculationBreakdown {
  adultSubtotal: number;
  childrenSubtotal: number;
  baseTotal: number;
  regionalMultiplier: number;
  regionalAdjustment: number;
  total: number;
  isStudent: boolean;
  adultRateUsed: number;
}

export type HousingType = 'OWNER' | 'COOPERATIVE' | 'RENT' | 'OTHER';

export function isHousingSkipped(_housingType: HousingType | null | undefined): boolean {
  return false;
}

export function calculate(
  numberOfAdults: number,
  numberOfChildren: number,
  isStudent: boolean,
  postalCode: string,
  childrenBirthYears: (number | null)[],
  rates: CalculationRates,
  postalRanges?: PostalRange[],
  housingType?: HousingType | null
): CalculationBreakdown {
  const adultRateUsed = isStudent
    ? numberOfAdults === 1
      ? rates.student_single
      : rates.student_couple
    : rates.adult_standard;

  const adultSubtotal = adultRateUsed * numberOfAdults;

  const childrenSubtotal = childrenBirthYears.reduce<number>((sum, year) => {
    if (!year) return sum;
    return sum + getChildRate(year, rates);
  }, 0);

  const baseTotal = adultSubtotal + childrenSubtotal;

  const regionalMultiplier = postalRanges
    ? getRegionalMultiplierFromRanges(postalCode, rates, postalRanges)
    : getRegionalMultiplier(postalCode, rates);

  const regionalAdjustment = Math.round(baseTotal * regionalMultiplier);

  const total = baseTotal + regionalAdjustment;

  return {
    adultSubtotal,
    childrenSubtotal,
    baseTotal,
    regionalMultiplier,
    regionalAdjustment,
    total,
    isStudent,
    adultRateUsed,
  };
}
