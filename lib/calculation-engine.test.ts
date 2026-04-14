function computeAge(birthYear: number, birthDate?: string | null, today: Date = new Date()): number {
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

const RATES = {
  child_0_2: 2200,
  child_3_12: 2800,
  child_13_17: 3200,
};

function getChildRate(birthYear: number, rates: typeof RATES, birthDate?: string | null, today?: Date): number {
  const age = computeAge(birthYear, birthDate, today);
  if (age <= 2) return rates.child_0_2;
  if (age <= 12) return rates.child_3_12;
  return rates.child_13_17;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const today = new Date('2025-06-15');

assert(
  computeAge(2022, '2022-12-31', today) === 2,
  'Born Dec 31 2022, today Jun 15 2025 — birthday not yet this year — age should be 2',
);

assert(
  computeAge(2022, '2022-06-15', today) === 3,
  'Born Jun 15 2022, today Jun 15 2025 — birthday is today — age should be 3',
);

assert(
  computeAge(2022, '2022-06-14', today) === 3,
  'Born Jun 14 2022, today Jun 15 2025 — birthday was yesterday — age should be 3',
);

assert(
  computeAge(2022, '2022-06-16', today) === 2,
  'Born Jun 16 2022, today Jun 15 2025 — birthday is tomorrow — age should be 2',
);

assert(
  computeAge(2022, '2022-01-01', today) === 3,
  'Born Jan 1 2022, today Jun 15 2025 — birthday passed this year — age should be 3',
);

assert(
  computeAge(2012, '2012-12-25', today) === 12,
  'Born Dec 25 2012, today Jun 15 2025 — birthday not yet this year — age should be 12 not 13',
);

assert(
  computeAge(2012, '2012-01-01', today) === 13,
  'Born Jan 1 2012, today Jun 15 2025 — birthday passed — age should be 13',
);

assert(
  computeAge(2022, null, today) === 3,
  'Year-only fallback (null): 2025 - 2022 = 3',
);

assert(
  computeAge(2022, undefined, today) === 3,
  'Year-only fallback (undefined): 2025 - 2022 = 3',
);

assert(
  getChildRate(2023, RATES, '2023-12-31', today) === RATES.child_0_2,
  'Born Dec 31 2023, age 1 on Jun 15 2025 — should use child_0_2 rate',
);

assert(
  getChildRate(2018, RATES, '2018-12-31', today) === RATES.child_3_12,
  'Born Dec 31 2018, age 6 on Jun 15 2025 — should use child_3_12 rate',
);

assert(
  getChildRate(2012, RATES, '2012-06-14', today) === RATES.child_13_17,
  'Born Jun 14 2012, age 13 on Jun 15 2025 — should use child_13_17 rate',
);

assert(
  getChildRate(2012, RATES, '2012-12-25', today) === RATES.child_3_12,
  'Born Dec 25 2012, age 12 on Jun 15 2025 (birthday not yet happened) — should use child_3_12 not child_13_17',
);

console.log('All tests passed.');
