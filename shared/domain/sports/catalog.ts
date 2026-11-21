import type { SportsPrefs } from '../../schemas';

export type SportId = SportsPrefs['sports'][number]['sport'];

/**
 * Sports knowledge base.
 *
 * Sources: every URL below was located through web search when this file was
 * written. Drills are widely used coaching drills; each is tagged with the
 * resource it aligns with, or "general" when no specific source backs it.
 * Self-tests compare you with YOUR OWN earlier results — the app never invents
 * norms or benchmarks for your age.
 */

export interface SourceRef {
  id: string;
  publisher: string;
  title: string;
  url: string;
  kind: 'governing_body' | 'research' | 'coaching';
  note: string;
}

export interface Skill {
  id: string;
  label: string;
  /** Search words for vetted-channel video search. */
  query: string;
  /** Words in coach feedback or goals that point to this skill (lowercase stems). */
  keywords?: string[];
}

export interface Drill {
  id: string;
  skill: string;
  name: string;
  level: 1 | 2 | 3;
  minutes: number;
  solo: boolean;
  space: string;
  equipment: string;
  howTo: string;
  cues: string[];
  measure: string;
  /** SourceRef id, or 'general' for widely used drills without a single source. */
  basis: string;
}

export interface SkillTest {
  id: string;
  skill: string;
  name: string;
  howTo: string;
  unit: string;
  better: 'higher' | 'lower';
}

export interface VideoChannel {
  name: string;
  handle: string;
  /** Exact channel id when verified; otherwise resolved from the handle at runtime. */
  channelId?: string;
  /** The resolved channel's title must contain this, or the channel is ignored. */
  expectTitle: string;
  official: boolean;
}

export interface SportInfo {
  label: string;
  positions: string[];
  skills: Skill[];
  drills: Drill[];
  tests: SkillTest[];
  sources: string[];
  channels: VideoChannel[];
  safety: string[];
}

/* ---------------- sources ---------------- */

export const SOURCES: Record<string, SourceRef> = {
  nsca_ltad: {
    id: 'nsca_ltad', publisher: 'National Strength and Conditioning Association', kind: 'research',
    title: 'Position Statement on Long-Term Athletic Development',
    url: 'https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/long-term-athletic-development-position-statement/',
    note: 'Peer-reviewed consensus (J Strength Cond Res, 2016) on safe, progressive training for young athletes. Basis for how strength work is dosed here.',
  },
  fifa11_meta: {
    id: 'fifa11_meta', publisher: 'PubMed (systematic review & meta-analysis)', kind: 'research',
    title: 'FIFA 11 / 11+ injury-prevention programmes and overall injury rate',
    url: 'https://pubmed.ncbi.nlm.nih.gov/28087568/',
    note: 'Pooled randomised trials found the FIFA 11+ warm-up lowered injury rates (about 39%). It has also been studied in basketball.',
  },
  pitch_smart: {
    id: 'pitch_smart', publisher: 'MLB & USA Baseball — Pitch Smart', kind: 'governing_body',
    title: 'Pitching guidelines for youth and adolescent pitchers',
    url: 'https://www.mlb.com/pitch-smart/pitching-guidelines',
    note: 'Official pitch-count and rest guidelines. Your league’s rules may be stricter — follow whichever is stricter.',
  },
  usab_courses: {
    id: 'usab_courses', publisher: 'USA Basketball', kind: 'governing_body',
    title: 'Coaching courses and player development curriculum',
    url: 'https://community.usab.com/users/on_demand_courses',
    note: 'National governing body. Its curriculum is skill-based rather than age-based; some material needs a coach licence.',
  },
  breakthrough_drills: {
    id: 'breakthrough_drills', publisher: 'Breakthrough Basketball', kind: 'coaching',
    title: '200+ basketball drills by category',
    url: 'https://www.breakthroughbasketball.com/drills/basketballdrills.html',
    note: 'Long-running basketball coaching site with free drills organised by skill.',
  },
  ussoccer_way: {
    id: 'ussoccer_way', publisher: 'U.S. Soccer', kind: 'governing_body',
    title: 'The U.S. Way — player development framework',
    url: 'https://www.ussoccer.com/ourvision/us-way',
    note: 'National governing body’s player-centred development guidance and age-group coaching guides.',
  },
  usafb_fdm: {
    id: 'usafb_fdm', publisher: 'USA Football', kind: 'governing_body',
    title: 'Levels of Contact and Football Development Model',
    url: 'https://usafootball.com/resources-tools/coach/levels-of-contact',
    note: 'National governing body. Contact is built up in levels; solo work here stays at the no-contact level.',
  },
  usafb_tackling: {
    id: 'usafb_tackling', publisher: 'NFL.com (USA Football Heads Up Tackling)', kind: 'governing_body',
    title: 'Five drills for textbook tackling',
    url: 'https://www.nfl.com/news/five-drills-for-textbook-tackling-0ap2000000280824',
    note: 'Heads Up Tackling fundamentals designed to reduce helmet contact.',
  },
  usavb_academy: {
    id: 'usavb_academy', publisher: 'USA Volleyball', kind: 'governing_body',
    title: 'Coach Academy and resource library',
    url: 'https://usavolleyball.org/resources-for-coaches/coach-academy/',
    note: 'National governing body’s coaching education, including fundamental skills modules.',
  },
  usaswim_training: {
    id: 'usaswim_training', publisher: 'USA Swimming', kind: 'governing_body',
    title: 'Training & technique for swimmers',
    url: 'https://usaswimming.org/swimmers-parents/swimmers/training-techniques',
    note: 'National governing body’s articles and videos on stroke technique and training.',
  },
  usta_pd: {
    id: 'usta_pd', publisher: 'USTA Player Development', kind: 'governing_body',
    title: 'Strength & conditioning and footwork drills',
    url: 'https://www.playerdevelopment.usta.com/Strength_Conditioning',
    note: 'National governing body’s athletic-development and footwork material for junior players.',
  },
  usatf_coaches: {
    id: 'usatf_coaches', publisher: 'USA Track & Field', kind: 'governing_body',
    title: 'Coaching education programs',
    url: 'https://usatf.org/programs/coaches',
    note: 'National governing body’s coaching education (Developmental Coach and Level 1 courses).',
  },
};

const d = (skill: string, id: string, name: string, level: 1 | 2 | 3, minutes: number, howTo: string, cues: string[], measure: string, basis: string, opts: { solo?: boolean; space?: string; equipment?: string } = {}): Drill => ({
  id, skill, name, level, minutes, howTo, cues, measure, basis, solo: opts.solo ?? true, space: opts.space ?? 'Small area', equipment: opts.equipment ?? 'None',
});

/* ---------------- sports ---------------- */

