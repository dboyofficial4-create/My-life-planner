import type { SportsPrefs } from '../../schemas';

type Sport = SportsPrefs['sports'][number]['sport'];

export interface Drill {
  name: string;
  minutes: number;
  space: string;
  equipment: string;
  difficulty: 'easy' | 'moderate' | 'hard';
  howTo: string;
  measure: string;
  solo: boolean;
}

/**
 * Basis: widely used, general coaching drills. They are NOT derived from a
 * sports data source or validated benchmark, and the UI labels them that way.
 * A verified source (e.g. a national governing body's coaching curriculum)
 * can replace this file without changing callers.
 */
export const DRILL_BASIS = 'General coaching practice — not tied to a verified data source or benchmark. Your coach’s plan takes priority.';

export const SPORT_LABELS: Record<Sport, string> = {
  basketball: 'Basketball',
  soccer: 'Soccer',
  american_football: 'American football',
  baseball_softball: 'Baseball / softball',
  volleyball: 'Volleyball',
  track_running: 'Track / running',
  swimming: 'Swimming',
  tennis: 'Tennis',
  other: 'Other sport',
};

export const DRILLS: Record<Sport, Drill[]> = {
  basketball: [
    { name: 'Form shooting close to the rim', minutes: 10, space: 'Hoop', equipment: 'Ball', difficulty: 'easy', howTo: 'One hand, 1–2 m from the rim. Focus on elbow under the ball and a consistent follow-through.', measure: 'Makes out of 25 from each of 3 spots', solo: true },
    { name: 'Two-ball stationary dribbling', minutes: 8, space: 'Any flat floor', equipment: '2 balls', difficulty: 'moderate', howTo: '30-second rounds: same-time, alternating, high/low. Eyes up.', measure: 'Rounds completed without losing control', solo: true },
    { name: 'Spot shooting (5 spots)', minutes: 12, space: 'Half court', equipment: 'Ball', difficulty: 'moderate', howTo: '10 shots per spot at game speed with a proper catch and footwork.', measure: 'Makes per 50 attempts, tracked weekly', solo: true },
  ],
  soccer: [
    { name: 'Wall passes, both feet', minutes: 10, space: 'Wall + 5 m', equipment: 'Ball', difficulty: 'easy', howTo: 'Pass against a wall, receive with one touch, alternate feet.', measure: 'Clean receptions in 2 minutes', solo: true },
    { name: 'Cone dribbling slalom', minutes: 10, space: '15 m strip', equipment: 'Ball, 6 cones', difficulty: 'moderate', howTo: 'Weave through cones using inside/outside of both feet; jog back.', measure: 'Time per run without touching cones', solo: true },
    { name: 'First-touch juggling', minutes: 8, space: 'Small area', equipment: 'Ball', difficulty: 'easy', howTo: 'Juggle with feet and thighs; reset calmly when it drops.', measure: 'Best streak', solo: true },
  ],
  american_football: [
    { name: 'Stance and start reps', minutes: 10, space: '10 m', equipment: 'None', difficulty: 'easy', howTo: 'Position-specific stance, explode out for 5 m, walk back.', measure: 'Coach or video check of first-step quality', solo: true },
    { name: 'Ball security drill', minutes: 8, space: 'Small area', equipment: 'Ball', difficulty: 'easy', howTo: 'Carry with five points of pressure while changing direction.', measure: 'Reps with correct carry', solo: true },
  ],
  baseball_softball: [
    { name: 'Tee work', minutes: 15, space: 'Net or open field', equipment: 'Bat, tee, balls', difficulty: 'easy', howTo: 'Inside, middle and outside tee positions; focus on balance and contact.', measure: 'Line drives out of 30', solo: true },
    { name: 'Wall ball fielding', minutes: 10, space: 'Wall + 10 m', equipment: 'Glove, ball', difficulty: 'moderate', howTo: 'Throw against a wall and field the rebound with good footwork.', measure: 'Clean fields out of 30', solo: true },
  ],
  volleyball: [
    { name: 'Wall passing (forearm)', minutes: 10, space: 'Wall', equipment: 'Ball', difficulty: 'easy', howTo: 'Platform still, pass to a target on the wall, move feet to the ball.', measure: 'Consecutive controlled passes', solo: true },
    { name: 'Self-setting', minutes: 8, space: 'Small area', equipment: 'Ball', difficulty: 'easy', howTo: 'Set to yourself 1–2 m high with consistent hand shape.', measure: 'Consecutive sets', solo: true },
  ],
  track_running: [
    { name: 'Running drills (A/B skips, high knees)', minutes: 10, space: '20 m', equipment: 'None', difficulty: 'easy', howTo: '2 × 20 m of each drill, walk back. Tall posture, quick ground contact.', measure: 'Rhythm and posture (video check)', solo: true },
    { name: 'Strides', minutes: 8, space: '80–100 m', equipment: 'None', difficulty: 'moderate', howTo: '4–6 × 80 m building to ~85% speed, full walk-back recovery.', measure: 'Relaxed form at speed', solo: true },
  ],
  swimming: [
    { name: 'Technique drills set', minutes: 15, space: 'Pool lane', equipment: 'Kickboard (optional)', difficulty: 'moderate', howTo: 'Catch-up, single-arm and kick-on-side drills, 4 × 25 m each.', measure: 'Stroke count per length', solo: true },
  ],
  tennis: [
    { name: 'Shadow swings with footwork', minutes: 10, space: 'Small area', equipment: 'Racket', difficulty: 'easy', howTo: 'Split step, move, set up and swing — forehand and backhand patterns.', measure: 'Clean repetitions with balance', solo: true },
    { name: 'Wall rally', minutes: 10, space: 'Wall', equipment: 'Racket, balls', difficulty: 'moderate', howTo: 'Rally against a wall aiming at a target line.', measure: 'Longest controlled rally', solo: true },
  ],
  other: [
    { name: 'Sport-specific skill block', minutes: 15, space: 'Varies', equipment: 'Varies', difficulty: 'moderate', howTo: 'Pick the one skill your coach most wants you to improve and practise it deliberately.', measure: 'A simple count or time you can repeat weekly', solo: true },
  ],
};
