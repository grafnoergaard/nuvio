/*
  # Fjern indkomst-poster fra budget_plans

  ## Baggrund
  Indkomst (category_groups med is_income = true) skal ikke gemmes i budget_plans.
  Indkomst hentes i stedet direkte fra household.members (monthly_net_salary).
  
  ## Ændringer
  - Sletter alle budget_plans-poster der tilhører modtagere (recipients) i indkomst-kategorier (is_income = true)
  
  ## Påvirkede tabeller
  - budget_plans: sletter rækker for indkomst-modtagere
*/

DELETE FROM budget_plans
WHERE recipient_id IN (
  SELECT r.id
  FROM recipients r
  JOIN category_groups cg ON cg.id = r.category_group_id
  WHERE cg.is_income = true
);