export const SPORTS_CATALOG: Record<SportId, SportInfo> = {
  basketball: {
    label: 'Basketball',
    positions: ['Point guard', 'Shooting guard', 'Wing / small forward', 'Power forward', 'Center'],
    skills: [
      { id: 'shooting', label: 'Shooting', query: 'shooting form drills' },
      { id: 'ball_handling', label: 'Ball handling', query: 'ball handling drills' },
      { id: 'finishing', label: 'Finishing at the rim', query: 'finishing layup drills' },
      { id: 'passing', label: 'Passing', query: 'passing drills' },
      { id: 'defense', label: 'Defense & footwork', query: 'defensive footwork drills' },
      { id: 'rebounding', label: 'Rebounding & boxing out', query: 'rebounding box out drills', keywords: ['rebound', 'box out', 'boards', 'second chance'] },
      { id: 'post', label: 'Post moves', query: 'post moves footwork', keywords: ['post', 'back to the basket', 'drop step', 'hook'] },
    ],
    drills: [
      d('shooting', 'form_shooting', 'Form shooting', 1, 10, 'One hand, 1–2 m from the rim, then step back once you make 8 of 10.', ['Elbow under the ball', 'Hold the follow-through', 'Same release every time'], 'Makes out of 10 at each distance', 'breakthrough_drills', { space: 'Hoop', equipment: 'Ball' }),
      d('shooting', 'spot_shooting', 'Five-spot game-speed shooting', 2, 15, 'Ten shots from each of five spots. Catch, square up and shoot at game speed — jog between spots.', ['Feet ready before the catch', 'Same rhythm each shot'], 'Makes out of 50 — matches the 5-spot test', 'breakthrough_drills', { space: 'Half court', equipment: 'Ball' }),
      d('shooting', 'free_throws_tired', 'Free throws when tired', 2, 10, '20 seconds of fast sprints or defensive slides, then 2 free throws. Repeat 10 times.', ['Same routine every time', 'Breathe out before the shot'], 'Makes out of 20', 'general', { space: 'Half court', equipment: 'Ball' }),
      d('ball_handling', 'stationary_series', 'Stationary dribble series', 1, 8, '30 seconds each: pound, crossover, between the legs, behind the back. Both hands.', ['Eyes up', 'Ball below the waist', 'Use your fingertips'], 'Rounds completed without losing the ball', 'breakthrough_drills', { equipment: 'Ball' }),
      d('ball_handling', 'two_ball', 'Two-ball dribbling', 2, 8, '30-second rounds: together, alternating, one high/one low.', ['Eyes up', 'Weak hand stays strong'], 'Rounds without losing either ball', 'general', { equipment: '2 balls' }),
      d('ball_handling', 'cone_attacks', 'Cone attack moves', 3, 12, 'Set 5 cones in a zig-zag. At each cone make a move (cross, between, hesitation) and explode to the next.', ['Low before the move', 'Change speed, not just direction'], 'Time for the full run', 'general', { space: 'Half court', equipment: 'Ball, 5 cones' }),
      d('finishing', 'mikan', 'Mikan drill', 1, 6, 'Under the rim, alternate right-hand and left-hand layups without letting the ball touch the floor.', ['Use the backboard', 'Opposite knee up'], 'Makes in 30 seconds — matches the Mikan test', 'breakthrough_drills', { space: 'Hoop', equipment: 'Ball' }),
      d('finishing', 'finishing_series', 'Finishing package', 2, 12, 'From the wing: 5 each of layup, reverse layup, power layup and euro-step — both sides.', ['Protect the ball', 'Finish high off the glass'], 'Makes out of 40', 'general', { space: 'Half court', equipment: 'Ball' }),
      d('passing', 'wall_passing', 'Wall passing', 1, 8, 'Chest, bounce and one-hand push passes to a target on a wall from 3–4 m. 30 seconds each.', ['Step into the pass', 'Thumbs down on the follow-through'], 'Clean passes in 30 seconds', 'general', { space: 'Wall', equipment: 'Ball' }),
      d('defense', 'slide_drill', 'Defensive slides', 1, 8, 'Slide lane-line to lane-line and back for 30 seconds, rest 30 seconds, 6 rounds.', ['Wide stance, hips low', 'Don’t cross your feet'], 'Lane touches in 30 seconds', 'general', { space: 'Half court' }),
      d('defense', 'closeouts', 'Closeouts', 2, 8, 'Start under the rim, sprint to a cone at the 3-point line, chop your feet, hand high. Back-pedal and repeat.', ['Short choppy steps at the end', 'Hand up, eyes on the ball'], 'Controlled reps (no lunging)', 'general', { space: 'Half court', equipment: 'Cone' }),
      d('shooting', 'off_dribble', 'Pull-ups off the dribble', 3, 12, 'From the wing, one hard dribble each way into a pull-up jumper, then two-dribble pull-ups. 10 each direction.', ['Stop on a dime: hop or 1-2', 'Shoulders square before you rise'], 'Makes out of 40', 'breakthrough_drills', { space: 'Half court', equipment: 'Ball' }),
      d('passing', 'pass_on_move', 'Passing on the move', 2, 10, 'Dribble at a cone, make a live-dribble pass (push, bounce, wrap-around) to a wall target without stopping. Both hands.', ['Pass off the dribble, no hold', 'Eyes on the target, not the ball'], 'Clean passes on target out of 20', 'general', { space: 'Wall + half court', equipment: 'Ball, cone' }),
      d('passing', 'pick_roll_reads', 'Pick-and-roll reads', 3, 12, 'With a partner as the screener: come off the screen and make the right read each time: pocket bounce pass, lob, or skip to the corner.', ['Get two feet into the paint', 'Read the big defender, not the ball'], 'Correct reads out of 15', 'general', { solo: false, space: 'Half court', equipment: 'Ball' }),
      d('defense', 'zigzag', 'Zig-zag slides', 2, 8, 'Slide diagonally baseline to half court, drop-stepping at each sideline or cone. 4 trips.', ['Hips lead the turn', 'Stay low through the change'], 'Trips without crossing your feet', 'general', { space: 'Full court' }),
      d('rebounding', 'box_out_chase', 'Box out and chase', 1, 8, 'Toss the ball off the backboard, turn and seal an imaginary man (or a partner), then go get the ball at its highest point. Chin it.', ['Contact first, then the ball', 'Two hands, chin the ball'], 'Clean rebounds out of 15', 'general', { space: 'Hoop', equipment: 'Ball' }),
      d('rebounding', 'tip_drill', 'Continuous tip drill', 2, 6, 'Tip the ball against the backboard continuously with one hand, 10 tips, switch hands. Finish with a put-back.', ['Jump off two feet', 'Fingertips, high release'], 'Tips in a row each hand', 'general', { space: 'Hoop', equipment: 'Ball' }),
      d('post', 'drop_step_series', 'Drop step and up-and-under', 1, 10, 'Catch on the block, feel the defender, drop step baseline to a power finish; then shot-fake into an up-and-under. Both blocks.', ['Seal before the catch', 'Pivot foot stays down'], 'Makes out of 20', 'breakthrough_drills', { space: 'Hoop', equipment: 'Ball' }),
      d('post', 'hook_shot', 'Jump hook ladder', 2, 10, 'Jump hooks from the block, the middle and the short corner. 10 each hand.', ['Shoulder between the defender and the ball', 'Soft wrist at the top'], 'Makes out of 30', 'general', { space: 'Hoop', equipment: 'Ball' }),
    ],
    tests: [
      { id: 'five_spot', skill: 'shooting', name: '5-spot shooting (50 shots)', howTo: '10 shots from each of 5 spots at game speed.', unit: 'makes / 50', better: 'higher' },
      { id: 'free_throws', skill: 'shooting', name: 'Free throws (20)', howTo: '20 free throws, your normal routine.', unit: 'makes / 20', better: 'higher' },
      { id: 'mikan_30', skill: 'finishing', name: 'Mikan drill (30 s)', howTo: 'Count makes in 30 seconds.', unit: 'makes', better: 'higher' },
      { id: 'lane_slides', skill: 'defense', name: 'Lane slides (30 s)', howTo: 'Count lane-line touches in 30 seconds.', unit: 'touches', better: 'higher' },
    ],
    sources: ['usab_courses', 'breakthrough_drills', 'fifa11_meta', 'nsca_ltad'],
    channels: [
      { name: 'Breakthrough Basketball', handle: '@BreakthroughBBall', expectTitle: 'Breakthrough', official: false },
    ],
    safety: [
      'An injury-prevention warm-up (FIFA 11+ style: running, strength, balance and landing exercises) has been studied in basketball as well as soccer.',
      'Practice landing softly on both feet with knees over toes — it’s part of most knee-injury prevention programs.',
    ],
  },

  soccer: {
    label: 'Soccer',
    positions: ['Goalkeeper', 'Center back', 'Full back', 'Defensive midfielder', 'Attacking midfielder', 'Winger', 'Striker'],
    skills: [
      { id: 'first_touch', label: 'First touch', query: 'first touch drills' },
      { id: 'passing', label: 'Passing', query: 'passing technique' },
      { id: 'dribbling', label: 'Dribbling & 1v1', query: 'dribbling drills' },
      { id: 'finishing', label: 'Finishing', query: 'finishing shooting technique' },
      { id: 'defending', label: 'Defending', query: 'defending 1v1' },
      { id: 'goalkeeping', label: 'Goalkeeping', query: 'goalkeeper training drills', keywords: ['keeper', 'goalkeep', 'save', 'dive', 'distribution', 'handling'] },
      { id: 'crossing', label: 'Crossing & wide play', query: 'crossing technique', keywords: ['cross', 'wide', 'overlap', 'delivery'] },
      { id: 'fitness_repeat', label: 'Repeat sprints', query: 'soccer repeated sprint training', keywords: ['fitness', 'stamina', 'endurance', 'tired', 'engine', 'work rate'] },
    ],
    drills: [
      d('first_touch', 'wall_touch', 'Wall pass and receive', 1, 10, 'Pass against a wall from 5 m. Receive across your body with the inside of the back foot, then pass again. Switch feet.', ['Open your hips to the field', 'Touch away from pressure'], 'Clean receptions in 2 minutes', 'ussoccer_way', { space: 'Wall + 5 m', equipment: 'Ball' }),
      d('first_touch', 'juggling', 'Juggling', 1, 8, 'Juggle with feet, thighs and head. Reset calmly when it drops.', ['Lock the ankle', 'Small, soft touches'], 'Best streak', 'general', { equipment: 'Ball' }),
      d('passing', 'two_touch_wall', 'Two-touch wall passing', 1, 8, 'Alternate feet: control, pass. 30 seconds per round, 5 rounds.', ['Plant foot beside the ball', 'Strike through the middle'], 'Passes in 30 seconds', 'general', { space: 'Wall', equipment: 'Ball' }),
      d('passing', 'gate_passing', 'Gate passing', 2, 12, 'Set 5 small cone “gates” at different distances. Pass through each gate off a wall or to a partner; long passes for far gates.', ['Look before you pass', 'Weight the pass for the receiver'], 'Gates hit out of 20', 'general', { space: '20 m', equipment: 'Ball, 10 cones' }),
      d('dribbling', 'cone_slalom', 'Cone slalom', 1, 10, 'Weave through 6 cones 1 m apart using inside and outside of both feet. Jog back.', ['Touch every stride', 'Eyes up between touches'], 'Time per run without hitting cones', 'general', { space: '15 m strip', equipment: 'Ball, 6 cones' }),
      d('dribbling', 'move_and_explode', 'Move and explode', 2, 10, 'Dribble at a cone, make a move (step-over, scissors, cut), then accelerate for 5 m.', ['Sell the fake with your shoulders', 'Explode after the move'], 'Controlled reps each side', 'general', { space: '20 m', equipment: 'Ball, cones' }),
      d('finishing', 'placement_finishing', 'Placement finishing', 2, 12, 'From the edge of the box, aim for the corners of the goal. 10 shots each foot.', ['Head still, look at the target', 'Placement before power'], 'Corners hit out of 20', 'general', { space: 'Goal', equipment: 'Balls, goal' }),
      d('defending', 'jockey_shadow', 'Jockey shadowing', 1, 8, 'With a partner dribbling slowly, stay side-on and steer them toward a sideline. Switch roles.', ['Side-on stance', 'Don’t dive in'], 'Times you force the attacker wide', 'general', { solo: false, space: '10 × 10 m' }),
      d('first_touch', 'scanning_receive', 'Scan and receive', 2, 10, 'Partner or wall passes; before each ball arrives, check over both shoulders, then take your first touch into the space a cone (or partner) shows.', ['Scan before the ball comes', 'Open body, back foot'], 'Correct-direction touches out of 20', 'ussoccer_way', { solo: false, space: '15 m', equipment: 'Ball, cones' }),
      d('passing', 'long_diagonal', 'Long diagonal switches', 3, 12, 'Hit driven and lofted 30–40 m diagonals to a target zone, both feet.', ['Lean back slightly for loft, over the ball to drive', 'Strike the lower half of the ball'], 'Balls landing in the zone out of 20', 'general', { space: '40 m', equipment: 'Balls, cones' }),
      d('dribbling', 'one_v_one', '1v1 to a goal', 3, 12, 'Against a partner, beat them 1v1 into a small goal or through a gate. 30-second rounds.', ['Attack at speed', 'Commit the defender, then change pace'], 'Rounds won out of 10', 'general', { solo: false, space: '15 × 10 m', equipment: 'Ball, cones' }),
      d('finishing', 'one_touch_finishing', 'One-touch finishing', 3, 12, 'Partner plays balls across the box; finish first time, near post and far post.', ['Arrive late, attack the ball', 'Side-foot for placement'], 'Goals out of 20', 'general', { solo: false, space: 'Goal', equipment: 'Balls, goal' }),
      d('defending', 'recovery_runs', 'Recovery runs and block', 2, 10, 'Start 5 m goal-side of a cone; on a cue, sprint back to recover position, then block a shot from a partner.', ['Run the shortest line to goal', 'Get your body behind the ball'], 'Recovered in time out of 10', 'general', { solo: false, space: '25 m', equipment: 'Ball, cones' }),
      d('goalkeeping', 'set_catch', 'Set position and W catch', 1, 10, 'Partner or wall: catch shots at chest and head height in the W shape, and scoop low balls. 3 × 10.', ['Set before the shot', 'Thumbs behind the ball'], 'Clean catches out of 30', 'general', { solo: false, space: 'Goal', equipment: 'Balls, gloves' }),
      d('goalkeeping', 'dive_progression', 'Diving progression', 2, 12, 'From kneeling, then a crouch, then standing: collapse-dive to balls rolled and thrown to each side. Soft ground only.', ['Land on your side, not your elbow', 'Hands lead, top hand behind the ball'], 'Saves held each side out of 10', 'general', { solo: false, space: 'Goal, grass', equipment: 'Balls, gloves' }),
      d('goalkeeping', 'distribution', 'Distribution: throws and kicks', 2, 12, 'Roll, overarm throw and goal kicks to target zones at different distances.', ['Step toward the target', 'Pick your pass before you catch'], 'Balls into the zone out of 20', 'general', { space: 'Half field', equipment: 'Balls, cones' }),
      d('crossing', 'cross_zones', 'Crossing to zones', 2, 12, 'Dribble down the wing and cross into near-post, penalty-spot and far-post zones. Both feet.', ['Look up before you cross', 'Whip it, don’t float it'], 'Crosses into the zone out of 20', 'general', { space: 'Wide area + box', equipment: 'Balls, cones' }),
      d('fitness_repeat', 'repeat_sprints', 'Repeat sprints', 2, 12, '6–10 × 30 m sprints with 30 seconds of easy jogging between. Rest 3 minutes, repeat the set once if fresh.', ['Full effort on every sprint', 'Recover by jogging, not stopping'], 'Your slowest sprint compared with your fastest', 'general', { space: '40 m' }),
    ],
    tests: [
      { id: 'juggle_best', skill: 'first_touch', name: 'Juggling best streak', howTo: 'Best of 3 attempts.', unit: 'touches', better: 'higher' },
      { id: 'wall_30', skill: 'passing', name: 'Wall passes (30 s)', howTo: 'Two-touch passes from 5 m in 30 seconds.', unit: 'passes', better: 'higher' },
      { id: 'slalom', skill: 'dribbling', name: '6-cone slalom', howTo: 'Cones 1 m apart, there and back.', unit: 'seconds', better: 'lower' },
      { id: 'corners', skill: 'finishing', name: 'Corner finishing (20)', howTo: '10 shots each foot from the edge of the box.', unit: 'corners hit / 20', better: 'higher' },
    ],
    sources: ['ussoccer_way', 'fifa11_meta', 'nsca_ltad'],
    channels: [{ name: 'U.S. Soccer', handle: '@ussoccer', expectTitle: 'U.S. Soccer', official: true }],
    safety: ['Use the FIFA 11+ warm-up before training at least twice a week — pooled trials found fewer injuries. Before matches, use only its running parts.'],
  },

  american_football: {
    label: 'American football',
    positions: ['Quarterback', 'Running back', 'Wide receiver', 'Tight end', 'Offensive line', 'Defensive line', 'Linebacker', 'Defensive back', 'Kicker / punter'],
    skills: [
      { id: 'footwork', label: 'Footwork & agility', query: 'footwork agility drills' },
      { id: 'catching', label: 'Catching', query: 'catching drills receivers' },
      { id: 'throwing', label: 'Throwing (QB)', query: 'quarterback throwing mechanics' },
      { id: 'tackling', label: 'Tackling technique', query: 'heads up tackling' },
      { id: 'stance_start', label: 'Stance & get-off', query: 'stance and start drills' },
      { id: 'route_running', label: 'Route running & release', query: 'route running release drills', keywords: ['route', 'release', 'separation', 'break', 'press', 'get open'] },
      { id: 'coverage', label: 'Coverage & backpedal', query: 'defensive back backpedal drills', keywords: ['coverage', 'backpedal', 'cover', 'man to man', 'zone', 'press', 'break on the ball'] },
      { id: 'ball_security', label: 'Ball security', query: 'ball security drills running back', keywords: ['fumble', 'ball security', 'carry', 'protect the ball'] },
      { id: 'blocking', label: 'Blocking & hand use', query: 'offensive line blocking drills', keywords: ['block', 'pass pro', 'hands', 'leverage', 'pad level'] },
      { id: 'pass_rush', label: 'Pass rush & shedding blocks', query: 'pass rush moves drills', keywords: ['rush', 'shed', 'swim', 'rip', 'sack', 'get off blocks'] },
      { id: 'kicking', label: 'Kicking & punting', query: 'kicking technique', keywords: ['kick', 'punt', 'field goal', 'kickoff'] },
    ],
    drills: [
      d('footwork', 'ladder', 'Agility ladder series', 1, 10, 'Two feet in each box, lateral in-in-out-out, Ickey shuffle. 3 runs each, walk back.', ['On the balls of your feet', 'Arms drive with legs'], 'Clean runs without touching the rungs', 'general', { space: '10 m', equipment: 'Agility ladder (or chalk lines)' }),
      d('footwork', 'pro_agility', '5-10-5 shuttle', 2, 10, 'Start in a 3-point stance, sprint 5 yd, touch the line, 10 yd back, 5 yd through. Full rest between reps.', ['Low hips into the turn', 'Plant with the outside foot'], 'Time — matches the 5-10-5 test', 'general', { space: '15 yd', equipment: 'Cones' }),
      d('catching', 'hands_drill', 'Diamond hands', 1, 10, 'Partner throws high, low and away. Thumbs together above the chest, pinkies together below.', ['Eyes to the tuck', 'Catch with your hands, not your chest'], 'Catches out of 20', 'usafb_fdm', { solo: false, space: '15 yd', equipment: 'Football' }),
      d('catching', 'wall_tennis_ball', 'Tennis-ball reaction catches', 1, 6, 'Throw a tennis ball off a wall and catch it one-handed, alternating hands.', ['Watch it all the way in'], 'Catches in 60 seconds', 'general', { space: 'Wall', equipment: 'Tennis ball' }),
      d('throwing', 'one_knee', 'One-knee throws', 1, 8, 'On one knee, throw to a partner focusing on upper-body mechanics: grip, elbow at shoulder height, follow through to the opposite hip.', ['Ball up by the ear', 'Point the front shoulder at the target'], 'On-target throws out of 20', 'general', { solo: false, space: '10 yd', equipment: 'Football' }),
      d('tackling', 'breakdown_form', 'Breakdown and form (no contact)', 1, 8, 'Practice the Heads Up fundamentals without contact: breakdown, buzz the feet, hit position, shoot the hips toward a bag or cone.', ['Eyes up, head out of the tackle', 'Shoulder leads, never the helmet'], 'Clean form reps', 'usafb_tackling', { equipment: 'Cone or bag' }),
      d('stance_start', 'get_off', 'Stance and get-off', 1, 8, 'From your position stance, explode for 5 yards on a visual cue. Walk back, repeat.', ['Weight balanced, back flat', 'First step short and fast'], 'Clean starts (no false steps)', 'usafb_fdm', { space: '10 yd' }),
      d('catching', 'contested_catches', 'Contested and over-the-shoulder catches', 3, 10, 'Partner throws back-shoulder, over-the-shoulder and high-point balls while a second partner swipes at your hands (no contact to the body).', ['Attack the ball at its highest point', 'Squeeze and tuck through the ground'], 'Catches out of 20', 'general', { solo: false, space: '30 yd', equipment: 'Football' }),
      d('throwing', 'drop_rhythm', 'Drop-back rhythm throws', 2, 12, 'Three- and five-step drops, hitting a target (net, partner or cone) on the last step. Mix quick game and intermediate depths.', ['Throw on time with the last step', 'Eyes downfield, not on your feet'], 'On-target throws out of 20', 'general', { solo: false, space: '25 yd', equipment: 'Football, target' }),
      d('throwing', 'throw_on_move', 'Throwing on the move', 3, 10, 'Roll out right and left, square your shoulders and throw on the run to a partner or target.', ['Shoulders to the target', 'Follow through toward the target'], 'On-target throws out of 16', 'general', { solo: false, space: '25 yd', equipment: 'Football' }),
      d('route_running', 'cone_routes', 'Cone route tree', 1, 12, 'Set cones at 5, 10 and 15 yd. Run slant, out, in, curl and comeback, sinking your hips at each break. 3 reps each, walk back.', ['Sell vertical first', 'Drop your hips and snap your head around at the break'], 'Breaks without rounding the route', 'general', { space: '20 yd', equipment: '4 cones, football optional' }),
      d('route_running', 'release_drill', 'Release off the line', 2, 10, 'Against a partner holding a bag (or a cone as the defender), work a quick release: jab, swipe and rip, then sprint 10 yd. Both sides.', ['Hands fast, feet faster', 'Win the first 3 yards'], 'Clean releases out of 12', 'general', { solo: false, space: '15 yd', equipment: 'Bag or cone' }),
      d('route_running', 'stem_break_speed', 'Stems and breaks at full speed', 3, 12, 'Full-speed routes with a ball thrown on the break: double-moves, option routes, comebacks. Record your route and compare.', ['Same speed into every break', 'Eyes back to the QB immediately'], 'Catches out of the break out of 15', 'general', { solo: false, space: '30 yd', equipment: 'Football' }),
      d('coverage', 'backpedal_w', 'Backpedal and break (W drill)', 1, 10, 'Backpedal 5 yd, plant and break at 45° to a cone, then backpedal again. Make a W through 5 cones.', ['Weight over your toes, chest over knees', 'Plant and drive, no false steps'], 'Clean breaks out of 10', 'general', { space: '15 yd', equipment: '5 cones' }),
      d('coverage', 'mirror_drill', 'Mirror drill', 2, 8, 'Partner runs random moves between two cones 5 yd apart; stay square and mirror them. 15-second reps.', ['Eyes on the hips', 'Shuffle, don’t cross over'], 'Reps where you stay in front', 'general', { solo: false, space: '5 × 5 yd', equipment: '2 cones' }),
      d('coverage', 'high_point', 'Ball skills: high point and break up', 2, 10, 'Partner throws jump balls and back-shoulder throws; turn, find the ball and catch it or play through the hands. Both shoulders.', ['Turn your head, find the ball', 'Play through the hands, not the body'], 'Interceptions or breakups out of 15', 'general', { solo: false, space: '30 yd', equipment: 'Football' }),
      d('ball_security', 'high_tight', 'High-and-tight carry', 1, 8, 'Carry the ball high and tight (five points of pressure) through cones while a partner swats at it. Switch arms at each sideline.', ['Elbow tight, ball at the chest', 'Switch arms away from the defender'], 'Runs without losing the ball', 'general', { solo: false, space: '20 yd', equipment: 'Football, cones' }),
      d('blocking', 'hand_placement', 'First step and hand placement', 1, 8, 'From your stance, first step and punch into a bag or partner pad with thumbs up, hands inside. 5 yd drive.', ['Pad level low, eyes up', 'Hands inside the frame'], 'Clean reps (low, hands inside)', 'usafb_fdm', { solo: false, space: '10 yd', equipment: 'Bag or pad' }),
      d('blocking', 'mirror_pass_pro', 'Pass-pro kick-slide mirror', 2, 10, 'Kick-slide to mirror a partner rushing to cones, then punch on a cue. Stay balanced.', ['Never cross your feet', 'Short, quick kicks'], 'Reps kept square to the rusher', 'general', { solo: false, space: '10 × 10 yd', equipment: 'Cones' }),
      d('pass_rush', 'rip_swim_bag', 'Get-off into rip and swim', 2, 10, 'Explode out of your stance on a ball-snap cue and work rip and swim moves on a bag, finishing 5 yd past it.', ['Win the first step', 'Hands and feet together'], 'Clean moves out of 12', 'general', { solo: false, space: '10 yd', equipment: 'Bag' }),
      d('kicking', 'kick_form', 'Plant and contact form', 1, 10, 'Walk-through approach, plant foot beside the ball, lock the ankle, swing through. 15 short kicks into a net.', ['Plant foot points at the target', 'Head down through contact'], 'Clean contacts out of 15', 'general', { space: 'Net or field', equipment: 'Football, tee' }),
      d('kicking', 'distance_ladder', 'Distance ladder', 2, 15, 'Field goals (or punts for distance and hang time) from short to long, 3 kicks per spot.', ['Same routine every kick', 'Smooth, not hard'], 'Makes per distance', 'general', { space: 'Field', equipment: 'Footballs, tee' }),
      d('footwork', 'three_cone', 'Three-cone (L) drill', 2, 10, 'Cones in an L, 5 yd apart: sprint, touch, back, around the far cone in a figure-8 and finish. Full rest.', ['Lean into the turns', 'Short steps around the cone'], 'Time (best of 3)', 'general', { space: '10 yd', equipment: '3 cones' }),
    ],
    tests: [
      { id: 'shuttle_5105', skill: 'footwork', name: '5-10-5 shuttle', howTo: 'Best of 2, hand-timed.', unit: 'seconds', better: 'lower' },
      { id: 'catches_20', skill: 'catching', name: 'Catches out of 20', howTo: 'Mixed high, low and away throws.', unit: 'catches / 20', better: 'higher' },
      { id: 'sprint_20yd', skill: 'stance_start', name: '20-yard sprint', howTo: 'From your stance, best of 2.', unit: 'seconds', better: 'lower' },
      { id: 'route_catches', skill: 'route_running', name: 'Route-tree catches (15)', howTo: '3 each of slant, out, in, curl and comeback with a thrower.', unit: 'catches / 15', better: 'higher' },
      { id: 'w_drill', skill: 'coverage', name: 'W-drill time', howTo: 'Backpedal-and-break through 5 cones, best of 2.', unit: 'seconds', better: 'lower' },
    ],
    sources: ['usafb_fdm', 'usafb_tackling', 'nsca_ltad'],
    channels: [{ name: 'USA Football', handle: '@usafootball', channelId: 'UCTefHYNn3fUFomDvexQFx6w', expectTitle: 'USA Football', official: true }],
    safety: ['Never lead with the helmet. Solo tackling work here is technique only — live contact should only happen in coached practice.', 'Any suspected head injury means stop and get checked by a medical professional before returning.'],
  },

  baseball_softball: {
    label: 'Baseball / softball',
    positions: ['Pitcher', 'Catcher', 'Infield', 'Outfield'],
    skills: [
      { id: 'hitting', label: 'Hitting', query: 'hitting drills' },
      { id: 'fielding', label: 'Fielding', query: 'infield fielding drills' },
      { id: 'throwing', label: 'Throwing', query: 'throwing mechanics' },
      { id: 'pitching', label: 'Pitching', query: 'pitching mechanics youth' },
      { id: 'baserunning', label: 'Baserunning', query: 'baserunning' },
      { id: 'catching_skills', label: 'Catcher receiving & blocking', query: 'catcher blocking receiving drills', keywords: ['catcher', 'block', 'frame', 'receive', 'pop time'] },
    ],
    drills: [
      d('hitting', 'tee_work', 'Tee work (3 zones)', 1, 15, '10 swings each with the tee inside, middle and outside.', ['Balanced finish', 'Barrel through the ball, line drives'], 'Line drives out of 30', 'general', { space: 'Net or field', equipment: 'Bat, tee, balls' }),
      d('hitting', 'soft_toss', 'Soft toss', 2, 12, 'Partner tosses from the side into the zone; drive the ball into a net.', ['Load early', 'Head still through contact'], 'Hard contact out of 20', 'general', { solo: false, space: 'Net', equipment: 'Bat, balls' }),
      d('fielding', 'wall_ball', 'Wall-ball fielding', 1, 10, 'Throw against a wall and field the rebound — forehand, backhand and short hops.', ['Glove out front', 'Feet move before the glove'], 'Clean fields out of 30', 'general', { space: 'Wall + 10 m', equipment: 'Glove, ball' }),
      d('throwing', 'progressive_catch', 'Progressive catch', 1, 12, 'Start at 10 m and increase distance gradually; finish with crisp throws at your normal distance.', ['Lead with the glove-side shoulder', 'Finish over the front leg'], 'Throws to the chest out of 20', 'general', { solo: false, space: 'Field', equipment: 'Glove, ball' }),
      d('pitching', 'towel_drill', 'Towel drill', 1, 8, 'Hold a small towel like a ball and work through your delivery, snapping the towel at release toward a target.', ['Stride straight to the target', 'Full arm path'], 'Clean reps — no ball, no pitch count', 'pitch_smart', { equipment: 'Hand towel' }),
      d('baserunning', 'home_to_first', 'Home to first', 1, 8, 'Swing and sprint through the bag, then walk back. Full rest.', ['Run through the base, not to it', 'Look at the base, not the ball'], 'Time — matches the home-to-first test', 'general', { space: 'Field' }),
      d('hitting', 'front_toss', 'Front toss with approach', 3, 15, 'Partner front-tosses from behind a screen; call a count and hunt your zone. Mix speeds.', ['Be on time for the fastball', 'Stay through the middle'], 'Hard contact out of 25', 'general', { solo: false, space: 'Cage or field', equipment: 'Bat, balls, screen' }),
      d('fielding', 'short_hops', 'Short-hop drill', 2, 10, 'Partner throws short hops from 5 m; field with soft hands, forehand and backhand.', ['Glove down early, work up', 'Give with the ball'], 'Clean picks out of 30', 'general', { solo: false, space: '10 m', equipment: 'Glove, balls' }),
      d('fielding', 'fly_ball_reads', 'Fly-ball drop step and route', 2, 12, 'Partner points a direction, you drop-step and run; then they throw or hit the ball over your shoulder.', ['First step back, not in', 'Run on the balls of your feet'], 'Catches out of 15', 'general', { solo: false, space: 'Outfield', equipment: 'Glove, balls' }),
      d('pitching', 'flat_ground', 'Flat-ground command work', 2, 12, 'Throw from flat ground to a catcher or target at short distance, hitting glove-side and arm-side spots. Count every pitch toward your Pitch Smart daily total.', ['Same release point', 'Finish over the front leg'], 'Strikes to the target out of 20', 'pitch_smart', { solo: false, space: '15 m', equipment: 'Glove, balls, target' }),
      d('catching_skills', 'blocking_drill', 'Blocking balls in the dirt', 1, 10, 'Partner bounces balls left, right and center from 5 m; drop to your knees, chest over the ball, glove between the legs.', ['Chin down, round the shoulders', 'Keep the ball in front'], 'Balls kept in front out of 20', 'general', { solo: false, space: '10 m', equipment: 'Catcher gear, balls' }),
      d('catching_skills', 'receiving', 'Receiving and framing', 2, 10, 'Receive pitches (or tosses) at the edges of the zone and hold the glove still and strong.', ['Catch the outside half of the ball', 'Quiet glove, beat the ball to the spot'], 'Clean stuck pitches out of 20', 'general', { solo: false, space: '15 m', equipment: 'Catcher gear, balls' }),
    ],
    tests: [
      { id: 'tee_line_drives', skill: 'hitting', name: 'Tee line drives (20)', howTo: '20 swings, middle tee.', unit: 'line drives / 20', better: 'higher' },
      { id: 'wall_fields', skill: 'fielding', name: 'Wall-ball clean fields (30)', howTo: 'Mixed forehand and backhand.', unit: 'clean / 30', better: 'higher' },
      { id: 'home_first', skill: 'baserunning', name: 'Home to first', howTo: 'From a swing, best of 2.', unit: 'seconds', better: 'lower' },
    ],
    sources: ['pitch_smart', 'nsca_ltad'],
    channels: [{ name: 'USA Baseball', handle: '@USABaseball', channelId: 'UCjaL0KPdKoNYYGwqc6wZ_4w', expectTitle: 'USA Baseball', official: true }],
    safety: ['Pitchers: follow Pitch Smart pitch counts and rest days (calculator below). Don’t pitch on consecutive days in a way that breaks the guidelines, and don’t pitch for multiple teams at once.'],
  },

  volleyball: {
    label: 'Volleyball',
    positions: ['Setter', 'Outside hitter', 'Opposite', 'Middle blocker', 'Libero / defensive specialist'],
    skills: [
      { id: 'passing', label: 'Passing', query: 'passing platform' },
      { id: 'setting', label: 'Setting', query: 'setting technique' },
      { id: 'serving', label: 'Serving', query: 'serving technique' },
      { id: 'attacking', label: 'Attacking approach', query: 'attack approach footwork' },
      { id: 'blocking', label: 'Blocking footwork', query: 'blocking footwork' },
      { id: 'digging', label: 'Defense & digging', query: 'volleyball digging drills', keywords: ['dig', 'defense', 'floor', 'pursuit', 'read the hitter'] },
    ],
    drills: [
      d('passing', 'wall_pass', 'Wall forearm passing', 1, 10, 'Pass against a wall to a target line, moving your feet to every ball.', ['Platform angled to the target', 'Feet first, arms still'], 'Consecutive controlled passes', 'usavb_academy', { space: 'Wall', equipment: 'Ball' }),
      d('setting', 'self_set', 'Self-setting', 1, 8, 'Set to yourself 1–2 m high, then alternate high and low sets.', ['Window shape with your hands', 'Extend through the ball'], 'Consecutive sets', 'usavb_academy', { equipment: 'Ball' }),
      d('serving', 'target_serving', 'Target serving', 2, 12, 'Serve to zones marked with towels or cones. 5 serves per zone.', ['Same toss every time', 'Contact in front of the hitting shoulder'], 'Serves in out of 20 — matches the serving test', 'usavb_academy', { space: 'Court', equipment: 'Balls, 3 targets' }),
      d('attacking', 'approach_footwork', 'Approach footwork', 1, 8, 'Practise your 3- or 4-step approach without a ball, then with a toss to yourself into a wall.', ['Last two steps fast', 'Arms swing back and up together'], 'Clean approaches', 'usavb_academy', { space: '5 m' }),
      d('blocking', 'block_footwork', 'Block footwork along the net', 1, 8, 'Slide and crossover steps along the net (or a wall), jump and press hands over.', ['Hands up before you jump', 'Land on two feet, softly'], 'Clean reps each direction', 'general', { space: 'Net or wall' }),
      d('passing', 'serve_receive', 'Serve receive to target', 2, 12, 'Partner serves; pass to a target at the setter’s spot. Move to every ball and stop before you pass.', ['Angle the platform, don’t swing', 'Get your midline behind the ball'], 'Passes to target out of 20', 'usavb_academy', { solo: false, space: 'Court', equipment: 'Balls' }),
      d('setting', 'location_sets', 'Location setting', 2, 10, 'From the setter spot, set outside, middle and back sets to targets. Partner tosses or passes to you.', ['Face where you’re setting', 'Same hand shape every set'], 'Sets on target out of 30', 'usavb_academy', { solo: false, space: 'Court', equipment: 'Balls' }),
      d('attacking', 'toss_hit', 'Toss and hit to zones', 2, 12, 'Partner tosses; approach and hit line, angle and tip/roll shots to zones.', ['Contact high and in front', 'Snap the wrist'], 'Kills into the zone out of 20', 'usavb_academy', { solo: false, space: 'Court', equipment: 'Balls' }),
      d('digging', 'dig_reaction', 'Dig reaction', 2, 10, 'Partner hits or throws balls at you from a box; dig to a target. Move your feet first.', ['Low and still before the hit', 'Platform out, let the ball come'], 'Digs up to target out of 20', 'general', { solo: false, space: 'Court', equipment: 'Balls, box' }),
    ],
    tests: [
      { id: 'serves_20', skill: 'serving', name: 'Serves in (20)', howTo: 'Your match serve, 20 attempts.', unit: 'in / 20', better: 'higher' },
      { id: 'wall_pass_streak', skill: 'passing', name: 'Wall pass streak', howTo: 'Best of 3 attempts.', unit: 'passes', better: 'higher' },
      { id: 'vertical_reach', skill: 'attacking', name: 'Approach jump reach', howTo: 'Touch the highest point you can on a wall after your approach; measure from the floor.', unit: 'cm or in', better: 'higher' },
    ],
    sources: ['usavb_academy', 'fifa11_meta', 'nsca_ltad'],
    channels: [{ name: 'USA Volleyball', handle: '@USAVolleyball', expectTitle: 'USA Volleyball', official: true }],
    safety: ['Landing practice (soft, two-footed, knees over toes) matters in a jumping sport.'],
  },

  track_running: {
    label: 'Track / running',
    positions: ['Sprints', 'Hurdles', 'Middle distance', 'Distance', 'Jumps', 'Throws'],
    skills: [
      { id: 'starts', label: 'Starts & acceleration', query: 'sprint start acceleration' },
      { id: 'mechanics', label: 'Sprint mechanics', query: 'sprint mechanics drills' },
      { id: 'speed_endurance', label: 'Speed endurance', query: 'speed endurance workout' },
      { id: 'aerobic', label: 'Aerobic base', query: 'easy run aerobic base' },
      { id: 'hurdles', label: 'Hurdle technique', query: 'hurdle drills', keywords: ['hurdle', 'lead leg', 'trail leg', 'three step'] },
      { id: 'jumps', label: 'Jump approach & take-off', query: 'long jump approach drills', keywords: ['jump', 'approach', 'take off', 'takeoff', 'runway', 'board'] },
      { id: 'throws', label: 'Throwing technique', query: 'shot put technique drills', keywords: ['throw', 'shot', 'discus', 'javelin', 'glide', 'spin'] },
    ],
    drills: [
      d('mechanics', 'abc_drills', 'A-skips, B-skips, high knees', 1, 10, '2 × 20 m of each drill, walk back. Tall posture, quick ground contact.', ['Foot lands under the hip', 'Arms drive cheek to pocket'], 'Rhythm and posture (film it)', 'usatf_coaches', { space: '20–30 m' }),
      d('starts', 'falling_starts', 'Falling starts', 1, 10, 'Lean forward from standing until you must step, then accelerate for 15 m. 6 reps, full walk-back rest.', ['Push the ground back', 'Stay low for the first steps'], 'Time over 10 m if timed', 'general', { space: '30 m' }),
      d('mechanics', 'strides', 'Strides', 1, 10, '4–6 × 80 m building to about 85% speed, full walk-back recovery.', ['Relaxed face and shoulders', 'Smooth, not strained'], 'Relaxed form at speed', 'general', { space: '100 m' }),
      d('speed_endurance', 'tempo_200s', 'Tempo 200s', 2, 20, '6 × 200 m at a controlled, steady effort with 200 m walk recovery.', ['Even pace each rep', 'Form stays tall when tired'], 'Rep times and how even they are', 'general', { space: 'Track' }),
      d('aerobic', 'easy_run', 'Easy run', 1, 30, 'Run at a conversational pace. Most weekly running should feel like this.', ['You can talk in sentences'], 'Distance and how you felt', 'general', { space: 'Anywhere' }),
      d('starts', 'block_starts', 'Block starts', 2, 15, '6–8 starts out of blocks to 20–30 m on your own command or a partner’s. Full rest.', ['Push both feet hard', 'Low heel recovery, rise gradually'], 'Time to 20 m if timed', 'usatf_coaches', { space: 'Track', equipment: 'Starting blocks' }),
      d('speed_endurance', 'flying_30s', 'Flying 30s', 3, 15, 'Build up over 20 m, then hold top speed for 30 m. 4–5 reps, full recovery.', ['Relax at top speed', 'Tall hips, quick contacts'], 'Time for the flying 30 if timed', 'general', { space: 'Track' }),
      d('aerobic', 'threshold_run', 'Threshold run', 2, 30, '10 min easy, then 15–20 min at a "comfortably hard" pace you could hold for about an hour, then easy.', ['Steady, not racing', 'Short phrases, not full sentences'], 'Pace and how even it was', 'general', { space: 'Anywhere' }),
      d('hurdles', 'walkovers', 'Hurdle walkovers', 1, 10, 'Walk over a line of low hurdles working lead leg, then trail leg, then both.', ['Knee leads, not the foot', 'Trail knee comes through high and flat'], 'Clean passes without touching', 'usatf_coaches', { space: 'Track', equipment: 'Low hurdles or cones and sticks' }),
      d('hurdles', 'rhythm_hurdles', 'Rhythm over mini hurdles', 2, 12, 'Run over low hurdles at your race step pattern (3-step or 5-step), building speed.', ['Attack the hurdle, don’t jump it', 'Same rhythm between every hurdle'], 'Clean runs through the set', 'usatf_coaches', { space: 'Track', equipment: 'Mini hurdles' }),
      d('jumps', 'approach_rhythm', 'Approach rhythm runs', 1, 12, 'Mark your approach and run it without jumping, hitting the same check marks every time. Then short-approach pop-ups.', ['Same first steps every time', 'Tall and fast on the last steps'], 'Runs that hit the check mark', 'usatf_coaches', { space: 'Runway' }),
      d('throws', 'standing_throws', 'Standing throws', 1, 12, 'Standing throws (shot, discus or javelin with a light implement) focusing on the finish and block. Only with a coach present and a clear throwing area.', ['Hips before arm', 'Block with the front side'], 'Distance of your best standing throw', 'usatf_coaches', { solo: false, space: 'Throwing area', equipment: 'Implement' }),
    ],
    tests: [
      { id: 'sprint_30m', skill: 'starts', name: '30 m sprint', howTo: 'From a standing start, best of 2, same surface each time.', unit: 'seconds', better: 'lower' },
      { id: 'mile', skill: 'aerobic', name: '1 mile / 1600 m', howTo: 'Steady, even effort on a track.', unit: 'minutes:seconds as decimal minutes', better: 'lower' },
    ],
    sources: ['usatf_coaches', 'nsca_ltad'],
    channels: [],
    safety: ['Increase weekly running gradually. Pain that changes how you run is a reason to stop and get it checked.'],
  },

  swimming: {
    label: 'Swimming',
    positions: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'IM', 'Distance'],
    skills: [
      { id: 'freestyle', label: 'Freestyle technique', query: 'freestyle technique' },
      { id: 'kick', label: 'Kick', query: 'kick drills' },
      { id: 'starts_turns', label: 'Starts & turns', query: 'flip turn technique' },
      { id: 'endurance', label: 'Endurance', query: 'swim endurance set' },
    ],
    drills: [
      d('freestyle', 'catch_up', 'Catch-up drill', 1, 10, '4 × 25 m: one arm waits in front until the other arm returns.', ['Long body line', 'High elbow on the catch'], 'Stroke count per 25 m', 'usaswim_training', { space: 'Pool lane' }),
      d('kick', 'side_kick', 'Side kick', 1, 10, '4 × 25 m on your side, bottom arm extended, kicking from the hips.', ['Small, fast kicks', 'Head in line with the spine'], 'Time per 25 m', 'usaswim_training', { space: 'Pool lane', equipment: 'Fins optional' }),
      d('starts_turns', 'flip_turns', 'Flip-turn practice', 2, 10, '10 turns from 5 m out, pushing off streamlined.', ['Tuck tight', 'Streamline before you kick'], 'Turns without a breath before the wall', 'usaswim_training', { space: 'Pool lane' }),
      d('endurance', 'aerobic_set', 'Aerobic 100s', 2, 25, '8 × 100 m at a steady pace with 15–20 s rest.', ['Hold the same pace every rep'], 'Average time per 100', 'general', { space: 'Pool lane' }),
      d('freestyle', 'fingertip_drag', 'Fingertip drag', 1, 10, '4 × 25 m freestyle dragging your fingertips along the water on the recovery.', ['High elbow recovery', 'Relaxed hand'], 'Stroke count per 25 m', 'usaswim_training', { space: 'Pool lane' }),
      d('kick', 'vertical_kick', 'Vertical kick', 2, 8, 'In deep water, arms crossed on your chest, kick to keep your head up. 4 × 30 s.', ['Kick from the hips', 'Point the toes'], 'Seconds held with hands up', 'general', { space: 'Deep end' }),
      d('starts_turns', 'streamline_push', 'Streamline push-offs', 1, 8, '10 push-offs in a tight streamline, holding the glide and adding underwater kicks.', ['Squeeze ears with arms', 'Hold it before you kick'], 'Distance before your first stroke', 'usaswim_training', { space: 'Pool lane' }),
      d('endurance', 'race_pace', 'Race-pace 50s', 3, 20, '8 × 50 m at your goal race pace with 30–45 s rest.', ['Same stroke count each rep', 'Fast but controlled'], 'How many reps you hold race pace', 'general', { space: 'Pool lane' }),
    ],
    tests: [
      { id: 'free_50', skill: 'freestyle', name: '50 m freestyle', howTo: 'Push start, timed.', unit: 'seconds', better: 'lower' },
      { id: 'stroke_count', skill: 'freestyle', name: 'Stroke count per 25 m', howTo: 'Count strokes at your normal pace.', unit: 'strokes', better: 'lower' },
    ],
    sources: ['usaswim_training', 'nsca_ltad'],
    channels: [],
    safety: ['Never practise breath-holding or hypoxic games alone — shallow-water blackout can happen without warning.'],
  },

  tennis: {
    label: 'Tennis',
    positions: ['Singles', 'Doubles'],
    skills: [
      { id: 'forehand', label: 'Forehand', query: 'forehand technique' },
      { id: 'backhand', label: 'Backhand', query: 'backhand technique' },
      { id: 'serve', label: 'Serve', query: 'serve technique' },
      { id: 'footwork', label: 'Footwork', query: 'tennis footwork drills' },
      { id: 'volley', label: 'Volleys & net play', query: 'tennis volley technique', keywords: ['volley', 'net', 'approach', 'overhead', 'doubles'] },
    ],
    drills: [
      d('footwork', 'split_step_shadow', 'Split-step shadow swings', 1, 10, 'Split step, move to an imaginary ball, set up and swing; recover to the middle. Forehand and backhand.', ['Split as the opponent hits', 'Small adjustment steps'], 'Clean reps with balance', 'usta_pd', { equipment: 'Racket' }),
      d('forehand', 'wall_rally', 'Wall rally', 1, 12, 'Rally against a wall above a target line, alternating forehands and backhands.', ['Turn the shoulders early', 'Contact in front'], 'Longest controlled rally', 'general', { space: 'Wall', equipment: 'Racket, balls' }),
      d('backhand', 'backhand_feed', 'Backhand drop-feed rally', 1, 12, 'Drop-feed yourself (or rally against a wall) and hit 10 backhands cross-court, then 10 down the line. Two-handed or one-handed — whichever you use in matches.', ['Turn the shoulders before the ball bounces', 'Contact out in front of the front hip'], 'Backhands landing past the service line out of 20', 'usta_pd', { space: 'Court or wall', equipment: 'Racket, balls' }),
      d('serve', 'serve_targets', 'Serve to targets', 2, 15, '10 serves to each service box corner, both sides.', ['Consistent toss', 'Reach up to contact'], 'First serves in out of 20', 'general', { space: 'Court', equipment: 'Racket, balls' }),
      d('volley', 'wall_volleys', 'Wall volleys', 1, 8, 'Volley against a wall from 3 m, forehand and backhand, keeping the ball off the ground.', ['Short punch, no swing', 'Racket head above the wrist'], 'Volleys in a row', 'general', { space: 'Wall', equipment: 'Racket, ball' }),
      d('volley', 'approach_volley', 'Approach and finish', 2, 12, 'Feed a short ball, hit an approach down the line, split step and finish with a volley or overhead.', ['Split as the opponent hits', 'Close the net after the first volley'], 'Points finished out of 15', 'usta_pd', { solo: false, space: 'Court', equipment: 'Racket, balls' }),
      d('forehand', 'inside_out', 'Inside-out forehands', 3, 12, 'Run around the backhand and hit inside-out forehands to the deuce corner, recovering each time.', ['Move early, set wide', 'Hit through the outside of the ball'], 'Balls into the corner out of 20', 'general', { space: 'Court', equipment: 'Racket, balls' }),
      d('serve', 'second_serve_kick', 'Second-serve spin', 3, 12, 'Hit kick or slice second serves with full racket speed, aiming deep in the box.', ['Brush up the back of the ball', 'Same speed of swing as your first serve'], 'Second serves in out of 20', 'general', { space: 'Court', equipment: 'Racket, balls' }),
      d('footwork', 'spider_drill', 'Spider drill', 2, 8, 'From the center mark, sprint to five spots on the baseline and service line and back. Rest 60 seconds; 4 reps.', ['Push off the outside foot', 'Split at the center'], 'Time per spider', 'general', { space: 'Court' }),
    ],
    tests: [
      { id: 'first_serves', skill: 'serve', name: 'First serves in (20)', howTo: '20 first serves, alternating sides.', unit: 'in / 20', better: 'higher' },
      { id: 'wall_streak', skill: 'forehand', name: 'Wall rally streak', howTo: 'Best of 3, above the line.', unit: 'hits', better: 'higher' },
    ],
    sources: ['usta_pd', 'nsca_ltad'],
    channels: [],
    safety: [],
  },

  other: {
    label: 'Other sport',
    positions: [],
    skills: [{ id: 'core_skill', label: 'Your key skill', query: 'drills' }],
    drills: [d('core_skill', 'deliberate', 'Deliberate practice block', 1, 15, 'Pick the one skill your coach most wants you to improve. Do short, focused reps and rest between sets.', ['One focus at a time', 'Film or count so you can compare'], 'A count or time you can repeat weekly', 'general')],
    tests: [{ id: 'custom', skill: 'core_skill', name: 'Your skill test', howTo: 'Choose a repeatable test (count or time) and keep it the same each time.', unit: 'score', better: 'higher' }],
    sources: ['nsca_ltad'],
    channels: [],
    safety: [],
  },
};

