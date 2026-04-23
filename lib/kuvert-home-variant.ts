export type KuvertHomeVariant = 'current' | 'score_streak_focus' | 'score_streak_focus_native' | 'score_streak_focus_native_cards';

// Hurtig rollback: skift til 'current' for at vende tilbage til det nuværende design.
// Brug 'score_streak_focus' for at vende tilbage til det forrige eksperiment.
// Brug 'score_streak_focus_native_cards' for card-varianten.
export const KUVERT_HOME_VARIANT: KuvertHomeVariant = 'score_streak_focus_native_cards';
