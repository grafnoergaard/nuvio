/*
  # Remove unused Nuvio Flow % thresholds

  ## Summary
  The status determination logic has been simplified to use only the health score.
  The two entries that mixed budget-used-% into status decisions are no longer needed:

  - FLOW_STATUS_WARN_USED_PCT  — "Stram op" trigger based on % of budget used
  - FLOW_STATUS_FLOW_USED_MAX  — "Nuvio Flow" cap based on % of budget used

  Statuses are now determined exclusively by healthPct thresholds, making the
  model simpler, consistent, and easier to understand.
*/

DELETE FROM standard_data_entries
WHERE key IN ('FLOW_STATUS_WARN_USED_PCT', 'FLOW_STATUS_FLOW_USED_MAX');
