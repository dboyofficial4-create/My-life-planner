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
    ],
    drills: [
      d('footwork', 'ladder', 'Agility ladder series', 1, 10, 'Two feet in each box, lateral in-in-out-out, Ickey shuffle. 3 runs each, walk back.', ['On the balls of your feet', 'Arms drive with legs'], 'Clean runs without touching the rungs', 'general', { space: '10 m', equipment: 'Agility ladder (or chalk lines)' }),
      d('footwork', 'pro_agility', '5-10-5 shuttle', 2, 10, 'Start in a 3-point stance, sprint 5 yd, touch the line, 10 yd back, 5 yd through. Full rest between reps.', ['Low hips into the turn', 'Plant with the outside foot'], 'Time — matches the 5-10-5 test', 'general', { space: '15 yd', equipment: 'Cones' }),
      d('catching', 'hands_drill', 'Diamond hands', 1, 10, 'Partner throws high, low and away. Thumbs together above the chest, pinkies together below.', ['Eyes to the tuck', 'Catch with your hands, not your chest'], 'Catches out of 20', 'usafb_fdm', { solo: false, space: '15 yd', equipment: 'Football' }),
      d('catching', 'wall_tennis_ball', 'Tennis-ball reaction catches', 1, 6, 'Throw a tennis ball off a wall and catch it one-handed, alternating hands.', ['Watch it all the way in'], 'Catches in 60 seconds', 'general', { space: 'Wall', equipment: 'Tennis ball' }),
      d('throwing', 'one_knee', 'One-knee throws', 1, 8, 'On one knee, throw to a partner focusing on upper-body mechanics: grip, elbow at shoulder height, follow through to the opposite hip.', ['Ball up by the ear', 'Point the front shoulder at the target'], 'On-target throws out of 20', 'general', { solo: false, space: '10 yd', equipment: 'Football' }),
      d('tackling', 'breakdown_form', 'Breakdown and form (no contact)', 1, 8, 'Practice the Heads Up fundamentals without contact: breakdown, buzz the feet, hit position, shoot the hips toward a bag or cone.', ['Eyes up, head out of the tackle', 'Shoulder leads, never the helmet'], 'Clean form reps', 'usafb_tackling', { equipment: 'Cone or bag' }),
      d('stance_start', 'get_off', 'Stance and get-off', 1, 8, 'From your position stance, explode for 5 yards on a visual cue. Walk back, repeat.', ['Weight balanced, back flat', 'First step short and fast'], 'Clean starts (no false steps)', 'usafb_fdm', { space: '10 yd' }),
    ],
    tests: [
      { id: 'shuttle_5105', skill: 'footwork', name: '5-10-5 shuttle', howTo: 'Best of 2, hand-timed.', unit: 'seconds', better: 'lower' },
      { id: 'catches_20', skill: 'catching', name: 'Catches out of 20', howTo: 'Mixed high, low and away throws.', unit: 'catches / 20', better: 'higher' },
      { id: 'sprint_20yd', skill: 'stance_start', name: '20-yard sprint', howTo: 'From your stance, best of 2.', unit: 'seconds', better: 'lower' },
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
    ],
    drills: [
      d('hitting', 'tee_work', 'Tee work (3 zones)', 1, 15, '10 swings each with the tee inside, middle and outside.', ['Balanced finish', 'Barrel through the ball, line drives'], 'Line drives out of 30', 'general', { space: 'Net or field', equipment: 'Bat, tee, balls' }),
      d('hitting', 'soft_toss', 'Soft toss', 2, 12, 'Partner tosses from the side into the zone; drive the ball into a net.', ['Load early', 'Head still through contact'], 'Hard contact out of 20', 'general', { solo: false, space: 'Net', equipment: 'Bat, balls' }),
      d('fielding', 'wall_ball', 'Wall-ball fielding', 1, 10, 'Throw against a wall and field the rebound — forehand, backhand and short hops.', ['Glove out front', 'Feet move before the glove'], 'Clean fields out of 30', 'general', { space: 'Wall + 10 m', equipment: 'Glove, ball' }),
      d('throwing', 'progressive_catch', 'Progressive catch', 1, 12, 'Start at 10 m and increase distance gradually; finish with crisp throws at your normal distance.', ['Lead with the glove-side shoulder', 'Finish over the front leg'], 'Throws to the chest out of 20', 'general', { solo: false, space: 'Field', equipment: 'Glove, ball' }),
      d('pitching', 'towel_drill', 'Towel drill', 1, 8, 'Hold a small towel like a ball and work through your delivery, snapping the towel at release toward a target.', ['Stride straight to the target', 'Full arm path'], 'Clean reps — no ball, no pitch count', 'pitch_smart', { equipment: 'Hand towel' }),
      d('baserunning', 'home_to_first', 'Home to first', 1, 8, 'Swing and sprint through the bag, then walk back. Full rest.', ['Run through the base, not to it', 'Look at the base, not the ball'], 'Time — matches the home-to-first test', 'general', { space: 'Field' }),
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
    ],
    drills: [
      d('passing', 'wall_pass', 'Wall forearm passing', 1, 10, 'Pass against a wall to a target line, moving your feet to every ball.', ['Platform angled to the target', 'Feet first, arms still'], 'Consecutive controlled passes', 'usavb_academy', { space: 'Wall', equipment: 'Ball' }),
      d('setting', 'self_set', 'Self-setting', 1, 8, 'Set to yourself 1–2 m high, then alternate high and low sets.', ['Window shape with your hands', 'Extend through the ball'], 'Consecutive sets', 'usavb_academy', { equipment: 'Ball' }),
      d('serving', 'target_serving', 'Target serving', 2, 12, 'Serve to zones marked with towels or cones. 5 serves per zone.', ['Same toss every time', 'Contact in front of the hitting shoulder'], 'Serves in out of 20 — matches the serving test', 'usavb_academy', { space: 'Court', equipment: 'Balls, 3 targets' }),
      d('attacking', 'approach_footwork', 'Approach footwork', 1, 8, 'Practise your 3- or 4-step approach without a ball, then with a toss to yourself into a wall.', ['Last two steps fast', 'Arms swing back and up together'], 'Clean approaches', 'usavb_academy', { space: '5 m' }),
      d('blocking', 'block_footwork', 'Block footwork along the net', 1, 8, 'Slide and crossover steps along the net (or a wall), jump and press hands over.', ['Hands up before you jump', 'Land on two feet, softly'], 'Clean reps each direction', 'general', { space: 'Net or wall' }),
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
    ],
    drills: [
      d('mechanics', 'abc_drills', 'A-skips, B-skips, high knees', 1, 10, '2 × 20 m of each drill, walk back. Tall posture, quick ground contact.', ['Foot lands under the hip', 'Arms drive cheek to pocket'], 'Rhythm and posture (film it)', 'usatf_coaches', { space: '20–30 m' }),
      d('starts', 'falling_starts', 'Falling starts', 1, 10, 'Lean forward from standing until you must step, then accelerate for 15 m. 6 reps, full walk-back rest.', ['Push the ground back', 'Stay low for the first steps'], 'Time over 10 m if timed', 'general', { space: '30 m' }),
      d('mechanics', 'strides', 'Strides', 1, 10, '4–6 × 80 m building to about 85% speed, full walk-back recovery.', ['Relaxed face and shoulders', 'Smooth, not strained'], 'Relaxed form at speed', 'general', { space: '100 m' }),
      d('speed_endurance', 'tempo_200s', 'Tempo 200s', 2, 20, '6 × 200 m at a controlled, steady effort with 200 m walk recovery.', ['Even pace each rep', 'Form stays tall when tired'], 'Rep times and how even they are', 'general', { space: 'Track' }),
      d('aerobic', 'easy_run', 'Easy run', 1, 30, 'Run at a conversational pace. Most weekly running should feel like this.', ['You can talk in sentences'], 'Distance and how you felt', 'general', { space: 'Anywhere' }),
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
    ],
    drills: [
      d('footwork', 'split_step_shadow', 'Split-step shadow swings', 1, 10, 'Split step, move to an imaginary ball, set up and swing; recover to the middle. Forehand and backhand.', ['Split as the opponent hits', 'Small adjustment steps'], 'Clean reps with balance', 'usta_pd', { equipment: 'Racket' }),
      d('forehand', 'wall_rally', 'Wall rally', 1, 12, 'Rally against a wall above a target line, alternating forehands and backhands.', ['Turn the shoulders early', 'Contact in front'], 'Longest controlled rally', 'general', { space: 'Wall', equipment: 'Racket, balls' }),
      d('backhand', 'backhand_feed', 'Backhand drop-feed rally', 1, 12, 'Drop-feed yourself (or rally against a wall) and hit 10 backhands cross-court, then 10 down the line. Two-handed or one-handed — whichever you use in matches.', ['Turn the shoulders before the ball bounces', 'Contact out in front of the front hip'], 'Backhands landing past the service line out of 20', 'usta_pd', { space: 'Court or wall', equipment: 'Racket, balls' }),
      d('serve', 'serve_targets', 'Serve to targets', 2, 15, '10 serves to each service box corner, both sides.', ['Consistent toss', 'Reach up to contact'], 'First serves in out of 20', 'general', { space: 'Court', equipment: 'Racket, balls' }),
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
