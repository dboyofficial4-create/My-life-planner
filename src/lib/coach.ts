/** A link to Compass with a question already typed in (the student still presses Send). */
export const askCoach = (q: string) => `/compass?ask=${encodeURIComponent(q.slice(0, 1500))}`;
