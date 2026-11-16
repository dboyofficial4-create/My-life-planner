import type { EquipmentId, Limitation } from '../../schemas';

export type Pattern = 'squat' | 'hinge' | 'push' | 'pull' | 'lunge' | 'core' | 'power' | 'conditioning';

export interface Exercise {
  id: string;
  name: string;
  pattern: Pattern;
  /** Any one of these equipment sets is enough. `[[]]` = no equipment. */
  equipment: EquipmentId[][];
  /** 1 beginner-friendly … 3 advanced */
  level: 1 | 2 | 3;
  /** Joints this movement loads heavily — skipped if the user flags a limitation there. */
  stresses: Limitation[];
  cues: string[];
  unit: 'reps' | 'seconds' | 'per side';
}

/**
 * Curated library of common, well-established exercises. Technique cues are
 * general coaching guidance, not individual medical or physiotherapy advice.
 */
export const EXERCISES: Exercise[] = [
  // Squat pattern
  { id: 'bw_squat', name: 'Bodyweight squat', pattern: 'squat', equipment: [[]], level: 1, stresses: ['knee'], unit: 'reps', cues: ['Feet about shoulder-width, toes slightly out.', 'Sit hips back and down, knees tracking over toes.', 'Keep your chest up and heels down; stand up by pushing the floor away.'] },
  { id: 'box_squat', name: 'Box squat (to a chair or box)', pattern: 'squat', equipment: [[]], level: 1, stresses: [], unit: 'reps', cues: ['Stand in front of a chair or box.', 'Reach hips back until you lightly touch it — do not drop onto it.', 'Drive up through the whole foot. A good option if deep squats bother your knees.'] },
  { id: 'goblet_squat', name: 'Goblet squat', pattern: 'squat', equipment: [['dumbbells'], ['kettlebell']], level: 1, stresses: ['knee'], unit: 'reps', cues: ['Hold one weight at your chest, elbows pointing down.', 'Squat between your knees with a tall torso.', 'Pause briefly at the bottom, then stand.'] },
  { id: 'back_squat', name: 'Barbell back squat', pattern: 'squat', equipment: [['barbell', 'squat_rack']], level: 2, stresses: ['knee', 'lower_back'], unit: 'reps', cues: ['Bar rests on upper back, hands just outside shoulders.', 'Brace your core before each rep.', 'Squat to a depth you can control with a neutral back; use safety pins.'] },
  { id: 'leg_press', name: 'Leg press', pattern: 'squat', equipment: [['leg_press']], level: 1, stresses: ['knee'], unit: 'reps', cues: ['Feet mid-platform, shoulder-width.', 'Lower until hips start to lift, then press without locking knees hard.'] },

  // Hinge
  { id: 'glute_bridge', name: 'Glute bridge', pattern: 'hinge', equipment: [[]], level: 1, stresses: [], unit: 'reps', cues: ['Lie on your back, knees bent, feet flat.', 'Squeeze glutes and lift hips until body is straight from knees to shoulders.', 'Avoid arching the low back; pause at the top.'] },
  { id: 'sl_bridge', name: 'Single-leg glute bridge', pattern: 'hinge', equipment: [[]], level: 2, stresses: [], unit: 'per side', cues: ['Bridge on one leg with the other knee pulled in.', 'Keep hips level throughout.'] },
  { id: 'db_rdl', name: 'Romanian deadlift', pattern: 'hinge', equipment: [['dumbbells'], ['kettlebell'], ['barbell']], level: 2, stresses: ['lower_back'], unit: 'reps', cues: ['Soft knees, push hips back while the weight slides down your thighs.', 'Keep a flat back; stop when you feel a strong hamstring stretch.', 'Stand by driving hips forward.'] },
  { id: 'band_pull_through', name: 'Band pull-through', pattern: 'hinge', equipment: [['resistance_bands']], level: 1, stresses: [], unit: 'reps', cues: ['Anchor a band low behind you and hold it between your legs.', 'Hinge back, then snap hips forward squeezing glutes.'] },
  { id: 'kb_swing', name: 'Kettlebell swing', pattern: 'power', equipment: [['kettlebell']], level: 2, stresses: ['lower_back'], unit: 'reps', cues: ['Hike the bell back like a football snap.', 'Snap hips forward so the bell floats to chest height — arms just guide it.', 'Stop the set when the hinge gets sloppy.'] },

  // Push
  { id: 'incline_pushup', name: 'Incline push-up (hands on counter or wall)', pattern: 'push', equipment: [[]], level: 1, stresses: ['wrist'], unit: 'reps', cues: ['Hands on a sturdy counter or wall, body in a straight line.', 'Lower chest toward the edge, elbows about 45° from your body.', 'The lower the surface, the harder it gets.'] },
  { id: 'pushup', name: 'Push-up', pattern: 'push', equipment: [[]], level: 2, stresses: ['wrist', 'shoulder'], unit: 'reps', cues: ['Hands under shoulders, body straight from head to heels.', 'Lower until chest is a few centimetres from the floor.', 'Press away while keeping hips in line.'] },
  { id: 'db_bench', name: 'Dumbbell bench press', pattern: 'push', equipment: [['dumbbells', 'bench']], level: 1, stresses: ['shoulder'], unit: 'reps', cues: ['Feet planted, shoulder blades pulled back.', 'Lower dumbbells to chest level with elbows slightly tucked.', 'Press up and slightly together.'] },
  { id: 'floor_press', name: 'Dumbbell floor press', pattern: 'push', equipment: [['dumbbells']], level: 1, stresses: [], unit: 'reps', cues: ['Lie on the floor, knees bent.', 'Lower until upper arms touch the floor, then press. The floor limits range, which many shoulders like.'] },
  { id: 'bench_press', name: 'Barbell bench press', pattern: 'push', equipment: [['barbell', 'bench', 'squat_rack']], level: 2, stresses: ['shoulder'], unit: 'reps', cues: ['Use safeties or a spotter.', 'Grip slightly wider than shoulders; lower to lower chest.', 'Keep feet planted and press back up over the shoulders.'] },
  { id: 'db_ohp', name: 'Dumbbell overhead press', pattern: 'push', equipment: [['dumbbells']], level: 2, stresses: ['shoulder', 'lower_back'], unit: 'reps', cues: ['Brace core and squeeze glutes.', 'Press overhead without leaning back.'] },
  { id: 'band_press', name: 'Banded chest press', pattern: 'push', equipment: [['resistance_bands']], level: 1, stresses: [], unit: 'reps', cues: ['Anchor band behind you at chest height.', 'Press forward and control the return.'] },

  // Pull
  { id: 'prone_ytw', name: 'Prone Y-T-W raise', pattern: 'pull', equipment: [[]], level: 1, stresses: [], unit: 'reps', cues: ['Lie face down, forehead resting on a towel.', 'Lift arms into a Y, then T, then W, squeezing shoulder blades.', 'Small, controlled range — this is an upper-back endurance drill.'] },
  { id: 'band_row', name: 'Band row', pattern: 'pull', equipment: [['resistance_bands']], level: 1, stresses: [], unit: 'reps', cues: ['Anchor the band at chest height.', 'Pull elbows back past your ribs, squeezing shoulder blades.'] },
  { id: 'db_row', name: 'One-arm dumbbell row', pattern: 'pull', equipment: [['dumbbells', 'bench'], ['dumbbells']], level: 1, stresses: [], unit: 'per side', cues: ['Support yourself on a bench or your knee.', 'Pull the dumbbell toward your hip, not your shoulder.', 'Keep your torso still.'] },
  { id: 'inverted_row', name: 'Inverted row', pattern: 'pull', equipment: [['barbell', 'squat_rack']], level: 2, stresses: [], unit: 'reps', cues: ['Set a bar at waist height in a rack.', 'Hang underneath with a straight body and pull chest to bar.'] },
  { id: 'pullup', name: 'Pull-up (or assisted)', pattern: 'pull', equipment: [['pullup_bar']], level: 3, stresses: ['shoulder'], unit: 'reps', cues: ['Start from a dead hang with shoulders engaged.', 'Pull until chin clears the bar.', 'Use a band for assistance or do slow negatives if needed.'] },
  { id: 'cable_row', name: 'Seated cable row', pattern: 'pull', equipment: [['cable_machine']], level: 1, stresses: [], unit: 'reps', cues: ['Sit tall, slight knee bend.', 'Row handle to your stomach, then reach forward with control.'] },

  // Lunge / single leg
  { id: 'reverse_lunge', name: 'Reverse lunge', pattern: 'lunge', equipment: [[]], level: 1, stresses: ['knee'], unit: 'per side', cues: ['Step back and lower until both knees are about 90°.', 'Push through the front foot to return.'] },
  { id: 'split_squat', name: 'Split squat (hold support if needed)', pattern: 'lunge', equipment: [[]], level: 1, stresses: [], unit: 'per side', cues: ['Staggered stance, hold a wall for balance if needed.', 'Lower straight down, keep the front heel planted.'] },
  { id: 'step_up', name: 'Step-up', pattern: 'lunge', equipment: [['box_or_step']], level: 1, stresses: [], unit: 'per side', cues: ['Whole foot on a sturdy box or step.', 'Drive through the top leg; avoid pushing off the bottom foot.'] },
  { id: 'db_lunge', name: 'Dumbbell walking lunge', pattern: 'lunge', equipment: [['dumbbells']], level: 2, stresses: ['knee'], unit: 'per side', cues: ['Hold dumbbells at your sides.', 'Take controlled steps; back knee lowers toward the floor.'] },

  // Core
  { id: 'dead_bug', name: 'Dead bug', pattern: 'core', equipment: [[]], level: 1, stresses: [], unit: 'per side', cues: ['Lie on your back, arms up, knees over hips.', 'Press low back gently into the floor.', 'Slowly extend opposite arm and leg, then switch.'] },
  { id: 'plank', name: 'Front plank', pattern: 'core', equipment: [[]], level: 1, stresses: ['shoulder'], unit: 'seconds', cues: ['Forearms under shoulders, body straight.', 'Squeeze glutes and brace like you are about to be poked in the stomach.'] },
  { id: 'side_plank', name: 'Side plank', pattern: 'core', equipment: [[]], level: 2, stresses: ['shoulder'], unit: 'seconds', cues: ['Elbow under shoulder, hips lifted.', 'Drop to knees for an easier version.'] },
  { id: 'bird_dog', name: 'Bird dog', pattern: 'core', equipment: [[]], level: 1, stresses: [], unit: 'per side', cues: ['On hands and knees, reach opposite arm and leg long.', 'Keep hips square — imagine balancing a cup on your back.'] },

  // Power (sport)
  { id: 'squat_jump', name: 'Squat jump (stick the landing)', pattern: 'power', equipment: [[]], level: 2, stresses: ['knee', 'ankle'], unit: 'reps', cues: ['Quarter squat, then jump up explosively.', 'Land softly in the same position and reset between reps.', 'Quality over quantity — stop if landings get loud.'] },
  { id: 'broad_jump', name: 'Broad jump', pattern: 'power', equipment: [['track_or_field'], []], level: 2, stresses: ['knee', 'ankle'], unit: 'reps', cues: ['Swing arms and jump forward as far as you can control.', 'Land softly with knees over toes; walk back to reset.'] },
  { id: 'med_skip', name: 'A-skip', pattern: 'power', equipment: [[]], level: 1, stresses: [], unit: 'seconds', cues: ['Rhythmic skip driving the knee up and foot down under the hip.', 'Tall posture, active arms.'] },

  // Conditioning
  { id: 'brisk_walk_intervals', name: 'Brisk walk / easy jog intervals', pattern: 'conditioning', equipment: [[]], level: 1, stresses: [], unit: 'seconds', cues: ['Alternate 2 minutes brisk walk with 1 minute easy jog (or faster walk).', 'You should be able to speak in short sentences.'] },
  { id: 'bike_intervals', name: 'Bike or rower intervals', pattern: 'conditioning', equipment: [['cardio_machine']], level: 1, stresses: [], unit: 'seconds', cues: ['30 seconds hard, 90 seconds easy.', 'Hard means about 8/10 effort — controlled, not all-out.'] },
  { id: 'rope_intervals', name: 'Jump rope intervals', pattern: 'conditioning', equipment: [['jump_rope']], level: 2, stresses: ['ankle'], unit: 'seconds', cues: ['Small, quick bounces on the balls of your feet.', '30–45 seconds on, 30 seconds off.'] },
  { id: 'shuttles', name: 'Shuttle runs', pattern: 'conditioning', equipment: [['track_or_field']], level: 2, stresses: ['knee', 'ankle'], unit: 'reps', cues: ['Mark two lines ~20 m apart.', 'Run, touch the line, turn, and return. Walk back to recover fully between reps.'] },
];