export function sportInfo(id: SportId): SportInfo {
  return SPORTS_CATALOG[id];
}

/* ---------------- Pitch Smart ---------------- */

/**
 * Pitch Smart rest tiers by age (pitches thrown → required days of rest).
 * Transcribed from the Pitch Smart pitching guidelines; always verify at the
 * official URL, and follow your league if it is stricter.
 */
const PITCH_TIERS: { ages: [number, number]; dailyMax: number; tiers: number[] }[] = [
  { ages: [7, 8], dailyMax: 50, tiers: [20, 35, 50] },
  { ages: [9, 10], dailyMax: 75, tiers: [20, 35, 50, 65] },
  { ages: [11, 12], dailyMax: 85, tiers: [20, 35, 50, 65] },
  { ages: [13, 14], dailyMax: 95, tiers: [20, 35, 50, 65] },
  { ages: [15, 16], dailyMax: 95, tiers: [30, 45, 60, 75] },
  { ages: [17, 18], dailyMax: 105, tiers: [30, 45, 60, 75] },
];

export type PitchRest =
  | { ok: true; restDays: number; dailyMax: number; overMax: boolean }
  | { ok: false; reason: string };

export function pitchSmartRest(age: number | null, pitches: number): PitchRest {
  if (age === null) return { ok: false, reason: 'Add your birthday in Settings to use the pitch-count guide.' };
  const row = PITCH_TIERS.find((r) => age >= r.ages[0] && age <= r.ages[1]);
  if (!row) return { ok: false, reason: 'This guide covers ages 7–18. See the official Pitch Smart page for other ages.' };
  if (!Number.isFinite(pitches) || pitches <= 0) return { ok: true, restDays: 0, dailyMax: row.dailyMax, overMax: false };
  let restDays = row.tiers.findIndex((t) => pitches <= t);
  if (restDays === -1) restDays = row.tiers.length;
  return { ok: true, restDays, dailyMax: row.dailyMax, overMax: pitches > row.dailyMax };
}
