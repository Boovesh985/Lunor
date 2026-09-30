/** Learner levels. Kept free of zod so the landing page can use them without loading the schemas. */
export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];
