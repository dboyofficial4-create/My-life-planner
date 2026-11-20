/**
 * Build options for the build planner: how athletes in a role are typically built and what their
 * training emphasises, plus the everyday looks people most often train for. Described by sport and
 * position, never by a named person or their photo. General strength-and-conditioning knowledge;
 * the planner adapts it to the student's age, equipment, schedule and injuries.
 */
export type BuildGroup = 'sport' | 'everyday';

export interface BuildArchetype {
  id: string;
  group: BuildGroup;
  name: string;
  /** Who is typically built like this. */
  seenIn: string;
  look: string[];
  training: string[];
  /** What's realistic: genetics, height, time. */
  realityCheck: string;
}

export const BUILD_ARCHETYPES: BuildArchetype[] = [
  {
    id: 'sprinter',
    group: 'sport',
    name: 'Sprinter',
    seenIn: '100 m and 200 m sprinters, wide receivers',
    look: ['Powerful glutes, hamstrings and quads', 'Muscular shoulders and arms', 'Lean, defined midsection'],
    training: ['Heavy lower-body strength (squats, hip hinges, split squats)', 'Jumps and bounds for explosive power', 'Short, fast sprints with full rest', 'Upper-body pressing and pulling for muscle'],
    realityCheck: 'Fast-twitch muscle is partly genetic, but anyone gets visibly more powerful legs and a stronger upper body in 4 to 6 months of consistent training.',
  },
  {
    id: 'guard',
    group: 'sport',
    name: 'Basketball guard',
    seenIn: 'Point guards and shooting guards',
    look: ['Lean and quick', 'Strong legs and hips for first-step speed', 'Athletic shoulders and solid core'],
    training: ['Single-leg strength (split squats, step-ups)', 'Plyometrics and lateral quickness', 'Core anti-rotation work', 'Moderate upper-body strength'],
    realityCheck: 'Height is set by genetics; speed, vertical jump and a stronger frame are very trainable.',
  },
  {
    id: 'midfielder',
    group: 'sport',
    name: 'Soccer midfielder',
    seenIn: 'Central midfielders and wingers',
    look: ['Lean with strong, defined legs', 'Light, efficient upper body', 'Huge endurance'],
    training: ['Repeated sprint and interval running', 'Hamstring strength (Nordic curls, hinges) to stay healthy', 'Single-leg strength and balance', 'Core work'],
    realityCheck: 'This build comes mostly from lots of running plus two strength sessions a week; it stays light by design.',
  },
  {
    id: 'swimmer',
    group: 'sport',
    name: 'Swimmer',
    seenIn: 'Freestyle and butterfly swimmers',
    look: ['Broad shoulders and wide back (V-taper)', 'Long, lean frame', 'Strong core'],
    training: ['Pulling strength (pull-ups, rows, lat work)', 'Shoulder health (external rotation, face pulls)', 'Core and hip strength', 'Conditioning'],
    realityCheck: 'Arm span and height help elite swimmers, but a wider back and stronger shoulders come from pulling work within months.',
  },
  {
    id: 'linebacker',
    group: 'sport',
    name: 'Football linebacker',
    seenIn: 'Linebackers, running backs, rugby forwards',
    look: ['Big and strong all over', 'Thick upper back, chest and legs', 'Powerful hips'],
    training: ['Heavy compound lifts (squat, hinge, press, row)', 'Muscle-building volume', 'Sprint and change-of-direction work', 'Neck and shoulder strengthening'],
    realityCheck: 'Size takes years and plenty of food. Teens should focus on technique, steady strength gains and eating enough, not maximum weights.',
  },
  {
    id: 'gymnast',
    group: 'sport',
    name: 'Gymnast',
    seenIn: 'Gymnasts, climbers, calisthenics athletes',
    look: ['Compact and very defined', 'Strong shoulders, arms and back for their size', 'Rock-solid core, flexible'],
    training: ['Body-weight strength (pull-ups, dips, push-up and handstand progressions)', 'Core (hollow holds, leg raises)', 'Mobility every session'],
    realityCheck: 'Body-weight strength builds steadily over months; the most advanced skills take years of practice.',
  },
  {
    id: 'distance_runner',
    group: 'sport',
    name: 'Distance runner',
    seenIn: 'Cross-country and distance track runners',
    look: ['Very lean and light', 'Efficient, wiry legs', 'Minimal upper-body bulk'],
    training: ['Running volume, mostly easy, with one or two harder sessions', 'Strength twice a week to prevent injury', 'Calf, hip and core work'],
    realityCheck: 'This look comes from running mileage. It needs plenty of food; under-eating runners get injured and slower.',
  },
  {
    id: 'tennis',
    group: 'sport',
    name: 'Tennis player',
    seenIn: 'Tennis, badminton and squash players',
    look: ['Lean and agile', 'Strong legs and rotational core', 'Balanced, healthy shoulders'],
    training: ['Lateral agility and footwork', 'Rotational power (medicine-ball throws)', 'Single-leg strength', 'Shoulder and forearm care'],
    realityCheck: 'Very trainable for most people; balanced work on both sides keeps the body even.',
  },
  {
    id: 'volleyball',
    group: 'sport',
    name: 'Volleyball hitter',
    seenIn: 'Outside hitters and middle blockers',
    look: ['Long, lean and springy', 'Explosive legs for jumping', 'Strong shoulders and core'],
    training: ['Plyometrics and safe landing technique', 'Squats and hinges for jump power', 'Shoulder stability', 'Core strength'],
    realityCheck: 'Height is genetic; vertical jump usually improves noticeably in 8 to 12 weeks of jump training.',
  },
  {
    id: 'lean_toned',
    group: 'everyday',
    name: 'Lean and toned',
    seenIn: 'A popular everyday goal',
    look: ['Visible muscle definition without much size', 'Firm arms, legs and core', 'Fit and healthy-looking'],
    training: ['Full-body strength 3 times a week', 'Moderate weights for 8 to 15 reps', 'Cardio you enjoy', 'Regular, balanced meals'],
    realityCheck: '"Toned" is muscle you can see. Building some muscle matters more than doing endless cardio.',
  },
  {
    id: 'muscular_defined',
    group: 'everyday',
    name: 'Muscular and defined',
    seenIn: 'The classic "aesthetic" gym physique',
    look: ['Developed shoulders, chest, back and arms', 'V-taper', 'Defined midsection'],
    training: ['Muscle-building split 4 times a week', 'Progressive overload (a bit more weight or reps over time)', 'Enough protein and sleep'],
    realityCheck: 'Expect visible change in 3 to 6 months and a big change over 2 to 3 years. Photos online are often posed, pumped, lit and edited.',
  },
  {
    id: 'strong_powerful',
    group: 'everyday',
    name: 'Strong and powerful',
    seenIn: 'Powerlifters, throwers, strongman athletes',
    look: ['Thick and solid', 'Strong legs, back and grip', 'Built to move heavy things'],
    training: ['Squat, hinge, press and row as the core', 'Lower reps with long rests (adults); technique-first moderate weights for teens', 'Carries and grip work'],
    realityCheck: 'Strength rises fast at first, then slowly for years. Teens should avoid max-effort lifts.',
  },
  {
    id: 'hybrid',
    group: 'everyday',
    name: 'Athletic all-rounder',
    seenIn: 'Hybrid and functional-fitness athletes',
    look: ['Muscular and well-conditioned', 'Good at lifting and running', 'Balanced, capable body'],
    training: ['Strength 3 times a week', 'Conditioning circuits and intervals', 'Some running', 'Mobility'],
    realityCheck: 'A great general goal; progress in both strength and fitness is steady when recovery is good.',
  },
];

export const archetypeById = (id: string | null | undefined) => BUILD_ARCHETYPES.find((a) => a.id === id);
