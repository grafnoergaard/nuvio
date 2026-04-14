/*
  # Opdater variable udgifter standardværdier fra procenter til kr.-beløb

  Ændrer wizard_defaults for variable udgifter fra procentandele til konkrete
  månedlige kr.-beløb. Labels opdateres tilsvarende.

  Nye standardbeløb (baseret på en gennemsnitlig husstand):
  - Mad & dagligvarer: 3.000 kr./md.
  - Transport: 1.200 kr./md.
  - Café & takeaway: 600 kr./md.
  - Fritid & underholdning: 700 kr./md.
  - Diverse: 800 kr./md.
*/

UPDATE wizard_defaults SET label = 'Mad & dagligvarer', value = 3000 WHERE key = 'food_pct';
UPDATE wizard_defaults SET label = 'Transport', value = 1200 WHERE key = 'transport_pct';
UPDATE wizard_defaults SET label = 'Café & takeaway', value = 600 WHERE key = 'cafe_pct';
UPDATE wizard_defaults SET label = 'Fritid & underholdning', value = 700 WHERE key = 'leisure_pct';
UPDATE wizard_defaults SET label = 'Diverse', value = 800 WHERE key = 'misc_pct';
