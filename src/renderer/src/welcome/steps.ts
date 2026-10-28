export type Step = 'profile' | 'addons' | 'ready'
export const STEPS: Step[] = ['profile', 'addons', 'ready']
/** The profile step's rows, top to bottom; Continuar is the last. */
export const PROFILE_ROWS = ['name', 'avatar', 'accent', 'next'] as const