export const WARMUP = [
  { name: 'Easy movement (march, light jog, or bike)', detail: '3 minutes, gradually faster' },
  { name: "World's greatest stretch", detail: '3 per side' },
  { name: 'Leg swings (front-to-back, side-to-side)', detail: '8 each direction per leg' },
  { name: 'Arm circles and band pull-aparts (if you have a band)', detail: '10 each' },
  { name: 'One light set of your first exercise', detail: 'about 50% effort' },
];

export const COOLDOWN = [
  { name: 'Easy walk and slow breathing', detail: '2 minutes' },
  { name: 'Hip flexor stretch (half-kneeling)', detail: '30 seconds per side' },
  { name: 'Hamstring stretch', detail: '30 seconds per side' },
  { name: 'Chest/doorway stretch', detail: '30 seconds' },
];

export const MOBILITY_FLOW = [
  { name: 'Cat-cow', detail: '8 slow reps' },
  { name: 'Thoracic open book', detail: '6 per side' },
  { name: 'Hip 90/90 switches', detail: '8 per side' },
  { name: "World's greatest stretch", detail: '4 per side' },
  { name: 'Ankle rocks (knee to wall)', detail: '10 per side' },
  { name: 'Deep squat hold (hold support)', detail: '3 × 20 seconds' },
  { name: 'Child’s pose with side reach', detail: '30 seconds per side' },
];

export function exerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}
