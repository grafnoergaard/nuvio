export type KuvertHomeVariant = 'current' | 'score_streak_focus' | 'score_streak_focus_native';

// Hurtig rollback: skift til 'current' for at vende tilbage til det nuværende design.
// Brug 'score_streak_focus' for at vende tilbage til det forrige eksperiment.
export const KUVERT_HOME_VARIANT: KuvertHomeVariant = 'score_streak_focus_native';
