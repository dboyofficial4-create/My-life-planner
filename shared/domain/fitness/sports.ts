import { SPORTS_CATALOG, type SportId } from '../sports/catalog';

/** Display labels for sports (the full knowledge base lives in ../sports/catalog). */
export const SPORT_LABELS = Object.fromEntries(Object.entries(SPORTS_CATALOG).map(([id, info]) => [id, info.label])) as Record<SportId, string>;
