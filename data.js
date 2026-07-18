/* data.js — exercise library + seed journey (Waterson 5-2 accumulator, adapted) */

const BUCKETS = ['6-8', '9-12', '13-16', '17-20+'];

const CARDIO_MODALITIES = [
  'Run / Sprints', 'Bike', 'Row', 'SkiErg',
  'Heavy bag', 'Battle ropes', 'Skipping', 'Plyo circuit',
];

const ZONE2_MODALITIES = ['Bike', 'Run', 'Row', 'Walk / Hike', 'SkiErg', 'Swim'];

const DAY_TYPES = {
  LEGS1:  { label: 'Legs 1',  kind: 'legs' },
  UPPER1: { label: 'Upper 1', kind: 'upper' },
  MIXED1: { label: 'Mixed 1', kind: 'mixed' },
  LEGS2:  { label: 'Legs 2',  kind: 'legs' },
  UPPER2: { label: 'Upper 2', kind: 'upper' },
  MIXED2: { label: 'Mixed 2', kind: 'mixed' },
  ZONE2:  { label: 'Zone 2',  kind: 'zone2' },
};

// measure: 'reps' (log reps + weight) | 'secs' (log seconds + weight)
const SEED_EXERCISES = [
  // legs
  { id: 'box_squat',            name: 'Box squat',                group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Sit back to the box, drive up through heels' },
  { id: 'paused_box_squat',     name: 'Paused box squat',         group: 'legs',  measure: 'reps', bucket: '6-8',   cue: '2s pause on the box, no bounce' },
  { id: 'reverse_lunge',        name: 'Reverse lunge',            group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Knee kisses the floor, per leg' },
  { id: 'deficit_reverse_lunge',name: 'Deficit reverse lunge',    group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Front foot on low plate, per leg' },
  { id: 'goblet_squat',         name: 'Goblet squat',             group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Elbows inside knees at depth' },
  { id: 'db_front_squat',       name: 'DB front squat',           group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Dumbbells racked at shoulders' },
  { id: 'bulgarian_split_squat',name: 'Bulgarian split squat',    group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Rear foot on bench, per leg' },
  { id: 'lateral_lunge',        name: 'Lateral lunge',            group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Sit into the working hip, per leg' },
  { id: 'romanian_deadlift',    name: 'Romanian deadlift',        group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Hinge, soft knees, flat back' },
  { id: 'single_leg_rdl',       name: 'Single-leg RDL',           group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Square hips, per leg' },
  { id: 'hip_thrust',           name: 'Hip thrust',               group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'Shoulders on bench, squeeze glutes at top' },
  { id: 'single_leg_hip_thrust',name: 'Single-leg hip thrust',    group: 'legs',  measure: 'reps', bucket: '9-12',  cue: 'One foot down, per leg' },
  { id: 'box_step_up',          name: 'Box step-up',              group: 'legs',  measure: 'reps', bucket: '13-16', cue: 'Step up both feet, step down — never jump down' },
  { id: 'lateral_box_step',     name: 'Lateral box step-up',      group: 'legs',  measure: 'reps', bucket: '13-16', cue: 'Sideways to the box, per leg' },
  { id: 'calf_raise',           name: 'Calf raise',               group: 'legs',  measure: 'reps', bucket: '13-16', cue: 'Full stretch at bottom, pause at top' },
  { id: 'jump_squat',           name: 'Jump squat',               group: 'legs',  measure: 'reps', bucket: '13-16', cue: 'Land soft, reset each rep' },
  { id: 'band_lateral_walk',    name: 'Band lateral walk',        group: 'legs',  measure: 'reps', bucket: '17-20+',cue: 'Band above knees, small squat steps' },
  { id: 'band_matrix',          name: 'Band matrix',              group: 'legs',  measure: 'reps', bucket: '17-20+',cue: 'Side steps + forward/back, keep band tension' },
  { id: 'wall_sit',             name: 'Wall sit',                 group: 'legs',  measure: 'secs', bucket: null,    cue: 'Knees at 90°, back flat on wall' },
  // upper
  { id: 'pull_up',              name: 'Pull-up',                  group: 'upper', measure: 'reps', bucket: '6-8',   cue: 'Full hang to chin over bar' },
  { id: 'weighted_pull_up',     name: 'Weighted pull-up',         group: 'upper', measure: 'reps', bucket: '6-8',   cue: 'Add belt/dumbbell, strict form' },
  { id: 'chin_up',              name: 'Chin-up',                  group: 'upper', measure: 'reps', bucket: '6-8',   cue: 'Underhand grip, full range' },
  { id: 'lat_pulldown',         name: 'Lat pulldown',             group: 'upper', measure: 'reps', bucket: '9-12',  cue: 'Pull to upper chest, control up' },
  { id: 'db_bench_press',       name: 'DB bench press',           group: 'upper', measure: 'reps', bucket: '9-12',  cue: 'Full range, elbows ~45°' },
  { id: 'bench_press',          name: 'Bench press',              group: 'upper', measure: 'reps', bucket: '6-8',   cue: 'Bar to chest, feet planted' },
  { id: 'incline_db_press',     name: 'Incline DB press',         group: 'upper', measure: 'reps', bucket: '9-12',  cue: 'Bench ~30°, press up and slightly back' },
  { id: 'push_up',              name: 'Push-up',                  group: 'upper', measure: 'reps', bucket: '13-16', cue: 'Elbows to 90°, neutral back' },
  { id: 'overhead_press',       name: 'Overhead press',           group: 'upper', measure: 'reps', bucket: '9-12',  cue: 'Press strict, ribs down' },
  { id: 'arnold_press',         name: 'Arnold press',             group: 'upper', measure: 'reps', bucket: '9-12',  cue: 'Rotate palms through the press' },
  { id: 'bent_over_row',        name: 'Bent-over row',            group: 'upper', measure: 'reps', bucket: '9-12',  cue: 'Hinge, pull to lower ribs' },
  { id: 'single_arm_row',       name: 'Single-arm DB row',        group: 'upper', measure: 'reps', bucket: '9-12',  cue: 'Knee on bench, per arm' },
  { id: 'shoulder_matrix',      name: 'Shoulder matrix',          group: 'upper', measure: 'reps', bucket: '13-16', cue: 'Lateral + front raises, soft elbows' },
  { id: 'lateral_raise',        name: 'Lateral raise',            group: 'upper', measure: 'reps', bucket: '13-16', cue: 'To shoulder height, no swing' },
  { id: 'dips',                 name: 'Dips',                     group: 'upper', measure: 'reps', bucket: '9-12',  cue: 'Elbows to 90°, lean slightly forward' },
  { id: 'weighted_dip',         name: 'Weighted dip',             group: 'upper', measure: 'reps', bucket: '6-8',   cue: 'Add weight, full depth' },
  { id: 'cable_chest_fly',      name: 'Cable chest fly (low-high)',group: 'upper',measure: 'reps', bucket: '13-16', cue: 'Split stance, soft elbows, cables to forehead' },
  { id: 'face_pull',            name: 'Face pull',                group: 'upper', measure: 'reps', bucket: '13-16', cue: 'Pull to face, elbows high' },
  // core
  { id: 'ab_rollout',           name: 'Ab rollout',               group: 'core',  measure: 'reps', bucket: '9-12',  cue: 'Roll out slow, no sag' },
  { id: 'hanging_knee_raise',   name: 'Hanging knee raise',       group: 'core',  measure: 'reps', bucket: '9-12',  cue: 'Knees to chest, no swing' },
  { id: 'plank_to_pike',        name: 'Plank to pike',            group: 'core',  measure: 'reps', bucket: '9-12',  cue: 'Forearms down, hips up and back' },
  { id: 'pallof_press',         name: 'Pallof press',             group: 'core',  measure: 'reps', bucket: '13-16', cue: 'Resist rotation, per side' },
  { id: 'v_up',                 name: 'V-up',                     group: 'core',  measure: 'reps', bucket: '13-16', cue: 'Hands to feet, control down' },
  { id: 'russian_twist',        name: 'Russian twist',            group: 'core',  measure: 'reps', bucket: '17-20+',cue: 'Heels light, rotate through torso' },
  { id: 'mountain_climbers',    name: 'Mountain climbers',        group: 'core',  measure: 'secs', bucket: null,    cue: 'Fast knees, flat back' },
  { id: 'bear_crawl',           name: 'Bear crawl',               group: 'core',  measure: 'secs', bucket: null,    cue: 'Knees an inch off the floor' },
  // mixed / plyo / full-body
  { id: 'box_jump',             name: 'Box jump',                 group: 'mixed', measure: 'reps', bucket: '6-8',   cue: 'Explode up, step down' },
  { id: 'broad_jump',           name: 'Broad jump',               group: 'mixed', measure: 'reps', bucket: '6-8',   cue: 'Stick the landing, walk back' },
  { id: 'kb_swing',             name: 'Kettlebell swing',         group: 'mixed', measure: 'reps', bucket: '13-16', cue: 'Hips drive, arms relaxed' },
  { id: 'kb_clean_press',       name: 'KB clean & press',         group: 'mixed', measure: 'reps', bucket: '9-12',  cue: 'Clean to rack, press strict, per arm' },
  { id: 'thruster',             name: 'Thruster',                 group: 'mixed', measure: 'reps', bucket: '9-12',  cue: 'Squat into overhead press, one motion' },
  { id: 'db_snatch',            name: 'DB snatch',                group: 'mixed', measure: 'reps', bucket: '9-12',  cue: 'Floor to overhead, per arm' },
  { id: 'devil_press',          name: 'Devil press',              group: 'mixed', measure: 'reps', bucket: '9-12',  cue: 'Burpee + double-DB snatch' },
  { id: 'burpee',               name: 'Burpee',                   group: 'mixed', measure: 'reps', bucket: '9-12',  cue: 'Chest to floor, jump at top' },
  { id: 'sprawl',               name: 'Sprawl',                   group: 'mixed', measure: 'reps', bucket: '13-16', cue: 'Burpee without push-up or jump' },
  { id: 'med_ball_slam',        name: 'Med-ball slam',            group: 'mixed', measure: 'reps', bucket: '13-16', cue: 'Full extension, slam hard' },
  { id: 'box_jump_over',        name: 'Box jump-over',            group: 'mixed', measure: 'reps', bucket: '9-12',  cue: 'Jump on, step over and down' },
  { id: 'walking_lunge',        name: 'Walking lunge',            group: 'mixed', measure: 'reps', bucket: '13-16', cue: 'Long steps, torso tall, total steps' },
  { id: 'renegade_row',         name: 'Renegade row',             group: 'mixed', measure: 'reps', bucket: '9-12',  cue: 'Plank on DBs, row without twisting' },
  { id: 'farmers_carry',        name: "Farmer's carry",           group: 'mixed', measure: 'secs', bucket: null,    cue: 'Heavy DBs, tall posture' },
  { id: 'suitcase_carry',       name: 'Suitcase carry',           group: 'mixed', measure: 'secs', bucket: null,    cue: 'One-sided carry, stay level, per side' },
];

// Slot order = accumulator frequency: A done 5x per session, B 4x ... E 1x.
// A/B = anchor lifts. Weeks 1-3 (early) and 4-6 (late) blocks.
const SEED_BLOCKS = {
  early: {
    LEGS1:  ['box_squat', 'reverse_lunge', 'hip_thrust', 'box_step_up', 'band_lateral_walk'],
    UPPER1: ['pull_up', 'db_bench_press', 'overhead_press', 'bent_over_row', 'ab_rollout'],
    MIXED1: ['box_jump', 'kb_swing', 'thruster', 'plank_to_pike', 'farmers_carry'],
    LEGS2:  ['goblet_squat', 'bulgarian_split_squat', 'romanian_deadlift', 'calf_raise', 'wall_sit'],
    UPPER2: ['incline_db_press', 'lat_pulldown', 'dips', 'shoulder_matrix', 'face_pull'],
    MIXED2: ['burpee', 'walking_lunge', 'renegade_row', 'med_ball_slam', 'mountain_climbers'],
  },
  late: {
    LEGS1:  ['paused_box_squat', 'deficit_reverse_lunge', 'single_leg_hip_thrust', 'lateral_box_step', 'band_matrix'],
    UPPER1: ['weighted_pull_up', 'bench_press', 'arnold_press', 'single_arm_row', 'hanging_knee_raise'],
    MIXED1: ['broad_jump', 'kb_clean_press', 'db_snatch', 'v_up', 'suitcase_carry'],
    LEGS2:  ['db_front_squat', 'lateral_lunge', 'single_leg_rdl', 'jump_squat', 'wall_sit'],
    UPPER2: ['weighted_dip', 'chin_up', 'cable_chest_fly', 'lateral_raise', 'pallof_press'],
    MIXED2: ['devil_press', 'box_jump_over', 'sprawl', 'russian_twist', 'bear_crawl'],
  },
};

const WEEK_PLAN = ['LEGS1', 'UPPER1', 'MIXED1', 'LEGS2', 'UPPER2', 'MIXED2', 'ZONE2'];

function seedState() {
  const exercises = {};
  SEED_EXERCISES.forEach((e) => { exercises[e.id] = e; });
  return {
    version: STORE_VERSION,
    settings: { cardioMinutes: 2, fontScale: 1, weightStep: 2.5 },
    exercises,
    journeys: [{
      id: 'j1',
      name: 'Journey 1',
      startDate: new Date().toISOString().slice(0, 10),
      weekCount: 6,
      weekPlan: WEEK_PLAN.slice(),
      blocks: JSON.parse(JSON.stringify(SEED_BLOCKS)),
    }],
    activeJourneyId: 'j1',
    sessions: [],
    current: null,
  };
}

function blockForWeek(week) { return week <= 3 ? 'early' : 'late'; }
