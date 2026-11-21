/** A link to Coach with a question already typed in (the student still presses Send). */
export const askCoach = (q: string) => `/coach?ask=${encodeURIComponent(q.slice(0, 1500))}`;
