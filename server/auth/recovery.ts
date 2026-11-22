import { z } from 'zod';

/** Same rule as sign-up. */
export const newPasswordSchema = z.string().min(10, 'Use at least 10 characters').max(200);
