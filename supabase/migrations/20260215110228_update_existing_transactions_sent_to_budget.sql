/*
  # Update existing transactions to be sent to budget

  This migration updates all existing transactions that have both a recipient_id 
  and category_group_id to be marked as sent_to_budget = true, so they appear 
  in the budget overview.

  Important notes:
    - Only updates transactions that have both recipient_id and category_group_id
    - This is a one-time fix for existing imported transactions
    - Future imports will automatically set sent_to_budget = true
*/

-- Update all existing transactions that have recipient and category group
UPDATE transactions
SET sent_to_budget = true
WHERE recipient_id IS NOT NULL
  AND category_group_id IS NOT NULL
  AND sent_to_budget IS NOT true;