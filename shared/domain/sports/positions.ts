/**
 * Positions by sport: the standard ones, advanced/modern roles (point forward, nickel, false nine…)
 * and common two-way pairings. Each position says which skills matter most (in order), how the
 * position is conditioned, what the strength work emphasises, and the five builds that suit it best.
 * General coaching knowledge; the personalizer weighs it against the athlete's own tests and coach feedback.
 */
import type { SportId } from './catalog';

export interface PositionInfo {
  name: string;
  advanced?: boolean;
  /** One line on what the role is (advanced roles especially). */
  blurb: string;
  /** Catalog skill ids, most important first. */
  skills: string[];
  conditioning: string;
  strength: string;
  /** Five best builds (ids in shared/domain/fitness/builds.ts), best first, with why each suits this role. */
  builds: [id: string, why: string][];
}

const P = (name: string, blurb: string, skills: string[], conditioning: string, strength: string, builds: [string, string][], advanced = false): PositionInfo => ({ name, blurb, skills, conditioning, strength, builds, advanced });

export const POSITIONS: Record<SportId, PositionInfo[]> = {
  basketball: [
    P('Point guard', 'Runs the offense: brings the ball up, sets teammates up, pressures the ball on defense.', ['ball_handling', 'passing', 'shooting', 'defense'], 'Repeated short sprints and change of direction; lots of full-court work.', 'Single-leg strength, core anti-rotation and first-step power.', [
      ['floor_general', 'Quick, low centre of gravity: protects the ball and beats pressure.'],
      ['combo_scorer', 'Adds strength to finish through contact and score off the dribble.'],
      ['slasher', 'Explosive first step to get into the paint.'],
      ['three_and_d_wing', 'Longer frame for guarding bigger guards.'],
      ['hybrid', 'All-round athleticism without bulk that slows you down.'],
    ]),
    P('Shooting guard', 'Scores off the catch and the dribble; moves without the ball.', ['shooting', 'ball_handling', 'finishing', 'defense'], 'Sprint-and-stop running, coming off screens at speed.', 'Legs and hips for a repeatable jump shot late in games, plus upper-body strength to finish.', [
      ['combo_scorer', 'Strong enough to take contact, light enough to stay quick.'],
      ['three_and_d_wing', 'Length to contest shots and guard wings.'],
      ['slasher', 'Explosive legs to punish closeouts.'],
      ['floor_general', 'Quickness to come off screens and create space.'],
      ['lean_toned', 'Lean, efficient frame that holds up over long seasons.'],
    ]),
    P('Wing / small forward', 'Plays on the perimeter and inside; guards several positions.', ['shooting', 'defense', 'finishing', 'rebounding'], 'Mixed intervals: sprint the floor, then defend in a stance.', 'Total-body strength with lateral power and a strong core.', [
      ['three_and_d_wing', 'The modern wing: long, lean and switchable.'],
      ['slasher', 'Power and spring for attacking the rim.'],
      ['point_forward_build', 'Size plus skill to handle and create.'],
      ['combo_scorer', 'Compact strength to score at all three levels.'],
      ['hybrid', 'Balanced strength and conditioning for a do-everything role.'],
    ]),
    P('Power forward', 'Rebounds, screens, scores near the rim and increasingly from outside.', ['rebounding', 'post', 'finishing', 'shooting'], 'Short, intense bursts with contact; sprinting the floor in transition.', 'Heavy lower body and upper back for screening and boxing out.', [
      ['power_forward_build', 'Thick, strong frame for rebounding and screening.'],
      ['stretch_big', 'Leaner frame for a big who spaces the floor.'],
      ['rim_protector', 'Length and strength for defending the paint.'],
      ['slasher', 'Springy legs for put-backs and lobs.'],
      ['strong_powerful', 'Raw strength to win physical battles.'],
    ]),
    P('Center', 'Anchors the paint: protects the rim, rebounds, scores close.', ['post', 'rebounding', 'defense', 'finishing'], 'Repeated jumps and short sprints rim to rim.', 'Heavy legs and hips, strong upper back, shoulder stability for contact.', [
      ['rim_protector', 'Long and strong to block and alter shots.'],
      ['power_forward_build', 'Mass and strength to hold position in the post.'],
      ['stretch_big', 'Lighter, mobile big for switching and shooting.'],
      ['strong_powerful', 'Base strength under everything else.'],
      ['hybrid', 'Conditioning to run with modern, faster lineups.'],
    ]),
    P('Combo guard', 'Plays both guard spots: can run the offense or score.', ['ball_handling', 'shooting', 'passing', 'finishing'], 'Full-court repeat sprints with ball work.', 'Single-leg power, core and enough upper body to finish through contact.', [
      ['combo_scorer', 'Strong, compact and quick: built for both guard jobs.'],
      ['floor_general', 'Quickness to run the point.'],
      ['slasher', 'First-step burst to get downhill.'],
      ['three_and_d_wing', 'Length to defend both guard spots.'],
      ['hybrid', 'Engine to handle both roles for a whole game.'],
    ], true),
    P('Point forward', 'A forward who handles and initiates the offense like a point guard.', ['passing', 'ball_handling', 'finishing', 'rebounding'], 'Grab-and-go transition sprints and mixed intervals.', 'Total-body strength: legs and core to handle bumps, upper body to finish.', [
      ['point_forward_build', 'Forward size with guard mobility.'],
      ['three_and_d_wing', 'Long and lean to defend multiple positions.'],
      ['slasher', 'Explosive legs to attack off the dribble.'],
      ['power_forward_build', 'Extra mass for rebounding and post-ups.'],
      ['hybrid', 'Conditioning to handle and defend every possession.'],
    ], true),
    P('3-and-D wing', 'Shoots threes and guards the other team’s best perimeter scorer.', ['shooting', 'defense', 'rebounding'], 'Defensive-slide intervals and sprinting to the corners in transition.', 'Lateral strength, hips, and shoulders that hold up to contact.', [
      ['three_and_d_wing', 'Long, lean and quick laterally.'],
      ['combo_scorer', 'Compact strength for physical defense.'],
      ['slasher', 'Spring for closeouts and contests.'],
      ['lean_toned', 'Light frame that stays quick all game.'],
      ['hybrid', 'Engine to defend hard for a full game.'],
    ], true),
    P('Stretch four', 'A power forward who spaces the floor with shooting.', ['shooting', 'rebounding', 'defense', 'post'], 'Mixed intervals; sprinting to the three-point line in transition.', 'Legs and core for a shot that holds up when tired, upper back for boxing out.', [
      ['stretch_big', 'Lean big who moves and shoots well.'],
      ['power_forward_build', 'Strength to still rebound and defend inside.'],
      ['three_and_d_wing', 'Length and mobility to switch onto wings.'],
      ['rim_protector', 'Length for help-side blocks.'],
      ['hybrid', 'Balance of strength and conditioning.'],
    ], true),
    P('Stretch five', 'A center who shoots from outside, pulling the opposing big away from the rim.', ['shooting', 'post', 'rebounding', 'defense'], 'Rim-to-arc sprints and repeated jumps.', 'Heavy lower body plus shoulder stability.', [
      ['stretch_big', 'Mobile big with a light, efficient frame.'],
      ['rim_protector', 'Length and strength to still protect the paint.'],
      ['power_forward_build', 'Mass for post defense.'],
      ['strong_powerful', 'Base strength.'],
      ['hybrid', 'Conditioning to guard in space.'],
    ], true),
    P('Rim-running big', 'A center who sprints the floor, sets screens and finishes lobs.', ['finishing', 'rebounding', 'defense'], 'Rim-to-rim sprints and repeat jumps.', 'Jump power, hips and core.', [
      ['rim_protector', 'Long and springy.'],
      ['slasher', 'Explosive legs for lobs and put-backs.'],
      ['power_forward_build', 'Strength to set hard screens.'],
      ['stretch_big', 'Lighter frame to run the floor.'],
      ['hybrid', 'Engine for constant running.'],
    ], true),
    P('Small-ball five', 'A smaller, quicker player at center who can switch onto anyone.', ['defense', 'rebounding', 'passing', 'finishing'], 'Mixed intervals with lots of lateral work.', 'Strength to battle bigger players: legs, hips, upper back.', [
      ['power_forward_build', 'Dense strength to hold up against bigger players.'],
      ['point_forward_build', 'Size plus skill to make plays.'],
      ['three_and_d_wing', 'Length to switch on the perimeter.'],
      ['strong_powerful', 'Raw strength for rebounding.'],
      ['hybrid', 'Engine for a demanding role.'],
    ], true),
  ],

  american_football: [
    P('Quarterback', 'Leads the offense: reads the defense and throws.', ['throwing', 'footwork'], 'Short bursts; mostly throwing volume and pocket movement.', 'Rotational core, legs and hips for throwing power, healthy shoulders.', [
      ['pocket_passer', 'Tall, solid frame that sees over the line and takes hits.'],
      ['dual_threat_qb', 'Athletic, fast and strong enough to run.'],
      ['hybrid', 'All-round athleticism and durability.'],
      ['lean_toned', 'Efficient frame for younger QBs still growing.'],
      ['strong_powerful', 'Base strength for durability.'],
    ]),
    P('Running back', 'Carries the ball, blocks and catches out of the backfield.', ['ball_security', 'footwork', 'catching', 'stance_start'], 'Repeated 10–40 yd sprints with short rest.', 'Heavy legs and hips, strong trunk to break tackles, neck work.', [
      ['power_back', 'Thick legs and low centre of gravity to run through contact.'],
      ['all_purpose_back', 'Fast and strong: runs, catches and blocks.'],
      ['burner', 'Breakaway speed.'],
      ['slot_shifty', 'Compact and quick to make people miss.'],
      ['strong_powerful', 'Raw strength to break tackles.'],
    ]),
    P('Wide receiver', 'Runs routes and catches the ball; blocks downfield.', ['route_running', 'catching', 'footwork', 'stance_start'], 'Repeat 10–40 yd sprints with full recovery, plus route conditioning.', 'Hamstrings and glutes for speed, upper body and grip to win contested catches.', [
      ['burner', 'Sprinter build: blows the top off a defense.'],
      ['possession_receiver', 'Bigger frame that wins contested catches.'],
      ['slot_shifty', 'Compact and quick in and out of breaks.'],
      ['all_purpose_back', 'Strong enough to break tackles after the catch.'],
      ['lean_toned', 'Lean, light and fast for younger receivers.'],
    ]),
    P('Tight end', 'Blocks like a lineman and catches like a receiver.', ['blocking', 'catching', 'route_running'], 'Mixed bursts: blocking reps and route sprints.', 'Heavy lower body and upper back; hand strength.', [
      ['move_tight_end', 'Big but athletic: blocks and runs routes.'],
      ['possession_receiver', 'Leaner frame for a receiving tight end.'],
      ['athletic_lineman', 'More mass for an in-line blocker.'],
      ['linebacker', 'Similar build that plays both ways well.'],
      ['strong_powerful', 'Base strength for blocking.'],
    ]),
    P('Offensive line', 'Blocks for the run and protects the quarterback.', ['blocking', 'stance_start', 'footwork'], 'Short 5–10 yd bursts with short rest; repeated effort.', 'Heavy compound lifts: squat, hinge, press, row; grip and neck.', [
      ['road_grader', 'Big, strong and wide: moves people in the run game.'],
      ['athletic_lineman', 'Mobile lineman for zone runs and pass protection.'],
      ['strong_powerful', 'Raw strength first.'],
      ['interior_dl', 'Same thick build that plays both lines.'],
      ['hybrid', 'Conditioning for long drives.'],
    ]),
    P('Defensive line', 'Stops the run and rushes the passer.', ['pass_rush', 'stance_start', 'tackling'], 'Short explosive bursts with short rest.', 'Explosive hips, heavy legs and a strong upper back.', [
      ['interior_dl', 'Thick and powerful to win inside.'],
      ['edge_rusher', 'Long and explosive to win on the edge.'],
      ['road_grader', 'Mass to hold the point of attack.'],
      ['athletic_lineman', 'Mobile frame for slanting and stunting.'],
      ['strong_powerful', 'Raw strength first.'],
    ]),
    P('Linebacker', 'Reads the play, fills gaps, tackles and covers.', ['tackling', 'footwork', 'coverage'], 'Repeated 10–20 yd sprints with change of direction.', 'Heavy compound lifts plus sprint and neck work.', [
      ['linebacker', 'Strong all over and fast enough to chase the ball.'],
      ['hybrid_safety', 'Leaner, faster frame for coverage linebackers.'],
      ['edge_rusher', 'Long and explosive for a pass-rushing linebacker.'],
      ['power_back', 'Similar thick frame for downhill tackling.'],
      ['strong_powerful', 'Raw strength.'],
    ]),
    P('Defensive back', 'Covers receivers and tackles in space.', ['coverage', 'footwork', 'tackling'], 'Repeat sprints and backpedal-and-break work.', 'Hamstrings, hips and single-leg strength for change of direction; upper body for press.', [
      ['cover_corner', 'Lean, fluid and fast.'],
      ['hybrid_safety', 'More muscle for tackling and covering tight ends.'],
      ['burner', 'Pure speed to stay with deep routes.'],
      ['slot_shifty', 'Compact quickness for slot receivers.'],
      ['lean_toned', 'Light, efficient frame for younger players.'],
    ]),
    P('Kicker / punter', 'Kicks field goals, kickoffs and punts.', ['kicking'], 'Short sprints and general fitness.', 'Hip flexors, glutes, core and flexibility.', [
      ['kicker_build', 'Strong hips and legs with great flexibility.'],
      ['lean_toned', 'Lean and athletic.'],
      ['hybrid', 'General athleticism.'],
      ['midfielder', 'Soccer-style leg strength and endurance.'],
      ['sprinter', 'Explosive hips.'],
    ]),
    P('Dual-threat quarterback', 'A quarterback who is as dangerous running as passing.', ['throwing', 'footwork', 'ball_security'], 'Repeated 10–40 yd sprints plus throwing volume.', 'Legs for speed, rotational core, durable shoulders.', [
      ['dual_threat_qb', 'Fast, strong and durable.'],
      ['all_purpose_back', 'Running-back strength for contact.'],
      ['burner', 'Breakaway speed.'],
      ['pocket_passer', 'Bigger frame for durability.'],
      ['hybrid', 'All-round athleticism.'],
    ], true),
    P('Slot receiver', 'Lines up inside; runs quick routes over the middle.', ['route_running', 'catching', 'footwork'], 'Short repeat sprints and change of direction.', 'Single-leg strength, hips and a strong core for contact over the middle.', [
      ['slot_shifty', 'Compact and sudden.'],
      ['burner', 'Speed to run past linebackers.'],
      ['all_purpose_back', 'Strength after the catch.'],
      ['possession_receiver', 'Bigger frame for tough catches inside.'],
      ['lean_toned', 'Lean and quick.'],
    ], true),
    P('H-back / fullback', 'Lead-blocks, catches short passes and runs in short yardage.', ['blocking', 'ball_security', 'catching'], 'Short, intense bursts.', 'Heavy lower body and upper back.', [
      ['power_back', 'Compact, heavy and strong.'],
      ['move_tight_end', 'Bigger frame that blocks and catches.'],
      ['linebacker', 'Same build that tackles on defense.'],
      ['strong_powerful', 'Raw strength.'],
      ['hybrid', 'Conditioning.'],
    ], true),
    P('Edge rusher', 'A defensive end or outside linebacker whose main job is to get to the quarterback.', ['pass_rush', 'stance_start', 'tackling'], 'Explosive 5–15 yd bursts with short rest.', 'Explosive hips, long-lever strength, bend and ankle mobility.', [
      ['edge_rusher', 'Long, explosive and bendy.'],
      ['linebacker', 'Strong all over.'],
      ['interior_dl', 'More mass to hold up against the run.'],
      ['slasher', 'Springy and explosive.'],
      ['strong_powerful', 'Raw strength.'],
    ], true),
    P('Nose tackle', 'Lines up over the center to clog the middle against the run.', ['stance_start', 'pass_rush', 'tackling'], 'Short bursts with short rest.', 'Heavy squats, hinges and presses; neck and grip.', [
      ['interior_dl', 'Thick, powerful and low.'],
      ['road_grader', 'Mass to take on double teams.'],
      ['strong_powerful', 'Raw strength.'],
      ['athletic_lineman', 'Mobility for slanting.'],
      ['linebacker', 'Lighter, faster option.'],
    ], true),
    P('Cornerback', 'Covers receivers on the outside, often in man-to-man.', ['coverage', 'footwork', 'tackling'], 'Repeat sprints and backpedal-break work.', 'Hamstrings, hips, single-leg strength; upper body for press.', [
      ['cover_corner', 'Lean, fluid and fast.'],
      ['burner', 'Speed to carry deep routes.'],
      ['hybrid_safety', 'More muscle for physical corners.'],
      ['slot_shifty', 'Quickness for slot coverage.'],
      ['lean_toned', 'Light and quick.'],
    ], true),
    P('Safety', 'The last line of defense: covers deep and supports the run.', ['coverage', 'tackling', 'footwork'], 'Repeat sprints with change of direction.', 'Total-body strength plus sprint work and neck strengthening.', [
      ['hybrid_safety', 'Fast enough to cover, strong enough to tackle.'],
      ['cover_corner', 'Leaner frame for a deep-coverage safety.'],
      ['linebacker', 'Bigger frame for a box safety.'],
      ['burner', 'Range to cover the deep middle.'],
      ['hybrid', 'All-round athleticism.'],
    ], true),
    P('Nickel / Star (hybrid DB-LB)', 'A defensive back who also plays near the line like a linebacker.', ['coverage', 'tackling', 'footwork'], 'Repeat sprints and lateral change of direction.', 'Total-body strength, hips and neck.', [
      ['hybrid_safety', 'The classic hybrid build.'],
      ['linebacker', 'More mass for run fits.'],
      ['cover_corner', 'Leaner for coverage.'],
      ['slot_shifty', 'Quickness against slot receivers.'],
      ['all_purpose_back', 'Strong and fast.'],
    ], true),
    P('Return specialist', 'Returns kicks and punts; usually also plays receiver or DB.', ['catching', 'ball_security', 'footwork'], 'Repeat 20–60 yd sprints with full rest.', 'Legs and hips for speed and cuts.', [
      ['burner', 'Breakaway speed.'],
      ['slot_shifty', 'Sudden cuts in traffic.'],
      ['all_purpose_back', 'Strength to break tackles.'],
      ['sprinter', 'Track-style speed.'],
      ['lean_toned', 'Lean and light.'],
    ], true),
  ],

  soccer: [
    P('Goalkeeper', 'Stops shots, commands the box and starts attacks.', ['goalkeeping', 'passing', 'first_touch'], 'Short, explosive efforts with full recovery; diving and getting up.', 'Explosive legs, shoulders and core; landing and diving technique.', [
      ['goalkeeper_frame', 'Long reach and explosive legs.'],
      ['volleyball', 'Springy, long frame.'],
      ['hybrid', 'Athletic and durable.'],
      ['aerial_center_back', 'Size to dominate crosses.'],
      ['lean_toned', 'Agile for younger keepers.'],
    ]),
    P('Center back', 'Defends the middle, wins headers and starts the build-up.', ['defending', 'passing', 'first_touch'], 'Repeat sprints with longer recovery; aerial duels.', 'Legs, hips and upper back for duels; neck strength.', [
      ['aerial_center_back', 'Tall, strong and dominant in the air.'],
      ['ball_playing_back', 'Athletic and composed on the ball.'],
      ['box_to_box', 'Engine and strength.'],
      ['strong_powerful', 'Raw strength for duels.'],
      ['hybrid', 'All-round athleticism.'],
    ]),
    P('Full back', 'Defends wide and overlaps to attack.', ['defending', 'crossing', 'fitness_repeat'], 'Lots of repeat sprints up and down the line.', 'Hamstrings, single-leg strength and core.', [
      ['fullback_engine', 'Lean, fast and tireless.'],
      ['winger_speed', 'Speed to overlap.'],
      ['midfielder', 'Engine for 90 minutes.'],
      ['cover_corner', 'Lean and quick.'],
      ['lean_toned', 'Light and efficient.'],
    ]),
    P('Defensive midfielder', 'Screens the defense, wins the ball back, keeps it simple.', ['passing', 'defending', 'first_touch'], 'High running volume with repeat sprints.', 'Legs, core and upper body for duels.', [
      ['box_to_box', 'Strong and tireless.'],
      ['midfielder', 'Classic midfield engine.'],
      ['ball_playing_back', 'Composed, solid frame.'],
      ['hybrid', 'All-round athleticism.'],
      ['lean_toned', 'Lean and efficient.'],
    ]),
    P('Attacking midfielder', 'Creates chances between the lines.', ['passing', 'first_touch', 'dribbling', 'finishing'], 'Repeat sprints with quick changes of direction.', 'Single-leg strength, core and balance.', [
      ['midfielder', 'Light, agile engine.'],
      ['winger_speed', 'Burst to get past players.'],
      ['box_to_box', 'Strength to hold off defenders.'],
      ['lean_toned', 'Lean and quick.'],
      ['hybrid', 'All-round athleticism.'],
    ]),
    P('Winger', 'Beats defenders wide and creates or scores.', ['dribbling', 'crossing', 'finishing'], 'Repeat 20–40 m sprints with short rest.', 'Hamstrings, glutes and single-leg power.', [
      ['winger_speed', 'Sprinter speed with endurance.'],
      ['sprinter', 'Pure acceleration.'],
      ['midfielder', 'Engine to track back.'],
      ['lean_toned', 'Light and quick.'],
      ['fullback_engine', 'Two-way running.'],
    ]),
    P('Striker', 'Leads the line and scores.', ['finishing', 'first_touch', 'dribbling'], 'Short explosive sprints and pressing runs.', 'Legs and hips for power, upper body to hold off defenders.', [
      ['poacher', 'Sharp, quick and explosive in the box.'],
      ['target_forward', 'Strong frame to hold the ball up and win headers.'],
      ['winger_speed', 'Speed to run in behind.'],
      ['box_to_box', 'Engine to press from the front.'],
      ['hybrid', 'All-round athleticism.'],
    ]),
    P('Sweeper keeper', 'A goalkeeper who plays high and acts as an extra defender with the ball.', ['goalkeeping', 'passing', 'first_touch'], 'Short sprints and explosive efforts.', 'Explosive legs and core.', [
      ['goalkeeper_frame', 'Long reach and explosive legs.'],
      ['ball_playing_back', 'Mobile and comfortable on the ball.'],
      ['hybrid', 'Athletic and durable.'],
      ['lean_toned', 'Agile.'],
      ['volleyball', 'Springy.'],
    ], true),
    P('Ball-playing center back', 'A center back who carries and passes forward to break lines.', ['passing', 'defending', 'first_touch'], 'Repeat sprints and aerial duels.', 'Legs, hips, upper back.', [
      ['ball_playing_back', 'Athletic, mobile and composed.'],
      ['aerial_center_back', 'Size for duels.'],
      ['box_to_box', 'Engine and strength.'],
      ['hybrid', 'All-round athleticism.'],
      ['lean_toned', 'Lean and quick.'],
    ], true),
    P('Wing back', 'Covers the whole flank in a back three: defends and attacks.', ['crossing', 'defending', 'fitness_repeat', 'dribbling'], 'Highest running load on the team: repeat sprints.', 'Hamstrings, single-leg strength and core.', [
      ['fullback_engine', 'Tireless and fast.'],
      ['winger_speed', 'Speed to beat defenders.'],
      ['midfielder', 'Engine.'],
      ['lean_toned', 'Light and efficient.'],
      ['hybrid', 'All-round athleticism.'],
    ], true),
    P('Inverted full back', 'A full back who steps into midfield when the team has the ball.', ['passing', 'first_touch', 'defending'], 'Repeat sprints and lots of mid-intensity running.', 'Single-leg strength and core.', [
      ['fullback_engine', 'Fast and tireless.'],
      ['midfielder', 'Midfield engine.'],
      ['box_to_box', 'Strength in midfield duels.'],
      ['lean_toned', 'Lean and agile.'],
      ['hybrid', 'All-round athleticism.'],
    ], true),
    P('Box-to-box midfielder', 'Defends in one box and attacks the other, all game.', ['passing', 'defending', 'finishing', 'fitness_repeat'], 'Very high running load; repeat sprints.', 'Total-body strength without bulk.', [
      ['box_to_box', 'The classic engine with strength.'],
      ['midfielder', 'Lighter engine.'],
      ['hybrid', 'All-round athleticism.'],
      ['fullback_engine', 'Repeat-sprint fitness.'],
      ['lean_toned', 'Lean and efficient.'],
    ], true),
    P('Deep-lying playmaker', 'Dictates play from deep with passing range.', ['passing', 'first_touch', 'defending'], 'Moderate running with repeat sprints.', 'Core, legs and balance.', [
      ['midfielder', 'Light and agile.'],
      ['box_to_box', 'Strength to hold off pressure.'],
      ['ball_playing_back', 'Composed frame.'],
      ['lean_toned', 'Lean.'],
      ['hybrid', 'All-round athleticism.'],
    ], true),
    P('False nine', 'A striker who drops deep to link play and pull defenders out.', ['first_touch', 'passing', 'dribbling', 'finishing'], 'Repeat sprints with changes of direction.', 'Single-leg strength, core and balance.', [
      ['midfielder', 'Agile engine.'],
      ['poacher', 'Sharp and quick.'],
      ['winger_speed', 'Burst.'],
      ['lean_toned', 'Lean.'],
      ['hybrid', 'All-round athleticism.'],
    ], true),
    P('Inside forward', 'A wide forward who cuts inside to shoot.', ['finishing', 'dribbling', 'first_touch'], 'Repeat sprints with short rest.', 'Hamstrings, glutes and single-leg power.', [
      ['winger_speed', 'Speed and endurance.'],
      ['poacher', 'Sharp in the box.'],
      ['sprinter', 'Acceleration.'],
      ['midfielder', 'Engine.'],
      ['lean_toned', 'Light and quick.'],
    ], true),
  ],

  baseball_softball: [
    P('Pitcher', 'Throws pitches; the whole game runs through you.', ['pitching', 'fielding', 'throwing'], 'Short sprints and general fitness; recovery between outings.', 'Legs, hips and rotational core; shoulder and elbow care; no max-effort throwing.', [
      ['durable_pitcher', 'Strong legs and trunk for a repeatable delivery.'],
      ['power_hitter', 'Thicker frame many power pitchers share.'],
      ['hybrid', 'Athletic and durable.'],
      ['lean_toned', 'Lean frame for younger pitchers.'],
      ['tennis', 'Rotational power and shoulder health.'],
    ]),
    P('Catcher', 'Receives every pitch, blocks, throws out runners and runs the defense.', ['catching_skills', 'throwing', 'hitting'], 'Repeated squats and short bursts.', 'Legs and hips for the squat, upper back, knee care.', [
      ['sturdy_catcher', 'Strong, durable lower body.'],
      ['power_hitter', 'Strength at the plate.'],
      ['strong_powerful', 'Raw strength.'],
      ['hybrid', 'Durability and conditioning.'],
      ['linebacker', 'Similar thick, strong frame.'],
    ]),
    P('Infield', 'Fields ground balls and turns double plays.', ['fielding', 'throwing', 'hitting'], 'Short sprints and lateral quickness.', 'Single-leg strength, hips and rotational core.', [
      ['middle_infielder', 'Quick, light and athletic.'],
      ['power_hitter', 'Strength for corner infielders who hit for power.'],
      ['hybrid', 'All-round athleticism.'],
      ['lean_toned', 'Lean and quick.'],
      ['tennis', 'Lateral agility and rotation.'],
    ]),
    P('Outfield', 'Tracks down fly balls and makes long throws.', ['fielding', 'throwing', 'hitting', 'baserunning'], 'Repeat sprints 20–40 m.', 'Legs and hips for speed, rotational core, shoulder care.', [
      ['rangy_outfielder', 'Long and fast with a strong arm.'],
      ['power_hitter', 'Corner outfield power.'],
      ['sprinter', 'Range and speed.'],
      ['hybrid', 'All-round athleticism.'],
      ['lean_toned', 'Lean and quick.'],
    ]),
    P('Middle infielder (SS/2B)', 'Shortstop or second base: the most range and quickest hands on the field.', ['fielding', 'throwing', 'baserunning'], 'Short sprints and lateral quickness.', 'Single-leg strength, hips, rotational core.', [
      ['middle_infielder', 'Quick and athletic.'],
      ['hybrid', 'All-round athleticism.'],
      ['slot_shifty', 'Sudden first step.'],
      ['lean_toned', 'Light and quick.'],
      ['tennis', 'Agility and rotation.'],
    ], true),
    P('Corner infielder (1B/3B)', 'First or third base: quick reactions and often a power bat.', ['hitting', 'fielding', 'throwing'], 'Short reaction bursts.', 'Total-body strength and rotational power.', [
      ['power_hitter', 'Strong and powerful.'],
      ['sturdy_catcher', 'Solid lower body.'],
      ['hybrid', 'Athletic and strong.'],
      ['strong_powerful', 'Raw strength.'],
      ['middle_infielder', 'Quick hands and feet.'],
    ], true),
    P('Center fielder', 'Covers the most ground in the outfield.', ['fielding', 'baserunning', 'throwing', 'hitting'], 'Repeat sprints with full rest.', 'Legs and hips for speed.', [
      ['rangy_outfielder', 'Long, fast and athletic.'],
      ['sprinter', 'Top speed.'],
      ['middle_infielder', 'Quick and light.'],
      ['hybrid', 'All-round athleticism.'],
      ['lean_toned', 'Lean.'],
    ], true),
    P('Relief pitcher / closer', 'Pitches short, high-pressure outings late in games.', ['pitching', 'fielding'], 'Short sprints; recovery between appearances.', 'Legs, rotational core, shoulder and elbow care.', [
      ['durable_pitcher', 'Strong legs and trunk.'],
      ['power_hitter', 'Power-pitcher frame.'],
      ['hybrid', 'Athletic.'],
      ['strong_powerful', 'Base strength.'],
      ['lean_toned', 'Lean.'],
    ], true),
    P('Utility player', 'Plays several positions as the team needs.', ['fielding', 'throwing', 'hitting', 'baserunning'], 'Short sprints and lateral work.', 'Total-body athletic strength.', [
      ['middle_infielder', 'Quick and versatile.'],
      ['hybrid', 'All-round athleticism.'],
      ['rangy_outfielder', 'Range in the outfield.'],
      ['lean_toned', 'Lean.'],
      ['power_hitter', 'Strength at the plate.'],
    ], true),
  ],

  volleyball: [
    P('Setter', 'Runs the offense with the second touch.', ['setting', 'digging', 'serving'], 'Short bursts and lots of movement to the ball.', 'Legs and core, shoulder and wrist stability.', [
      ['setter_build', 'Quick, balanced and agile.'],
      ['volleyball', 'Springy for jump-setting and blocking.'],
      ['floor_general', 'Quick, low base.'],
      ['lean_toned', 'Lean.'],
      ['hybrid', 'All-round athleticism.'],
    ]),
    P('Outside hitter', 'Attacks from the left and passes in serve receive.', ['attacking', 'passing', 'serving'], 'Repeated jumps with short rest.', 'Jump power, shoulder stability and core.', [
      ['volleyball', 'Long, lean and springy.'],
      ['middle_blocker_build', 'Taller, longer frame.'],
      ['slasher', 'Explosive legs.'],
      ['jumper', 'Track-style jump power.'],
      ['hybrid', 'All-round athleticism.'],
    ]),
    P('Opposite', 'Attacks from the right and blocks the other team’s best hitter.', ['attacking', 'blocking', 'serving'], 'Repeated jumps with short rest.', 'Jump power, shoulders and core.', [
      ['volleyball', 'Springy and powerful.'],
      ['middle_blocker_build', 'Length to block.'],
      ['slasher', 'Explosive legs.'],
      ['jumper', 'Jump power.'],
      ['strong_powerful', 'Base strength.'],
    ]),
    P('Middle blocker', 'Blocks across the net and hits quick sets.', ['blocking', 'attacking'], 'Repeated jumps and lateral bursts along the net.', 'Jump power, landing strength, shoulders.', [
      ['middle_blocker_build', 'Tall, long and springy.'],
      ['volleyball', 'Springy frame.'],
      ['rim_protector', 'Long and strong.'],
      ['jumper', 'Jump power.'],
      ['hybrid', 'All-round athleticism.'],
    ]),
    P('Libero / defensive specialist', 'Passes and digs; plays back row only.', ['passing', 'digging', 'serving'], 'Short reaction bursts and getting up off the floor.', 'Legs, hips and core; shoulder health.', [
      ['libero_build', 'Low, quick and agile.'],
      ['setter_build', 'Balanced and agile.'],
      ['floor_general', 'Quick, low base.'],
      ['lean_toned', 'Lean.'],
      ['gymnast', 'Compact body control.'],
    ]),
    P('Six-rotation outside hitter', 'An outside hitter who stays in for all six rotations: attacks, passes and defends.', ['attacking', 'passing', 'digging', 'serving'], 'Repeated jumps and defensive movement.', 'Jump power and durability.', [
      ['volleyball', 'Springy, lean and durable.'],
      ['setter_build', 'Agility for back-row play.'],
      ['hybrid', 'All-round athleticism.'],
      ['jumper', 'Jump power.'],
      ['lean_toned', 'Lean.'],
    ], true),
  ],

  track_running: [
    P('Sprints', '100 m and 200 m.', ['starts', 'mechanics', 'speed_endurance'], 'Short maximal sprints with full rest; tempo runs.', 'Heavy lower-body strength and jumps.', [
      ['sprinter', 'The classic sprinter build.'],
      ['burner', 'Lean, fast and powerful.'],
      ['jumper', 'Springy and explosive.'],
      ['hurdler', 'Long-legged speed.'],
      ['hybrid', 'Athletic base for younger sprinters.'],
    ]),
    P('Hurdles', '100/110 m hurdles and 300/400 m hurdles.', ['hurdles', 'starts', 'mechanics'], 'Sprints and rhythm runs over hurdles; tempo.', 'Hips, hamstrings and mobility.', [
      ['hurdler', 'Long, lean and mobile.'],
      ['sprinter', 'Speed and power.'],
      ['jumper', 'Spring.'],
      ['middle_distance', 'For the 300/400 m hurdles.'],
      ['lean_toned', 'Lean.'],
    ]),
    P('Middle distance', '800 m and 1500 m/mile.', ['speed_endurance', 'aerobic', 'mechanics'], 'Mix of easy miles, threshold and fast intervals.', 'Strength twice a week for injury prevention and speed.', [
      ['middle_distance', 'Lean with some speed muscle.'],
      ['distance_runner', 'Very lean aerobic engine.'],
      ['sprinter', 'More muscle for 400–800 m runners.'],
      ['midfielder', 'Repeat-sprint engine.'],
      ['lean_toned', 'Lean.'],
    ]),
    P('Distance', '3000 m to cross-country.', ['aerobic', 'speed_endurance'], 'Mostly easy running with one or two harder sessions.', 'Strength twice a week: calves, hips, core.', [
      ['distance_runner', 'Light and efficient.'],
      ['middle_distance', 'A bit more speed muscle.'],
      ['midfielder', 'Endurance engine.'],
      ['lean_toned', 'Lean.'],
      ['hybrid', 'Strength plus running.'],
    ]),
    P('Jumps', 'Long, triple, high jump and pole vault.', ['jumps', 'starts', 'mechanics'], 'Short sprints and jump circuits with full rest.', 'Explosive lower body and landing strength.', [
      ['jumper', 'Springy, lean and explosive.'],
      ['sprinter', 'Speed on the runway.'],
      ['volleyball', 'Long and springy.'],
      ['hurdler', 'Long-legged speed.'],
      ['gymnast', 'Body control for pole vault.'],
    ]),
    P('Throws', 'Shot put, discus, javelin and hammer.', ['throws', 'starts'], 'Short explosive efforts; general fitness.', 'Heavy compound lifts, rotational power, shoulder health.', [
      ['thrower', 'Big, strong and explosive.'],
      ['strong_powerful', 'Raw strength.'],
      ['interior_dl', 'Thick and powerful.'],
      ['power_hitter', 'Rotational power.'],
      ['hybrid', 'Athletic base.'],
    ]),
    P('400 m', 'One lap all-out: speed that lasts.', ['speed_endurance', 'starts', 'mechanics'], 'Speed endurance, tempo and some aerobic running.', 'Heavy lower body, jumps and core.', [
      ['sprinter', 'Sprint power.'],
      ['middle_distance', 'Endurance with speed.'],
      ['burner', 'Lean speed.'],
      ['hurdler', 'Long-legged speed.'],
      ['hybrid', 'All-round athleticism.'],
    ], true),
    P('Combined events', 'Heptathlon or decathlon: sprints, hurdles, jumps and throws.', ['hurdles', 'jumps', 'throws', 'speed_endurance'], 'A bit of everything: sprints, tempo, jump and throw circuits.', 'Balanced total-body strength and power.', [
      ['hybrid', 'The all-rounder.'],
      ['sprinter', 'Speed and power.'],
      ['jumper', 'Spring.'],
      ['thrower', 'Strength for the throws.'],
      ['hurdler', 'Long-legged speed.'],
    ], true),
  ],

  swimming: [
    P('Freestyle', 'Front crawl, all distances.', ['freestyle', 'starts_turns', 'endurance'], 'Swim sets by race distance.', 'Pulling strength, shoulder health, core.', [
      ['swimmer', 'V-taper and long frame.'],
      ['sprint_swimmer', 'More muscle for 50/100 m.'],
      ['distance_swimmer', 'Lean endurance frame.'],
      ['lean_toned', 'Lean.'],
      ['hybrid', 'Athletic base.'],
    ]),
    P('Backstroke', 'Swimming on your back.', ['starts_turns', 'kick', 'endurance'], 'Swim sets by race distance.', 'Pulling strength and shoulder mobility.', [
      ['swimmer', 'V-taper.'],
      ['sprint_swimmer', 'Power.'],
      ['distance_swimmer', 'Lean endurance.'],
      ['lean_toned', 'Lean.'],
      ['gymnast', 'Shoulder strength.'],
    ]),
    P('Breaststroke', 'Strongest kick of any stroke.', ['kick', 'starts_turns', 'endurance'], 'Swim sets with lots of kick.', 'Strong legs, hips and adductors; knee care.', [
      ['breaststroker', 'Powerful legs and hips.'],
      ['swimmer', 'Long frame.'],
      ['sprint_swimmer', 'Power.'],
      ['hybrid', 'Athletic base.'],
      ['lean_toned', 'Lean.'],
    ]),
    P('Butterfly', 'The most demanding stroke for the shoulders and core.', ['kick', 'freestyle', 'endurance'], 'Short, high-quality sets.', 'Shoulder strength, core and dolphin-kick power.', [
      ['sprint_swimmer', 'Powerful upper body.'],
      ['swimmer', 'V-taper.'],
      ['gymnast', 'Shoulder and core strength.'],
      ['hybrid', 'Athletic base.'],
      ['lean_toned', 'Lean.'],
    ]),
    P('IM', 'Individual medley: all four strokes.', ['kick', 'starts_turns', 'endurance', 'freestyle'], 'Mixed-stroke sets.', 'Balanced upper and lower body.', [
      ['swimmer', 'All-round swimmer build.'],
      ['breaststroker', 'For a strong breaststroke leg.'],
      ['distance_swimmer', 'Endurance.'],
      ['sprint_swimmer', 'Power.'],
      ['hybrid', 'Athletic base.'],
    ]),
    P('Distance', '400 m and up.', ['endurance', 'freestyle', 'starts_turns'], 'High aerobic volume.', 'Shoulder health and core.', [
      ['distance_swimmer', 'Lean and efficient.'],
      ['swimmer', 'V-taper.'],
      ['distance_runner', 'Lean endurance.'],
      ['lean_toned', 'Lean.'],
      ['hybrid', 'Athletic base.'],
    ]),
    P('Sprint freestyle (50/100)', 'The shortest, fastest races.', ['freestyle', 'starts_turns', 'kick'], 'Short, all-out efforts with long rest.', 'Heavier strength work: pulling, pressing, legs for starts.', [
      ['sprint_swimmer', 'Powerful and muscular.'],
      ['swimmer', 'V-taper.'],
      ['sprinter', 'Explosive starts.'],
      ['muscular_defined', 'Upper-body muscle.'],
      ['hybrid', 'Athletic base.'],
    ], true),
    P('Open water', 'Long races in lakes or the sea.', ['endurance', 'freestyle'], 'High aerobic volume; sighting practice.', 'Shoulder health and core.', [
      ['distance_swimmer', 'Lean and efficient.'],
      ['swimmer', 'V-taper.'],
      ['distance_runner', 'Endurance.'],
      ['hybrid', 'Durability.'],
      ['lean_toned', 'Lean.'],
    ], true),
  ],

  tennis: [
    P('Singles', 'Covers the whole court alone.', ['footwork', 'forehand', 'backhand', 'serve'], 'Interval work matching points: 10–20 s on, 20–30 s off.', 'Legs, rotational core, shoulder and forearm care.', [
      ['tennis', 'Lean, agile and balanced.'],
      ['power_baseliner', 'Stronger frame for heavy groundstrokes.'],
      ['midfielder', 'Endurance for long matches.'],
      ['lean_toned', 'Lean.'],
      ['hybrid', 'Athletic base.'],
    ]),
    P('Doubles', 'Plays with a partner; more net play.', ['volley', 'serve', 'footwork'], 'Short reaction bursts.', 'Legs, core and shoulders.', [
      ['tennis', 'Agile.'],
      ['big_server', 'Tall frame for serve and net coverage.'],
      ['power_baseliner', 'Power.'],
      ['lean_toned', 'Lean.'],
      ['hybrid', 'Athletic base.'],
    ]),
    P('Aggressive baseliner', 'Dictates points with big groundstrokes.', ['forehand', 'backhand', 'footwork', 'serve'], 'Interval work and lateral sprints.', 'Rotational power and legs.', [
      ['power_baseliner', 'Strong and explosive.'],
      ['tennis', 'Agile.'],
      ['hybrid', 'Athletic.'],
      ['muscular_defined', 'Upper-body power.'],
      ['lean_toned', 'Lean.'],
    ], true),
    P('Counter-puncher', 'Gets everything back and wins with defense and consistency.', ['footwork', 'backhand', 'forehand'], 'Long rallies: intervals and aerobic base.', 'Legs, core and endurance.', [
      ['tennis', 'Lean and quick.'],
      ['midfielder', 'Endurance engine.'],
      ['lean_toned', 'Light.'],
      ['middle_distance', 'Speed endurance.'],
      ['hybrid', 'Athletic.'],
    ], true),
    P('Serve-and-volley', 'Serves and attacks the net.', ['serve', 'volley', 'footwork'], 'Short explosive bursts.', 'Shoulders, legs and core.', [
      ['big_server', 'Tall with strong shoulders.'],
      ['tennis', 'Agile.'],
      ['power_baseliner', 'Power.'],
      ['volleyball', 'Long and springy.'],
      ['hybrid', 'Athletic.'],
    ], true),
    P('All-court player', 'Comfortable everywhere: baseline, net and in between.', ['forehand', 'volley', 'serve', 'footwork'], 'Intervals and short bursts.', 'Balanced strength.', [
      ['tennis', 'Agile all-rounder.'],
      ['power_baseliner', 'Power.'],
      ['big_server', 'Serve.'],
      ['hybrid', 'Athletic.'],
      ['lean_toned', 'Lean.'],
    ], true),
  ],

  other: [],
};

