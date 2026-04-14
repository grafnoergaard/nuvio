/*
  # Reset sent_to_budget for imported transactions

  This migration resets all transactions to sent_to_budget = false.
  Users need to explicitly click "Send til budget" to mark transactions 
  as sent to the budget.

  Important notes:
    - Resets all existing transactions to sent_to_budget = false
    - Users will need to manually send transactions to budget via the UI
*/

-- Reset all transactions to not sent to budget
UPDATE transactions
SET sent_to_budget = false
WHERE sent_to_budget IS NOT false;