/** Common two-way pairings: [first position, second position]. */
export const TWO_WAY: Partial<Record<SportId, [string, string][]>> = {
  american_football: [
    ['Wide receiver', 'Defensive back'],
    ['Wide receiver', 'Cornerback'],
    ['Running back', 'Linebacker'],
    ['Running back', 'Safety'],
    ['Quarterback', 'Safety'],
    ['Tight end', 'Defensive line'],
    ['Tight end', 'Linebacker'],
    ['Offensive line', 'Defensive line'],
    ['Slot receiver', 'Nickel / Star (hybrid DB-LB)'],
  ],
  baseball_softball: [
    ['Pitcher', 'Outfield'],
    ['Pitcher', 'Infield'],
    ['Catcher', 'Corner infielder (1B/3B)'],
  ],
  soccer: [['Full back', 'Winger']],
  track_running: [
    ['Sprints', 'Jumps'],
    ['Sprints', 'Hurdles'],
  ],
  swimming: [['Freestyle', 'Butterfly']],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The position whose name matches what the athlete typed (exact, then loose). */
export function positionInfo(sport: SportId, name: string | null | undefined): PositionInfo | undefined {
  if (!name) return undefined;
  const list = POSITIONS[sport] ?? [];
  const n = norm(name);
  if (!n) return undefined;
  return (
    list.find((p) => norm(p.name) === n) ??
    list.find((p) => norm(p.name).split(' / ').some((part) => part === n) || norm(p.name).startsWith(n) || n.startsWith(norm(p.name))) ??
    list.find((p) => norm(p.name).includes(n) || n.includes(norm(p.name)))
  );
}

/** Builds for one or two positions: the first position's list, then the second's, without repeats. */
export function buildsForPositions(sport: SportId, positions: (string | null | undefined)[], count = 5): { id: string; why: string; position: string }[] {
  const infos = positions.map((p) => positionInfo(sport, p)).filter((p): p is PositionInfo => !!p);
  const out: { id: string; why: string; position: string }[] = [];
  if (infos.length === 2) {
    // Two-way: the all-round two-way build first, then alternate the two positions' best builds.
    out.push({ id: 'two_way_athlete', why: `Built to play ${infos[0]!.name.toLowerCase()} and ${infos[1]!.name.toLowerCase()} in the same game.`, position: `${infos[0]!.name} + ${infos[1]!.name}` });
    const a = infos[0]!.builds;
    const b = infos[1]!.builds;
    for (let i = 0; i < 5 && out.length < count; i++) {
      for (const [list, info] of [[a, infos[0]!], [b, infos[1]!]] as const) {
        const entry = list[i];
        if (entry && !out.some((o) => o.id === entry[0]) && out.length < count) out.push({ id: entry[0], why: entry[1], position: info.name });
      }
    }
    return out;
  }
  for (const info of infos) for (const [id, why] of info.builds) if (!out.some((o) => o.id === id) && out.length < count) out.push({ id, why, position: info.name });
  return out;
}

export type Emphasis = 'speed' | 'size' | 'jump' | 'rotation' | 'endurance' | 'balanced';

/** What a position's gym work should emphasise. */
export function positionEmphasis(sport: SportId, position: string | null | undefined): Emphasis {
  const n = (positionInfo(sport, position)?.name ?? position ?? '').toLowerCase();
  if (!n) return 'balanced';
  if (/line|nose|tackle|center$|^center|throws|catcher|h-back|fullback|tight end|power forward|small-ball/.test(n)) return 'size';
  if (/receiver|running back|corner|defensive back|safety|nickel|return|winger|wing back|full back|inside forward|striker|sprints|400|hurdles|outfield|center fielder/.test(n)) return 'speed';
  if (/hitter|middle blocker|opposite|jumps|rim-running|guard|wing|forward|stretch|libero|setter/.test(n)) return 'jump';
  if (/pitcher|quarterback|singles|doubles|baseliner|serve|counter|all-court|infield|utility|kicker|goalkeeper|keeper/.test(n)) return 'rotation';
  if (/distance|middle distance|midfielder|box-to-box|playmaker|open water|freestyle|backstroke|breaststroke|butterfly|im$/.test(n)) return 'endurance';
  return 'balanced';
}
