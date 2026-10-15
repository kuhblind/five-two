/* data.js — exercise library + seed journey (Waterson 5-2 accumulator, adapted) */

const BUCKETS = ['3-5', '6-8', '9-12', '13-16', '17-20+'];

const CARDIO_MODALITIES = [
  'Treadmill', 'Bike', 'Row', 'Stepper',
  'Heavy bag', 'Battle ropes', 'Skipping', 'Plyo circuit', 'Bear crawl / crab walk',
];

const DAY_TYPES = {
  LEGS1:  { label: 'Legs 1',  kind: 'legs' },
  UPPER1: { label: 'Upper 1', kind: 'upper' },
  CORE:   { label: 'Core',    kind: 'core' },
  SPRINT: { label: 'Sprint',  kind: 'sprint' },
  LEGS2:  { label: 'Legs 2',  kind: 'legs' },
  UPPER2: { label: 'Upper 2', kind: 'upper' },
  REST:   { label: 'Rest',    kind: 'rest' },
  ZONE2:  { label: 'Zone 2',  kind: 'zone2' },
  LIGHT:  { label: 'Light',   kind: 'light' },
  // legacy types (Journey 1 / v1 journeys / old journal entries)
  MIXED1: { label: 'Mixed',   kind: 'mixed' },
  MIXED2: { label: 'Mixed 2', kind: 'mixed' },
};

/* Reverse-pyramid rep ladders (Journey 2). The canonical 5-2 ladder is
   25/20/15/10/8 by round; barbell anchors run a low-rep variant, because the
   strength stimulus sits at heavy load and low reps. Slot index i (A=0) first appears in
   round i+1; its rep for round r is LADDER[i][r-i-1]. Weight goes UP each
   round on both ladders — rounds 4-5 are the hardest, not the lightest. */
const LADDERS = {
  barbell: [[15, 12, 10, 8, 6], [12, 10, 8, 6], [10, 8, 6], [8, 6], [6]],
  general: [[25, 20, 15, 12, 10], [20, 15, 12, 10], [15, 12, 10], [12, 10], [10]],
};

/* The four barbell numbers Journey 2 is graded on: top set of `reps` clean
   reps by the journey's last day. Seeded onto the journey as `scoreboard` so a
   later journey can carry different targets. */
const JOURNEY2_SCOREBOARD = [
  { ex: 'trap_bar_deadlift', reps: 6, target: 78 },
  { ex: 'bench_press', reps: 6, target: 60 },
  { ex: 'overhead_press', reps: 6, target: 40 },
  { ex: 'hip_thrust', reps: 6, target: 70 },
];

const SPRINT_MODALITIES = ['Run / Track', 'Bike', 'Row', 'Stepper'];

/* Activation & deactivation repositories — paraphrased ideas in the spirit of
   the Intelligent Fitness bolt-ons. ~10 min before, ~10-15 min after. */
const ACTIVATION_IDEAS = [
  { name: 'Easy cardio, 10 min', text: 'Bike, row or jog at conversational pace. You are raising the heart rate and telling the body work is coming — not training yet.' },
  { name: 'Throw a ball around', text: 'Rugby ball, baseball, anything. Coordination, fun, and the moment to ask yourself: how did I sleep, how do I feel, what do I want from today?' },
  { name: 'Skipping', text: '2–3 easy minutes. Rhythm, calves, coordination — a favourite pre-workout switch-on.' },
  { name: 'Dynamic mobility', text: 'Arm circles, leg swings, hip openers, torso rotations. Move every joint you are about to load through its range.' },
  { name: 'Pedal to standing', text: 'From the pike position (hands flat, hips high), pedal the feet one at a time, walk the feet toward the hands, and roll up to standing slowly. Wakes the calves and hamstrings.' },
  { name: 'Plank → pike → cobra', text: 'From a forearm plank, lift the hips to a pike, lower them until they hover, then come forward into a gentle cobra looking slightly up. Spine and abdominals ready.' },
  { name: 'Agility bursts', text: 'Sidesteps, a few light accelerations with controlled deceleration, ten seconds of fast feet. Prime the nervous system, especially before sprint or plyo work.' },
];

/* Concrete dynamic stretches — drawn from the 10-Weeks Wednesday sessions
   plus warm-up standards. */
const ACTIVATION_STRETCHES = [
  { name: 'Bear crawl into pigeon', text: 'Hinge down, walk the hands out to a plank. Bring one knee forward and lower toward the floor at 90°, sink onto the forearms, then reach the arms long. Ease out, walk back, stand up. Per side — opens hips and glutes.' },
  { name: 'Bear crawl into cobra', text: 'Walk out to a plank, drop the hips and bring the chest forward into a gentle cobra, looking slightly up. Walk back to standing. Spine extension without load.' },
  { name: 'Reverse lunge + hip-flexor reach', text: 'Step back into a lunge, rear knee down, interlock the fingers and reach overhead with a slight lean back until the hip flexor stretches. Add a small forward-back rock. Per side — the tall-lifter essential.' },
  { name: 'Quad-stretch into reverse lunge', text: 'Standing quad stretch (heel to glute, hold ~30 s), release straight back into a reverse lunge with arms locked overhead, then rise and hug the knee to the chest. One flowing sequence per leg.' },
  { name: "World's greatest stretch", text: 'Long lunge, both hands inside the front foot. Drop the back knee, sink the hips, then rotate the inside arm up to the ceiling, following it with your eyes. Per side — hips, hamstrings and thoracic spine in one move.' },
  { name: 'Leg swings', text: 'Hold something stable. Swing one leg front-to-back 10-15 times, then side-to-side across the body. Loosens hips and hamstrings dynamically — no bouncing at end range.' },
  { name: 'Hip circles / openers', text: 'Standing, lift one knee and draw the biggest circle you can — inward rotations, then outward. Per side.' },
  { name: 'Cat-cow', text: 'On all fours, alternate slowly between rounding the spine up (cat) and letting it sink with the chest forward (cow), moving with the breath. Wakes up every spinal segment gently.' },
  { name: 'Thoracic openers (book drill)', text: 'Kneeling, thread one arm under the body then rotate it up to the ceiling, chest following. Per side. Upper-back rotation so the lower back does not have to provide it later.' },
  { name: 'Spinal mobility rock', text: 'On your back, hug both knees to the chest and rock gently forward and back, growing the range a little each rep. From the Wednesday sessions — a favourite before hinge days.' },
  { name: 'Glutes & piriformis (figure-4)', text: 'On your back, ankle over the opposite knee, clasp behind the thigh and pull toward you until the glute stretches. Per side.' },
  { name: 'Pedal to standing', text: 'Pike position, hands flat, pedal the heels one at a time, walk the feet to the hands and roll up slowly to standing. Calves and hamstrings switched on.' },
  { name: 'Side crab', text: 'In a low squat, crawl sideways a few steps, shoot the trailing leg out, return, and go back the other way. Animalistic movement — ankles, hips and coordination.' },
  { name: 'Upper-body matrix', text: 'Kneeling: cross-body shoulder pull, hands clasped behind the back with chest proud, triceps reach down the spine, wrist circles both ways, and a gentle side neck stretch. ~30 s each.' },
  { name: '90-90 hip switch', text: 'Sitting with both knees bent at 90°, one in front, one to the side, rotate the knees together over to the other side without using the hands. Internal + external hip rotation in one drill.' },
  { name: 'Ankle rockers', text: 'Half-kneeling, front foot flat about a hand-width from a wall. Drive the knee over the toes to touch the wall, heel stays down. Per side — squat depth lives in the ankles.' },
  { name: 'Goblet-squat prying', text: 'Hold the bottom of a light goblet squat and gently shift weight side to side, elbows prying the knees out. 30-45 s. Opens the hips exactly where the squat needs them.' },
];

const DEACTIVATION_IDEAS = [
  { name: 'Bring the heart rate down', text: 'Two or three minutes of easy movement — slow walk, light multidirectional steps. You are switching out of activity mode.' },
  { name: 'Stretch what you trained', text: 'Hold each stretch to a comfortable discomfort, wait for it to fade, then add roughly 10% more and hold again before easing off slowly. Control the exit as much as the entry — stretching marks the end of the session.' },
  { name: 'Breathing reset', text: 'Sit cross-legged, elbows on knees. Breathe into the lower third of the lungs, exhale fully. Ten to fifteen slow breaths — near-meditative, heart rate visibly drops.' },
  { name: 'Ten-second reactivation', text: 'Finish with a ten-second sprint on the spot. It sounds odd after calming down, but it leaves you invigorated for the rest of the day.' },
  { name: 'Refuel window', text: 'The best time to refuel is the 20–30 minutes after training: protein plus fluids. Prepare it before the session so it is waiting for you.' },
];

// measure: 'reps' (log reps + weight) | 'secs' (log seconds + weight)
// pattern: movement family -> pictogram in the Library and workout screens
const SEED_EXERCISES = [
  // legs
  { id: 'box_squat', barbell: true, speed: true, name: 'Box squat', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'squat',
    cue: 'Sit back to the box, drive up through heels',
    desc: 'Box at knee height behind you, bar or dumbbells racked, feet shoulder-width, toes slightly out. Brace the belly, then sit BACK, hips first, taking three seconds down until you sit fully on the box. Shins stay vertical, chest up. No bounce: pause one second staying tight, then drive up fast through the heels. Keep two to three reps in reserve; the set ends when speed drops or form bends. As slot A: ramp lighter in rounds 1–2, working weight rounds 3–5.' },
  { id: 'paused_box_squat', scheme: 'power', power: true, barbell: true, speed: true, name: 'Paused box squat', group: 'legs', measure: 'reps', bucket: '6-8', pattern: 'squat',
    cue: 'Three seconds down, full pause, stand up fast',
    desc: 'A box squat trained for speed. Lower for three seconds and sit fully on the box. Pause with everything tight, so the weight never rests and all momentum is gone. Then stand up as fast as possible. The load stays light enough that every rep is quick. The set ends at the first slow rep.' },
  { id: 'reverse_lunge', name: 'Reverse lunge', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'lunge',
    cue: 'Knee kisses the floor, per leg',
    desc: 'Hold a dumbbell at the chest (goblet) or stand free. Take a LONG step back, feet on railway tracks, not a tightrope, and lower for two seconds until the back knee touches the floor softly. Torso stays vertical, front shin vertical. Push hard through the front heel to stand. Hold something stable with one hand at first; that is technique, not cheating. Per leg.' },
  { id: 'deficit_reverse_lunge', range: [6, 8], name: 'Deficit reverse lunge', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'lunge',
    cue: 'Front foot on low plate, per leg',
    desc: 'A reverse lunge with the front foot on a low plate or step (5–10 cm) for extra depth and a bigger glute stretch. Two seconds down, back knee just below foot level, then drive up through the front heel. Torso stays tall the whole rep. Per leg.' },
  { id: 'goblet_squat', name: 'Goblet squat', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'squat',
    cue: 'Elbows inside knees at depth',
    desc: 'Hold one dumbbell or kettlebell vertically against the chest, elbows pointing down. Feet shoulder-width, toes slightly out. Sit down for two to three seconds until the elbows lightly brush the inside of the knees. Chest up, heels down. Stand up strong and squeeze the glutes at the top.' },
  { id: 'trap_bar_deadlift', scheme: 'topset', backoffReps: 6, barbell: true, name: 'Trap bar deadlift', group: 'legs', measure: 'reps', bucket: '6-8', pattern: 'hinge',
    cue: 'Neutral grip, push the floor away, no rounding',
    desc: 'Stand in the middle of the bar, feet hip-width. Grip the high handles with straps on anything heavy: the grip quits long before the legs do. Chest up, back long, big breath, brace hard, then push the floor away until you stand fully tall. Squeeze the glutes at the top, no lean-back. Lower in two seconds with the same flat back. Keep two to three reps in reserve: the set ends when bar speed drops, the back rounds, or the knees cave, whichever comes first. As slot A: ramp rounds 1–2, working weight rounds 3–5. If the pull feels deep, raise the plates on blocks.' },
  { id: 'bulgarian_split_squat', range: [6, 8], name: 'Bulgarian split squat', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'lunge',
    cue: 'Rear foot on bench, per leg',
    desc: 'Rear foot laces-down on a bench, front foot about two steps ahead. Lower straight down for two seconds until the front thigh is parallel to the floor. A slight forward lean is fine; the front heel stays planted. Drive up through that heel. Per leg.' },
  { id: 'lateral_lunge', name: 'Lateral lunge', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'lunge',
    cue: 'Sit into the working hip, per leg',
    desc: 'Take one wide step to the side. Sit back into that hip for two seconds, knee tracking over the foot, the other leg straight, both heels down. Start with bodyweight and half depth, and earn more range over the weeks before adding load. Push off hard back to standing. Per leg.' },
  { id: 'romanian_deadlift', range: [8, 12], name: 'Romanian deadlift', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'hinge',
    cue: 'Hinge, soft knees, flat back',
    desc: 'Start standing, weight against the thighs, knees soft. Push the hips straight back and lower the weight slowly, three seconds, sliding it down the legs only as far as a flat back allows, mid-shin at most. The hamstrings should pull hard. Drive the hips forward to stand and squeeze the glutes at the top. Range is earned over weeks. It is a hip movement, never a back lift.' },
  { id: 'single_leg_rdl', name: 'Single-leg RDL', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'hinge',
    cue: 'Square hips, per leg',
    desc: 'Stand on one leg, weight in the opposite hand. Hinge forward slowly as the free leg extends straight behind you. Hips stay level, back flat. Lower until the hamstring pulls, then squeeze the glute to stand tall. Touch the free toe down between reps if balance wobbles. Per leg.' },
  { id: 'hip_thrust', barbell: true, name: 'Hip thrust', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'bridge',
    cue: 'Barbell on the hips, squeeze glutes at top, +5 kg a session',
    desc: 'Shoulder blades on a bench, feet flat under the knees, the barbell with a pad across the hips (from 40 kg: bar plus two 10s; the 20 kg plates clear the floor once you are past that). Lower the hips almost to the floor, then drive up through the heels until the body is one straight line from knees to shoulders. At the top, tuck the tailbone slightly and squeeze the glutes hard for two seconds. Chin tucked, ribs down; never arch the lower back. Lower with control. The most spine-sparing lift on the sheet, so it progresses fastest: +5 kg every session the top set is clean.' },
  { id: 'single_leg_hip_thrust', range: [8, 8], name: 'Single-leg hip thrust', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'bridge',
    cue: 'One foot down, per leg',
    desc: 'A hip thrust with one foot down and the other leg held straight. Same rules: drive through the heel, keep the hips level, hold the two-second squeeze at the top, no back arch. Per leg.' },
  { id: 'box_step_up', name: 'Box step-up', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'lunge',
    cue: 'Step up both feet, step down — never jump down',
    desc: 'Face a knee-high box. Step up and press through the WHOLE foot of the top leg; do not push off the bottom leg. Stand fully tall on the box, then step down slowly, two seconds. Never jump down. All reps leading with one leg, then switch.' },
  { id: 'lateral_box_step', name: 'Lateral box step-up', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'lunge',
    cue: 'Sideways to the box, per leg',
    desc: 'Stand side-on to the box. Step up with the near leg, driving through its heel until you stand tall on top, then lower back down slowly on the same side. The top leg does all the work; the bottom leg comes along. Per leg.' },
  { id: 'calf_raise', name: 'Calf raise', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'raise',
    cue: 'Full stretch at bottom, pause at top',
    desc: 'Balls of the feet on an edge, heels hanging free. Lower for two seconds into a full stretch and pause briefly. Then rise as high as possible onto the toes and squeeze one second at the top. No bouncing: the slow stretch at the bottom is where the growth signal lives.' },
  { id: 'jump_squat', name: 'Jump squat', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'jump',
    cue: 'Land soft, reset each rep',
    desc: 'Sit into a quarter squat, arms swung back, then jump as high as you can with the hips fully opening. Land softly, toes first, knees bent, and come to a complete stop. Reset the stance, then jump again. Every jump maximal, every landing quiet.' },
  { id: 'band_lateral_walk', name: 'Band lateral walk', group: 'legs', measure: 'reps', bucket: '17-20+', pattern: 'band',
    cue: 'Band above knees, small squat steps',
    desc: 'Loop band just above the knees. Quarter-squat, toes forward. Step sideways with slow, deliberate steps, leading with the knee, and never let the feet come together, so the band stays tight the whole time. You should feel the outside of the hips working. Count steps in each direction.' },
  { id: 'band_matrix', name: 'Band matrix', group: 'legs', measure: 'reps', bucket: '17-20+', pattern: 'band',
    cue: 'Side steps + forward/back, keep band tension',
    desc: 'Band above the knees, tension never drops. Slow side steps to the right, then to the left, then small steps forward and back, knees pushed out against the band throughout. Steady pace, never rushed. One full circuit is one rep.' },
  { id: 'wall_sit', name: 'Wall sit', group: 'legs', measure: 'secs', bucket: null, pattern: 'hold',
    cue: 'Knees at 90°, back flat on wall',
    desc: 'Back flat against the wall. Slide down until the thighs are parallel and the knees sit at 90° directly above the ankles. Hands off the legs, breathe continuously, never hold the breath. Best done FRESH on non-leg days, several two-minute holds; start shallower and progress the angle over weeks. Logged in seconds.' },
  { id: 'slider_leg_curl', name: 'Slider leg curl', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'bridge',
    cue: 'Bridge up, curl the heels in, hips stay high',
    desc: 'On your back, heels on sliders, a towel on smooth floor, or a Swiss ball. Bridge the hips up and keep them up. Curl the heels toward the glutes for two seconds, then push them slowly back out over three seconds without the hips dropping. The best hamstring builder without a machine. Shorten the range before you let the hips sag.' },
  { id: 'seated_calf_raise', name: 'Seated calf raise', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'raise',
    cue: 'Knees bent 90°, weight on thighs, slow stretch',
    desc: 'Sit on a bench, balls of the feet on a plate or step, dumbbells resting on the thighs. With the knees bent at 90°, lower the heels for two seconds into a full stretch, pause, then rise onto the toes and squeeze one second. The bent knee shifts the work to the soleus, which sets your ankle mobility and squat depth.' },
  { id: 'spanish_squat', name: 'Spanish squat', group: 'legs', measure: 'secs', bucket: null, pattern: 'hold',
    cue: 'Band behind the knees, sit back, hold',
    desc: 'Loop a strong band behind the knees, anchored low in front of you. Lean back against it and sit into a squat with vertical shins, thighs near parallel. Hold, breathing steadily the whole time. High quad work in a knee-friendly position. Logged in seconds.' },
  { id: 'copenhagen_plank', name: 'Copenhagen plank', group: 'legs', measure: 'secs', bucket: null, pattern: 'hold',
    cue: 'Top leg on the bench, hips level, per side',
    desc: 'Lie on your side with the top foot resting on a bench at about knee height and the bottom leg hanging free beneath it. Push down through the top ankle and lift the hips until the body is one straight line from ankle to head, then hold, breathing normally. The adductor of the top leg is carrying most of your bodyweight, which is why this is the hardest short exercise in the library and why the inner thigh is the one large muscle nothing else here trains directly. Start SHORT-lever — top knee on the bench instead of the ankle, bottom leg tucked — and lengthen the lever over weeks, never by grinding out a shaking hold. Logged in seconds per side.' },
  { id: 'tibialis_raise', name: 'Tibialis raise', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'raise',
    cue: 'Heels down, weight over the toes, lift the forefoot',
    desc: 'Sit on a bench, heels on the floor slightly ahead of the knees, a plate or dumbbell hooked over the toes (a tib bar if the gym has one). Pull the forefoot up toward the shin as far as it goes in two seconds, squeeze one second at the top, then lower over three seconds until the toes touch down. The muscle down the front of the shin is what decelerates the foot on every step and landing, and on a long leg it is the bottom of the chain that stops everything above it oscillating. Expect it to cramp in the first sessions; that passes. Standing with the back against a wall and the heels walked forward is the same exercise without load.' },
  { id: 'loaded_single_leg_stand', name: 'Single-leg stand (loaded)', group: 'legs', measure: 'secs', bucket: null, pattern: 'hold',
    cue: 'One leg, heavy DB in the opposite hand, per side',
    desc: 'Stand on one leg with a heavy dumbbell in the OPPOSITE hand, free knee soft, eyes fixed on a point ahead. Stand tall and level and refuse to move: the foot makes constant small corrections underneath you and those corrections are the exercise. The opposite-side load also drags you sideways, so the hip and the trunk fight the tilt at the same time the foot fights the wobble. Progress by adding weight, then by closing the eyes — never by standing on a cushion or a wobble board, which makes the foot work less rather than more. Logged in seconds per side.' },
  // upper
  { id: 'pull_up', loadable: true, name: 'Pull-up', group: 'upper', measure: 'reps', bucket: '6-8', pattern: 'pull',
    cue: 'Full hang to chin over bar',
    desc: 'Dead hang, hands just wider than the shoulders, palms away. Pull the elbows down toward the ribs until the chin clears the bar, chest moving toward the bar, no swinging. Lower all the way to straight arms in two to three seconds; the slow lowering builds half the strength. The kg field = added weight (belt or DB between the feet); 0 = bodyweight.' },
  { id: 'weighted_pull_up', name: 'Weighted pull-up', group: 'upper', measure: 'reps', bucket: '6-8', pattern: 'pull',
    cue: 'Add belt/dumbbell, strict form',
    desc: 'A pull-up with load on a dip belt or a dumbbell between the feet. Same standard: dead hang to chin over bar, two-to-three-second lowering, no kip. As an anchor: bodyweight in round 1, add load from round 2. Log the added weight.' },
  { id: 'chin_up', loadable: true, name: 'Chin-up', group: 'upper', measure: 'reps', bucket: '6-8', pattern: 'pull',
    cue: 'Underhand grip, full range',
    desc: 'A pull-up with the palms toward you, hands shoulder-width. More biceps and usually a rep or two more than pull-ups. Same standard: full hang, chin over bar, slow lowering. The kg field = added weight; 0 = bodyweight.' },
  { id: 'db_bench_press', name: 'DB bench press', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'push',
    cue: 'Full range, elbows ~45°',
    desc: 'Flat on the bench, feet planted, shoulder blades pinched back and down. Lower the dumbbells for two to three seconds to chest level, elbows about 45° from the body. Press up and slightly together to straight arms. The slow lowering is what protects the shoulders.' },
  { id: 'bench_press', scheme: 'topset', barbell: true, name: 'Bench press', group: 'upper', measure: 'reps', bucket: '6-8', pattern: 'push',
    cue: 'Bar to chest, feet planted',
    desc: 'Feet planted, shoulder blades pinched, slight arch. Lower the bar under control, two to three seconds, to the lower chest. Touch lightly, no bounce, then press to lockout. Use a spotter or safety pins when the weight is heavy.' },
  { id: 'incline_db_press', name: 'Incline DB press', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'push',
    cue: 'Bench ~30°, press up and slightly back',
    desc: 'Bench at about 30°. Lower the dumbbells for two seconds to the upper chest, elbows 45°, then press up and slightly back so they finish over the collarbones. Squeeze at the top without banging the weights together.' },
  { id: 'push_up', loadable: true, name: 'Push-up', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'push',
    cue: 'Elbows to 90°, neutral back',
    desc: 'Hands under the shoulders (on dumbbells for straight wrists and extra depth). Body one rigid line: glutes and belly squeezed. Lower the chest for two seconds to a fist-height above the floor, elbows about 45°, then push the floor away to straight arms. The hips never sag and never pike.' },
  { id: 'push_up_plus', range: [10, 15], loadable: true, name: 'Push-up plus', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'push',
    cue: 'Push-up, then keep pushing at the top so the blades spread',
    desc: 'A normal push-up first: hands under the shoulders (on dumbbells for straight wrists and more depth), body one rigid line, chest down to a fist-height above the floor over two seconds, elbows about 45°. Then the part that matters. At the top, with the arms already locked straight, keep pushing the floor away so the shoulder blades slide apart around the ribcage and the upper back rounds slightly. Hold that end position one second, then let the blades settle back before the next rep. Those last few centimetres train the serratus anterior, the muscle that holds the shoulder blade flat against the ribs. The hips never sag and never pike. Feet elevated, or a weight vest, once 16 clean reps feel easy.' },
  { id: 'african_curl', name: 'African curl', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull',
    cue: 'Alternate: one curl palms up, next one hammer',
    desc: 'Standing, a dumbbell in each hand, elbows pinned to the ribs and staying there the whole set. Curl up with the palms facing up and squeeze at the top. Lower under control, rotating the palms to face each other on the way down, and curl straight back up in that neutral hammer position. Keep alternating — supinated, hammer, supinated — one curl is one rep. The hammer half loads the brachialis and brachioradialis, where visible arm thickness comes from. Elbows never drift forward and the shoulders never swing.' },
  { id: 'overhead_press', scheme: 'topset', barbell: true, name: 'Overhead press', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'press',
    cue: 'Press strict, ribs down',
    desc: 'Standing, weight at the shoulders. Squeeze the glutes, ribs down, then press strictly overhead until the arms lock and the biceps end up beside the ears. Move the head slightly back to let the bar pass, then push it through. Lower back to the shoulders in two seconds. No leg drive, no lean-back. The landmine press is the shoulder-friendly alternative: same press, a forward-angled path.' },
  { id: 'landmine_press', barbell: true, name: 'Landmine press', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'press',
    cue: 'Bar end in a corner, press up and forward, per side',
    desc: 'One end of the barbell wedged in a corner or landmine sleeve, the other end held at the shoulder in one hand, half-kneeling or standing in a staggered stance. Ribs down, glutes tight, press the bar up and forward until the arm is straight, then lower in two seconds. The angled path lets the shoulder blade move freely, which makes it the shoulder-friendly stand-in for the strict press. The kg field = plates on the bar end. Per side.' },
  { id: 'arnold_press', name: 'Arnold press', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'press',
    cue: 'Rotate palms through the press',
    desc: 'Start with the dumbbells at shoulder height, palms facing you. Press up while rotating the palms to face forward, finishing locked out overhead. Reverse the rotation slowly on the way down, three seconds. Light weight, constant tension, strict form.' },
  { id: 'bent_over_row', name: 'Bent-over row', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull',
    cue: 'Hinge, pull to lower ribs',
    desc: 'Hinge to about 45°, back flat, knees soft. Row the weight to the lower ribs leading with the elbows and squeeze the shoulder blades one second. Lower for two seconds without dropping the chest. If the lower back tires before the lats do, use the chest-supported row instead.' },
  { id: 'single_arm_row', name: 'Single-arm DB row', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull',
    cue: 'Knee on bench, per arm',
    desc: 'One knee and one hand on the bench, back flat and level like a table. Row the dumbbell to the hip in an arc, elbow close to the body. Squeeze one second at the top, lower for two seconds into a full stretch. Do not rotate the torso to lift more. Per arm.' },
  { id: 'chest_supported_row', range: [8, 10], name: 'Chest-supported DB row', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull',
    cue: 'Chest on incline bench, row both DBs',
    desc: 'Lie chest-down on an incline bench, dumbbells hanging. Row both to the hips, driving the elbows back, and squeeze the shoulder blades together for one second. Lower to a full stretch in two seconds. The bench removes the lower back completely, so there is no way to cheat.' },
  { id: 'tempo_curl', range: [8, 10], name: 'Tempo curl', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull',
    cue: '3 s up, 3 s down, light, elbows pinned',
    desc: 'Standing or seated, a light dumbbell in each hand, elbows pinned to the ribs. Curl up over a full three seconds, pause, lower over a full three seconds. Half the reps palms up, half hammer grip. The load stays light enough that every rep is slow and smooth. This is slow-tempo work, not a heavy arm exercise. One round done properly is the dose.' },
  { id: 'chin_up_negative', name: 'Chin-up negative', group: 'upper', measure: 'reps', bucket: '3-5', pattern: 'pull',
    cue: 'Jump to the top, 5 s down, step off',
    desc: 'Box or jump to the top of a chin-up (chin over the bar, palms facing you), then lower yourself over a full five seconds to straight arms and step off. No pulling up: the lowering is the whole exercise. Three reps, three sets. A step on the way to full pull-ups, after the inverted row feels easy.' },
  { id: 'band_assisted_pull_up', range: [4, 4], loadable: true, name: 'Band-assisted pull-up', group: 'upper', measure: 'reps', bucket: '6-8', pattern: 'pull',
    cue: 'Band under the feet, full range',
    desc: 'A long band looped over the bar and under one foot or knee takes part of your bodyweight at the bottom of the hang. Pull to chin over the bar, lower over three seconds, full range every rep. The last step before full pull-ups. Progress by a thinner band, not by more reps. The kg field logs the band level (0 = heaviest band).' },
  { id: 'inverted_row', range: [8, 10], loadable: true, name: 'Inverted row', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull',
    cue: 'Body under the bar, chest to the bar, heels down',
    desc: 'Set a barbell in a rack or rings at about hip height. Hang underneath with straight arms, body one rigid line from heels to head, glutes and belly squeezed. Pull until the chest touches the bar with the elbows driving back past the ribs, squeeze one second, then lower over three seconds to straight arms. It is a horizontal pull with the feet on the floor: no dead hang, and the trunk is braced the whole time. Progress by walking the feet further out, then by raising them onto a bench. The kg field = added weight on the chest; 0 = bodyweight.' },
  { id: 'shoulder_matrix', name: 'Shoulder matrix', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'raise',
    cue: 'Lateral + front raises, soft elbows',
    desc: 'Light dumbbells. Raise to the side to exactly shoulder height with soft elbows, lower slowly. Then straight into a front raise to shoulder height, lower slowly. One pair is one rep. If you have to swing, the weight is too heavy.' },
  { id: 'lateral_raise', name: 'Lateral raise', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'raise',
    cue: 'To shoulder height, no swing',
    desc: 'Dumbbells at the sides, elbows slightly bent. Raise out to shoulder height and no higher, leading with the elbows as if pouring water from a jug. Pause a beat, then lower for three seconds. The slow lowering IS the exercise. Keep it light and strict.' },
  { id: 'dips', loadable: true, name: 'Dips', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'push',
    cue: 'Elbows to 90°, lean slightly forward',
    desc: 'On the bars, shoulders pressed down away from the ears. Lean slightly forward, lower for two seconds until the elbows reach 90° (upper arms parallel to the floor), then press back to straight arms. Parallel is the depth standard; go no deeper. The kg field = added weight; 0 = bodyweight.' },
  { id: 'weighted_dip', name: 'Weighted dip', group: 'upper', measure: 'reps', bucket: '6-8', pattern: 'push',
    cue: 'Add weight, elbows to 90° — never deeper',
    desc: 'Dips with a belt or a dumbbell between the feet. The depth standard is unchanged and it is the whole point: lower until the upper arms are parallel to the floor and STOP, two-second lowering, full lockout at the top. Progress this lift by adding weight, never by sinking lower. Log the added weight.' },
  { id: 'face_pull', range: [15, 15], name: 'Band face pull', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'pull',
    cue: 'Band to face, elbows high',
    desc: 'Band anchored at face height: door anchor or the pull-up bar. Pull toward the bridge of the nose with the elbows high and wide, finishing with the hands beside the ears and the upper back squeezed for one second. Return in three seconds and let the shoulder blades slide apart. Tall posture; if the head pokes forward, take a lighter band.' },
  // core
  { id: 'ab_rollout', name: 'Ab rollout', group: 'core', measure: 'reps', bucket: '9-12', pattern: 'core',
    cue: 'Roll out slow, no sag',
    desc: 'Kneel with the wheel or loaded bar under the shoulders. Brace the belly as if about to take a punch and tuck the tailbone. Roll out slowly, three seconds, only as far as the hips stay perfectly level. Pull back with the abs, not the arms. Shorten the range before you ever let the lower back arch.' },
  { id: 'hanging_knee_raise', name: 'Hanging knee raise', group: 'core', measure: 'reps', bucket: '9-12', pattern: 'core',
    cue: 'Knees to chest, no swing',
    desc: 'Hang from the bar with active shoulders. Curl the knees up to the chest and tilt the pelvis at the very top; that tilt is where the abs actually work. Lower for three seconds to a dead stop. No swinging between reps. Straight legs to progress.' },
  { id: 'plank_to_pike', name: 'Plank to pike', group: 'core', measure: 'reps', bucket: '9-12', pattern: 'core',
    cue: 'Forearms down, hips up and back',
    desc: 'Forearm plank, body one line. Push the hips up and back into a pike, an upside-down V, hold one beat, then return to a tight plank without any sag. Slow and controlled in both directions.' },
  { id: 'pallof_press', name: 'Pallof press', group: 'core', measure: 'reps', bucket: '13-16', pattern: 'core',
    cue: 'Resist rotation, per side',
    desc: 'Band or cable at chest height, stand side-on, feet hip-width. Hold the handle at the sternum, press it straight out and hold two seconds. The pull tries to twist you; your job is not to move at all. Return under control. Per side.' },
  { id: 'v_up', name: 'V-up', group: 'core', measure: 'reps', bucket: '13-16', pattern: 'core',
    cue: 'Hands to feet, control down',
    desc: 'Lie flat, arms overhead. In one motion lift straight legs and torso, reaching the hands to the feet at the top. Lower BOTH halves slowly, three seconds, stopping just above the floor. Dead bugs are the easier alternative.' },
  { id: 'dead_bug', name: 'Dead bug', group: 'core', measure: 'reps', bucket: '9-12', pattern: 'core',
    cue: 'Lower back pressed to floor, opposite arm + leg',
    desc: 'On your back, arms straight up, knees bent 90° over the hips. Press the lower back into the floor and keep it there for the whole set; that is the entire exercise. Lower one arm and the opposite leg toward the floor over three seconds, stopping the moment the back starts to lift. Exhale as the limbs lower, return, switch. Per side.' },
  { id: 'bird_dog', name: 'Bird dog', group: 'core', measure: 'reps', bucket: '9-12', pattern: 'core',
    cue: 'On all fours, opposite arm + leg, no wobble',
    desc: 'On hands and knees, back level. Reach one arm long and the opposite leg back until both are level with the torso. Hips stay square; nothing wobbles or tilts. Hold ten seconds while breathing normally, then sweep elbow and knee together under the body and reach out again. Long, perfectly still holds are the point. Per side.' },
  { id: 'mcgill_curl_up', name: 'McGill curl-up', group: 'core', measure: 'reps', bucket: '9-12', pattern: 'core',
    cue: 'Hands under lower back, lift head + shoulders only',
    desc: 'On your back: one knee bent, one leg straight, hands under the natural arch of the lower back. Lift only the head and shoulders a few centimetres; the spine does not bend, the abs simply switch on hard. Hold ten seconds, breathing normally, then lower slowly. Swap the bent leg halfway through the set.' },
  { id: 'mountain_climbers', name: 'Mountain climbers', group: 'core', measure: 'secs', bucket: null, pattern: 'core',
    cue: 'Fast knees, flat back',
    desc: 'High plank, hands under the shoulders, hips level with the shoulders. Drive the knees toward the chest alternately, as fast as clean form allows. The hips stay down; the moment they start bouncing, slow down. Logged in seconds.' },
  { id: 'bear_crawl', name: 'Bear crawl', group: 'core', measure: 'secs', bucket: null, pattern: 'core',
    cue: 'Knees an inch off the floor',
    desc: 'On hands and toes, knees bent one inch off the floor, back flat like a tabletop. Crawl forward with opposite hand and foot moving together, small steps, hips level. Crawl backward the same way. Logged in seconds.' },
  // mixed / plyo / full-body
  { id: 'box_jump', name: 'Box jump', group: 'mixed', measure: 'reps', bucket: '6-8', pattern: 'jump',
    cue: 'Explode up, step down',
    desc: 'Stand one short step from the box. Dip into a quarter squat, throw the arms, and jump explosively. Land SOFTLY on the box: both feet flat, knees bent, quiet landing. Stand fully tall on top, then STEP down; never jump down. Full reset and pause before every rep, so each jump starts from a dead stop.' },
  { id: 'broad_jump', name: 'Broad jump', group: 'mixed', measure: 'reps', bucket: '6-8', pattern: 'jump',
    cue: 'Stick the landing, walk back',
    desc: 'Dip, swing the arms back, then jump forward as far as you can. Stick the landing in a quarter squat and hold it one second; a clean landing counts for more than distance. Walk back, reset completely, jump again.' },
  { id: 'kb_swing', name: 'Kettlebell swing', group: 'mixed', measure: 'reps', bucket: '13-16', pattern: 'swing',
    cue: 'Hips drive, arms relaxed',
    desc: 'Hinge, never squat. Hike the kettlebell back high between the legs, then SNAP the hips forward hard so the bell floats to chest height on straight-ish arms. Squeeze the glutes at the top, belly braced; the arms only steer. Let it swing straight back into the next hike. The power is one hundred percent hips.' },
  { id: 'kb_clean_press', name: 'KB clean & press', group: 'mixed', measure: 'reps', bucket: '9-12', pattern: 'swing',
    cue: 'Clean to rack, press strict, per arm',
    desc: 'Swing the kettlebell up so it lands softly in the rack at the shoulder; it should roll around the wrist, not bang it. Pause one beat, then press strictly overhead to lockout. Lower to the shoulder, then back into the swing. Per arm.' },
  { id: 'thruster', name: 'Thruster', group: 'mixed', measure: 'reps', bucket: '9-12', pattern: 'press',
    cue: 'Squat into overhead press, one motion',
    desc: 'Dumbbells at the shoulders. Squat to parallel with the chest up, then drive up fast and let that momentum carry the weights straight overhead in one continuous motion, finishing with biceps by the ears. Lower to the shoulders with control as you sink into the next squat. Big movement, big heart rate.' },
  { id: 'db_snatch', name: 'DB snatch', group: 'mixed', measure: 'reps', bucket: '9-12', pattern: 'swing',
    cue: 'Floor to overhead, per arm',
    desc: 'One dumbbell on the floor between the feet. Hinge, grip, then jump the weight upward in one explosive pull, punching it out to a straight arm overhead with no pause at the shoulder. Stand fully tall, then lower it in two steps: to the shoulder, then to the floor. Per arm.' },
  { id: 'devil_press', name: 'Devil press', group: 'mixed', measure: 'reps', bucket: '9-12', pattern: 'jump',
    cue: 'Burpee + double-DB snatch',
    desc: 'Two dumbbells. Burpee down with the hands on the bells, chest to the floor, jump the feet back in, then swing both dumbbells between the legs and up overhead in one motion. Finish locked out and tall. Brutal by design; pick a pace you can hold for the whole set.' },
  { id: 'prone_y_raise', name: 'Prone Y raise (Blackburn)', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'raise', snack: true,
    cue: 'Face down, thumbs up, arms to a Y',
    desc: 'Face down on the floor or a bench, forehead resting, arms hanging with the thumbs pointing up. Lift both arms up and out into a Y, in line with the ears, taking two seconds. Hold one second at the top: the squeeze belongs low between the shoulder blades. Lower in three seconds. Start with no weight at all; 1 to 2 kg is plenty later. If the shoulders rise toward the ears, the weight is too heavy.' },
  { id: 'wall_slide_band', name: 'Wall slide (band)', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'press', snack: true,
    cue: 'Forearms on the wall, push out, slide up',
    desc: 'Stand facing a wall, forearms flat on it, a light loop band around both wrists. Press the forearms into the wall and out against the band, and keep pressing throughout. Slide the arms slowly up the wall over three seconds as far as they go without the shoulders shrugging, then lower over three seconds. The push into the wall is the serratus working. If the shoulders climb toward the ears, stop the slide lower.' },
  { id: 'serratus_punch_band', name: 'Serratus punch (band)', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'push', snack: true,
    cue: 'Band behind the back, punch and reach',
    desc: 'Band anchored behind you at chest height, or looped around the upper back, arms straight out in front. Without bending the elbows, punch forward by pushing the shoulder blades apart and reaching the knuckles away from you. Hold the end position two seconds, then let the blades slide back together over three seconds. Only the shoulder blades move; the elbows stay locked and the torso stays still. If you find yourself leaning back or bending the arms to get more range, the band is too strong.' },
  { id: 'band_external_rotation', name: 'Band external rotation', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'band', snack: true,
    cue: 'Elbow pinned at the side, rotate out',
    desc: 'Band anchored at elbow height, standing side-on, working arm nearest the anchor. Tuck a towel between the elbow and the ribs and keep it there. Rotate the forearm outward over two seconds until it points straight ahead, squeeze one second, then return over three seconds. The elbow never leaves the side and the torso never twists. Light band; this is a cuff drill, not a strength lift.' },
  { id: 'banded_scaption', name: 'Banded scaption', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'raise', snack: true,
    cue: 'Thumbs up, raise at 30 degrees, go high',
    desc: 'Stand on a light band, arms at the sides, thumbs up. Raise both arms about thirty degrees forward of straight out to the side, taking three seconds, up past shoulder height toward overhead as far as the movement stays smooth. Pause one second, lower over three seconds. Add height and band tension gradually, and never speed up to force the last few reps.' },
  { id: 'straight_arm_band_pulldown', name: 'Straight-arm band pulldown', group: 'upper', measure: 'reps', bucket: '17-20+', pattern: 'pull', snack: true,
    cue: 'Arms straight overhead, pull to the thighs',
    desc: 'Band anchored high, standing tall, arms straight overhead holding the band. Keeping the elbows completely straight, pull the hands down in an arc to the thighs over two seconds. Squeeze hard for two seconds at the bottom, where the lat pulls the shoulder down and back. Return overhead slowly over three seconds. The elbows never bend, which is the whole point: the biceps cannot help.' },
  { id: 'supported_scap_shrug', name: 'Supported scapular shrug', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull', snack: true,
    cue: 'Hang with feet down, pull the shoulders away from the ears',
    desc: 'Hold the pull-up bar with the feet on the floor or a box, taking as much of your weight as you need. Let the shoulders rise toward the ears, then without bending the elbows pull them back down and the chest slightly up, taking two seconds. Hold one second, feeling it between the shoulder blades and never in the neck. Lower over three seconds. Progress by letting the feet carry less weight, not by adding load.' },
  { id: 'active_hang', name: 'Active hang', group: 'upper', measure: 'secs', bucket: null, pattern: 'hold', snack: true,
    cue: 'Feet off, shoulders pulled down the whole time',
    desc: 'Hang from the bar with the feet off the floor and the arms straight, then pull the shoulders down away from the ears and hold them there for the whole set. The body should feel carried by the back, not dangling from the joints. Stop the set the moment the shoulders creep back up toward the ears. Build toward three sets of fifteen to twenty seconds before adding a band-assisted pull-up.' },
  { id: 'burpee', name: 'Burpee', group: 'mixed', measure: 'reps', bucket: '9-12', pattern: 'jump',
    cue: 'Chest to floor, jump at top',
    desc: 'Hands to the floor, jump or step the feet back, chest touches the floor. Push up fast, jump the feet back in under the hips, then stand and finish with a small jump and the hips fully open at the top. A smooth, quick rhythm beats frantic speed.' },

  { id: 'incline_triceps_ext', range: [8, 12], name: 'Incline triceps extension', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'press',
    cue: 'Upper arms frozen, stretch behind the head',
    desc: 'Lie back on a low incline (15\u201330\u00b0), a dumbbell in each hand pressed over the chest, upper arms angled slightly back toward the head. Keep the upper arms frozen: bend only the elbows and lower the weights behind the head for three seconds until you feel a clear stretch in the triceps. Press back to straight arms and squeeze the triceps for one second. If the upper arms drift forward, the tension leaves the muscle.' },
  { id: 'incline_db_fly', name: 'Incline dumbbell fly', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'push',
    cue: 'Soft elbows, hug a barrel',
    desc: 'On an incline bench (30\u201345\u00b0), dumbbells over the upper chest, palms facing each other, elbows fixed at a slight bend. Open the arms out in three seconds until you feel the stretch across the chest, and no deeper. Sweep back up in a wide arc, as if hugging a barrel, and squeeze the upper chest for one second at the top. Aching shoulders mean the arc is too deep or the elbows too straight.' },
  { id: 'chest_supported_y_raise', name: 'Y raise (chest-supported)', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'raise',
    cue: 'Thumbs up, arms to the ears, no shrug',
    desc: 'Chest down on an incline bench, light dumbbells hanging, thumbs pointing up. Raise the arms up and forward into a Y in two seconds until they line up with the ears. Hold one second at the top: the squeeze belongs low between the shoulder blades, never in the neck. Lower in three seconds. Go lighter than feels serious; the moment you swing, the weight is too heavy.' },
  { id: 'plyo_push_up', name: 'Plyo push-up', group: 'mixed', measure: 'reps', bucket: '6-8', pattern: 'push',
    cue: 'Hands leave the floor, land soft',
    desc: 'Push-up position, hands under the shoulders, body one rigid line. Lower with control, then drive up so explosively that the hands leave the floor. Land on soft elbows and sink straight into the next rep. Stop the set the moment the hands stop leaving the floor: slow reps defeat the point of this exercise. Hands on a bench is the easier version; build there first.' },
  { id: 'nordic_curl', range: [6, 8], name: 'Nordic curl', group: 'legs', measure: 'reps', bucket: '3-5', pattern: 'bridge',
    cue: 'Hips straight, fall slowly, catch with hands',
    desc: 'Kneel on a pad, ankles locked under a bench or a loaded bar. From tall knees with the hips fully straight, lower the whole body forward as slowly as you can: fight for five seconds or more, hands ready to catch at the bottom. Push off the floor lightly and pull back up with the hamstrings as much as they allow. Folding at the hips is the rep gone wrong. Three slow reps beat ten fast falls.' },
  { id: 'skull_crusher', name: 'Skull crusher', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'press',
    cue: 'Elbows still, lower past the forehead',
    desc: 'Lie on a flat bench, dumbbells or an EZ bar pressed above the chest, arms vertical. Keep the upper arms frozen: bend the elbows and lower the weight toward the forehead, or just past it toward the bench, for three seconds. Press back to straight arms and squeeze the triceps for one second. If the elbows ache, aim the weight slightly behind the head and drop the load a step.' },
  { id: 'zottman_curl', name: 'Zottman curl', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull',
    cue: 'Curl palms up, lower palms down',
    desc: 'Standing, dumbbells at the sides, palms forward. Curl up in two seconds and squeeze at the top. There, rotate the palms to face down and lower in four seconds; the slow palms-down descent is the whole point of this exercise. Rotate back at the bottom and repeat. Elbows stay pinned to the ribs; no swinging from the hips.' },
  { id: 'sissy_squat', name: 'Sissy squat', group: 'legs', measure: 'reps', bucket: '6-8', pattern: 'squat',
    cue: 'Knees forward, torso back, shallow first',
    desc: 'Hold an upright (rack or door frame) with one hand and rise onto the balls of the feet. Bend the knees and drive them forward while the torso leans back, keeping one straight line from knees to shoulders. Lower for three seconds, pause one second, and return by squeezing the quads. This is a demanding quad exercise: start shallow and add depth over weeks.' },
  { id: 'squat_jump', name: 'Squat jump', group: 'mixed', measure: 'reps', bucket: '6-8', pattern: 'jump',
    cue: 'Sit, explode up, land quiet',
    desc: 'Feet shoulder-width, no weight needed. Sit into a half squat for two seconds, arms swung back, then jump straight up as high as you can with the arms driving. Land softly back in the half squat, heels touching down quietly. Pause and fully reset before the next rep: every jump starts from a dead stop, never from a bounce.' },
  { id: 'weighted_glute_kickback', name: 'Glute kickback (weighted)', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'bridge',
    cue: 'Heel to ceiling, squeeze two seconds',
    desc: 'On all fours, a dumbbell folded into the crease behind one knee, or a band around the foot. Keep the knee bent at 90\u00b0 and drive the heel toward the ceiling in two seconds, until the thigh lines up with the torso and no higher; past that, the lower back takes over. Squeeze the glute hard for two seconds at the top, then lower in three seconds without the knee touching down. All reps on one side, then switch. The back stays flat; only the hip moves.' },  { id: 'sprawl', name: 'Sprawl', group: 'mixed', measure: 'reps', bucket: '13-16', pattern: 'core',
    cue: 'Burpee without push-up or jump',
    desc: 'The fast burpee: hands down, shoot the legs back to a plank, snap them back in, stand tall. No push-up and no jump; that is exactly what keeps the pace high. The chest stays over the hands.' },
  { id: 'box_jump_over', name: 'Box jump-over', group: 'mixed', measure: 'reps', bucket: '9-12', pattern: 'jump',
    cue: 'Jump on, step over and down',
    desc: 'Jump explosively onto the box and land soft. Step over the far edge and down with control, turn around, repeat the other way. One crossing is one rep. Always step down from the top, never jump.' },
  { id: 'walking_lunge', name: 'Walking lunge', group: 'mixed', measure: 'reps', bucket: '13-16', pattern: 'lunge',
    cue: 'Long steps, torso tall, total steps',
    desc: 'Lunge forward until the back knee kisses the floor, then push through the front heel and step STRAIGHT through into the next lunge with no pause between reps. Torso tall, steps long. Count total steps.' },
  { id: 'renegade_row', name: 'Renegade row', group: 'mixed', measure: 'reps', bucket: '9-12', pattern: 'pull',
    cue: 'Plank on DBs, row without twisting',
    desc: 'High plank with the hands on two dumbbells, feet set wide. Row one bell to the hip while the rest of the body stays dead still: hips level, zero twist. The plank is the real exercise. Lower with control, then alternate arms. Slow rows beat fast wobbly ones.' },
  { id: 'farmers_carry', name: "Farmer's carry", group: 'mixed', measure: 'secs', bucket: null, pattern: 'carry',
    cue: 'Heavy DBs, tall posture',
    desc: 'Pick up the heaviest dumbbells you can hold with good posture: stand tall, shoulders back and down, ribs stacked over hips. Walk with short quick steps, eyes forward. The moment posture cracks, set them down; the set is over. Logged in seconds.' },
  { id: 'trap_bar_carry', range: [30, 30], name: 'Trap-bar carry', group: 'mixed', measure: 'secs', bucket: null, pattern: 'carry',
    cue: 'The loaded trap bar, walk tall, short steps',
    desc: 'Stand inside the trap bar with the plates already on it from the deadlift, high handles, straps on. Stand up as for the deadlift, then walk with short quick steps, eyes forward, ribs stacked over hips. The bar sits centred so there is no forward lean and no side load; the whole job is posture and grip under 60+ kg. Set it down the moment posture cracks. This is the heavy D slot on Legs 2 on purpose: the dumbbells cap at 24 kg, the bar does not. Logged in seconds.' },
  { id: 'suitcase_carry', name: 'Suitcase carry', group: 'mixed', measure: 'secs', bucket: null, pattern: 'carry',
    cue: 'One-sided carry, stay level, per side',
    desc: 'One heavy dumbbell on one side. Walk tall and perfectly level with no lean to either side; the core fights the tilt the entire time. Shoulders square, free arm relaxed. Swap sides halfway. Logged in seconds per side.' },
  // v39 additions
  { id: 'db_overhead_press', range: [6, 8], name: 'DB overhead press', group: 'upper', measure: 'reps', bucket: '6-8', pattern: 'press',
    cue: 'Neutral grip, press strict, ribs down',
    desc: 'Seated or standing, a dumbbell at each shoulder with the palms facing each other. Squeeze the glutes and keep the ribs down. Press both dumbbells straight up until the arms lock, with the biceps beside the ears. Lower to the shoulders over two seconds. The neutral grip is the shoulder-friendly path. There is no leg drive and no lean back.' },
  { id: 'body_saw', name: 'Body saw', group: 'core', measure: 'reps', bucket: '9-12', pattern: 'core',
    cue: 'Forearm plank, feet on sliders, rock back and forward',
    desc: 'Set up in a forearm plank with the feet on sliders or a towel on a smooth floor. Squeeze the glutes and brace the belly so the body is one straight line. Push the body back through the forearms until the shoulders sit behind the elbows, then pull forward again. The hips stay level the whole time. A longer reach back makes it harder. Stop the set before the hips sag.' },
  { id: 'band_curl', name: 'Band curl', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'pull', travel: true,
    cue: 'Stand on the band, elbows pinned, slow both ways',
    desc: 'Stand on the long band with a handle in each hand and the elbows pinned to the ribs. Curl up over three seconds, pause, and lower over three seconds. The band pulls hardest at the top, so the lowering needs the most control. The elbows stay where they are and the shoulders stay still.' },
  { id: 'band_triceps_pushdown', name: 'Band triceps pushdown', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'press', travel: true,
    cue: 'Anchor high, elbows pinned, press to straight arms',
    desc: 'Anchor the long band over the top of the door. Stand tall facing it, elbows pinned to the ribs and bent at ninety degrees. Press the hands down until the arms are straight and squeeze the triceps for one second. Return over three seconds. Only the forearms move.' },
  // travel: band + bodyweight library (1 long band with door anchor + 1 loop band)
  { id: 'band_squat', name: 'Band squat', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'squat', travel: true,
    cue: 'Stand on the band, handles at shoulders',
    desc: 'Stand on the long band, feet shoulder-width, a handle at each shoulder. Squat down for two seconds until the thighs are parallel, chest up, then drive up against the band and squeeze the glutes at the top. Log band level instead of kg.' },
  { id: 'split_squat', name: 'Split squat', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'lunge',
    cue: 'Static lunge stance, per leg',
    desc: 'A static lunge: one foot forward, one behind, feet hip-width apart for balance. Lower straight down for two seconds until the back knee nearly touches the floor, then drive up through the front heel. The feet never move; that is what makes it different from a lunge. Rear foot on a chair turns it Bulgarian. Per leg.' },
  { id: 'band_rdl', name: 'Band RDL', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'hinge', travel: true,
    cue: 'Stand on band, hinge against it',
    desc: 'Stand on the long band, handles at the thighs. Push the hips straight back with a flat back, lowering the hands along the legs until the hamstrings pull. Then stand tall against the band and squeeze the glutes. Slow on the way down, strong on the way up.' },
  { id: 'glute_bridge', name: 'Glute bridge', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'bridge',
    cue: 'Shoulders on floor, squeeze at top',
    desc: 'On your back, knees bent, feet flat under the knees. Drive through the heels and lift the hips until the body is straight from knees to shoulders. Squeeze the glutes hard for two seconds at the top; do not push the lower back into an arch. Lower with control. Loop band above the knees for more.' },
  { id: 'single_leg_glute_bridge', name: 'Single-leg glute bridge', group: 'legs', measure: 'reps', bucket: '9-12', pattern: 'bridge',
    cue: 'One foot down, per leg',
    desc: 'A glute bridge on one foot, the other leg held straight and in line with the body. The hips must stay level; if one side drops, slow down. Hold the two-second squeeze at the top. Per leg.' },
  { id: 'band_row', name: 'Band row', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'pull', travel: true,
    cue: 'Anchor at chest height, squeeze blades',
    desc: 'Long band anchored at chest height in the door, or around the feet if seated. Sit or stand tall, row the handles to the lower ribs, squeeze the shoulder blades one second, then return in two seconds keeping tension the whole way. Chest stays proud.' },
  { id: 'band_pulldown', name: 'Band pulldown', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'pull', travel: true,
    cue: 'Anchor high, pull to chest',
    desc: 'Long band anchored over the top of the door. Kneel, arms up, chest proud. Pull the handles down to the collarbones by driving the elbows to the ribs. Squeeze one second, release slowly over three seconds. The hotel pull-up.' },
  { id: 'band_pull_apart', name: 'Band pull-apart', group: 'upper', measure: 'reps', bucket: '17-20+', pattern: 'pull', travel: true,
    cue: 'Arms straight, band to chest',
    desc: 'Hold the band at shoulder height, arms straight, hands shoulder-width. Pull it apart until it touches the chest, squeezing the shoulder blades together for one second. Return in two seconds; never let it snap back. Small movement, big posture payoff.' },
  { id: 'band_chest_press', name: 'Band chest press', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'push', travel: true,
    cue: 'Band around the back, press forward',
    desc: 'Long band across the upper back, a handle in each hand, split stance. Press forward to straight arms, squeeze one second, return in two seconds. The band pulls hardest at lockout, so the return needs the most control.' },
  { id: 'chair_dip', name: 'Chair dip', group: 'upper', measure: 'reps', bucket: '9-12', pattern: 'push', travel: true,
    cue: 'Hands on chair edge, elbows to 90°',
    desc: 'Hands on the front edge of a solid chair, fingers forward, legs out. Lower the hips for two seconds until the elbows reach 90°, back staying close to the chair, then press up to straight arms. Shoulders stay down away from the ears. Bend the knees to make it easier.' },
  { id: 'band_overhead_press', name: 'Band overhead press', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'press', travel: true,
    cue: 'Stand on band, press strict',
    desc: 'Stand on the long band, handles at the shoulders. Ribs down, glutes tight. Press straight up to locked arms, then resist the band back down for two to three seconds.' },
  { id: 'band_lateral_raise', name: 'Band lateral raise', group: 'upper', measure: 'reps', bucket: '13-16', pattern: 'raise', travel: true,
    cue: 'Stand on band, raise to shoulder height',
    desc: 'Stand on the band, handles at the sides, elbows slightly bent. Raise out to shoulder height, pause, then lower against the band for three seconds. That slow lowering is the point.' },
  { id: 'band_thruster', name: 'Band thruster', group: 'mixed', measure: 'reps', bucket: '13-16', pattern: 'press', travel: true,
    cue: 'Squat into overhead press, one motion',
    desc: 'Stand on the long band, handles at the shoulders. Squat to parallel, then drive up fast and press overhead in one continuous motion, locking out against the band. Control the slow return to the shoulders as you sink into the next rep.' },
  { id: 'walkout', name: 'Walkout', group: 'core', measure: 'reps', bucket: '9-12', pattern: 'core',
    cue: 'Hands walk out to plank, no sag',
    desc: 'From standing, hinge and place the hands on the floor. Walk them out to a long plank, hips level and belly braced, pause one second, then walk back and stand tall. Reach a hand-length further as you get stronger, but always stop short of any hip sag.' },
  { id: 'plank_hold', name: 'Plank hold', group: 'core', measure: 'secs', bucket: null, pattern: 'hold',
    cue: 'One straight line, braced',
    desc: 'Forearms down, elbows under the shoulders. Squeeze the glutes and belly so the body forms one rigid line from heels to head. No sag, no pike. When the line breaks, the set is over; only quality seconds count. Logged in seconds.' },
  { id: 'side_plank', name: 'Side plank', group: 'core', measure: 'secs', bucket: null, pattern: 'hold',
    cue: 'Hips high, per side',
    desc: 'On one forearm, elbow under the shoulder, feet stacked. Lift the hips until the body is one straight line, then push them slightly up and forward and hold, breathing normally. Several short perfect holds beat one long shaky one. Logged in seconds per side.' },
  { id: 'side_lying_adduction', name: 'Side-lying adduction', group: 'legs', measure: 'secs', bucket: null, pattern: 'hold', travel: true,
    cue: 'Bottom leg lifted and held, per side',
    desc: 'Lie on your side on the floor, top leg bent with its foot planted in front of you, bottom leg straight. Lift the bottom leg as high as it goes and hold it there, breathing normally — the inner thigh is the only thing keeping it up. Hips stay stacked; rolling backward makes it easy and pointless. The floor version of the Copenhagen, no bench required. Logged in seconds per side.' },
  { id: 'wall_tibialis_raise', name: 'Wall tibialis raise', group: 'legs', measure: 'reps', bucket: '13-16', pattern: 'raise', travel: true,
    cue: 'Back on the wall, heels walked out, lift the toes',
    desc: 'Stand with the back and hips flat against a wall and walk the heels out about a foot-length. Heels stay down. Pull the toes up toward the shins as high as they will go in two seconds, hold one second, lower over three seconds. Walk the feet further from the wall to make it harder: with no weight in the room, the leverage is the load.' },
  { id: 'single_leg_stand', name: 'Single-leg stand', group: 'legs', measure: 'secs', bucket: null, pattern: 'hold', travel: true,
    cue: 'One leg, no load, close the eyes to progress',
    desc: 'Stand on one leg, free knee soft, arms relaxed, standing tall, and hold still while the foot makes its constant small corrections. With no dumbbell to hand the progression is the eyes: hold them open first, then close them. That removes the sense doing most of the balancing and hands the job back to the foot and the hip, which is the whole point. Logged in seconds per side.' },
];

/* Travel mode: gym exercise -> band/bodyweight substitute (same movement pattern).
   Exercises not listed are already hotel-compatible and stay as they are. */
const TRAVEL_SUBS = {
  box_squat: 'band_squat', paused_box_squat: 'band_squat', goblet_squat: 'band_squat',
  trap_bar_deadlift: 'band_rdl',
  deficit_reverse_lunge: 'reverse_lunge', bulgarian_split_squat: 'split_squat',
  box_step_up: 'walking_lunge', lateral_box_step: 'lateral_lunge',
  romanian_deadlift: 'band_rdl',
  hip_thrust: 'glute_bridge', single_leg_hip_thrust: 'single_leg_glute_bridge',
  copenhagen_plank: 'side_lying_adduction', tibialis_raise: 'wall_tibialis_raise',
  loaded_single_leg_stand: 'single_leg_stand',
  pull_up: 'band_pulldown', weighted_pull_up: 'band_pulldown', chin_up: 'band_pulldown',
  bent_over_row: 'band_row', single_arm_row: 'band_row', renegade_row: 'band_row', chest_supported_row: 'band_row',
  inverted_row: 'band_row',
  face_pull: 'band_pull_apart',
  db_bench_press: 'push_up', bench_press: 'push_up', incline_db_press: 'push_up',
  incline_db_fly: 'band_chest_press',
  dips: 'chair_dip', weighted_dip: 'chair_dip',
  overhead_press: 'band_overhead_press', arnold_press: 'band_overhead_press', landmine_press: 'band_overhead_press',
  chin_up_negative: 'band_pulldown', band_assisted_pull_up: 'band_pulldown',
  trap_bar_carry: 'plank_hold',
  shoulder_matrix: 'band_lateral_raise', lateral_raise: 'band_lateral_raise',
  ab_rollout: 'walkout', hanging_knee_raise: 'v_up',
  box_jump: 'jump_squat', broad_jump: 'jump_squat', box_jump_over: 'sprawl',
  kb_swing: 'jump_squat', kb_clean_press: 'band_thruster', thruster: 'band_thruster', db_snatch: 'band_thruster',
  devil_press: 'burpee',
  farmers_carry: 'plank_hold', suitcase_carry: 'side_plank',
  seated_calf_raise: 'calf_raise',
  // v39
  nordic_curl: 'slider_leg_curl', tempo_curl: 'band_curl', incline_triceps_ext: 'band_triceps_pushdown',
  db_overhead_press: 'band_overhead_press', body_saw: 'walkout', spanish_squat: 'wall_sit',
};

/* Which implement each lift is loaded with. It drives the weight control:
   barbell and trap bar step through the loads the plates can build, dumbbell
   and kettlebell pick from the rack, band logs a band level. Anything not
   listed is bodyweight, where the kg field is added load. */
const IMPLEMENTS = {
  barbell: ['box_squat', 'paused_box_squat', 'hip_thrust', 'bench_press', 'overhead_press', 'landmine_press'],
  trap_bar: ['trap_bar_deadlift', 'trap_bar_carry'],
  dumbbell: ['reverse_lunge', 'deficit_reverse_lunge', 'goblet_squat', 'bulgarian_split_squat', 'lateral_lunge',
    'romanian_deadlift', 'single_leg_rdl', 'single_leg_hip_thrust', 'box_step_up', 'lateral_box_step', 'calf_raise',
    'seated_calf_raise', 'tibialis_raise', 'loaded_single_leg_stand', 'db_bench_press', 'incline_db_press',
    'arnold_press', 'bent_over_row', 'single_arm_row', 'chest_supported_row', 'tempo_curl', 'african_curl',
    'shoulder_matrix', 'lateral_raise', 'incline_triceps_ext', 'incline_db_fly', 'chest_supported_y_raise',
    'skull_crusher', 'zottman_curl', 'weighted_glute_kickback', 'thruster', 'db_snatch', 'devil_press',
    'walking_lunge', 'renegade_row', 'farmers_carry', 'suitcase_carry', 'prone_y_raise', 'db_overhead_press'],
  kettlebell: ['kb_swing', 'kb_clean_press'],
  band: ['band_lateral_walk', 'band_matrix', 'spanish_squat', 'face_pull', 'band_assisted_pull_up', 'pallof_press',
    'wall_slide_band', 'serratus_punch_band', 'band_external_rotation', 'banded_scaption',
    'straight_arm_band_pulldown', 'band_squat', 'band_rdl', 'band_row', 'band_pulldown', 'band_pull_apart',
    'band_chest_press', 'band_overhead_press', 'band_lateral_raise', 'band_thruster', 'band_curl',
    'band_triceps_pushdown'],
};
SEED_EXERCISES.forEach((e) => {
  e.implement = Object.keys(IMPLEMENTS).find((k) => IMPLEMENTS[k].includes(e.id)) || 'bodyweight';
});

const TRAVEL_CARDIO = ['Skipping', 'Shadow boxing', 'Burpees', 'High knees', 'Stair runs', 'Running'];
const ZONE2_MODALITIES = ['Bike', 'Brisk walk', 'Incline treadmill', 'Row', 'Stepper', 'Easy run'];
const TRAVEL_ZONE2 = ['Brisk walk', 'Stairs', 'Hotel bike'];
const TRAVEL_SPRINT_MODALITIES = ['Stair runs', 'Burpees', 'Shadow boxing', 'High knees'];

// Slot order = accumulator frequency: A done 5x per session, B 4x ... E 1x.
// A/B = anchor lifts. Weeks 1-3 (early) and 4-6 (late) blocks.
const SEED_BLOCKS = {
  early: {
    LEGS1:  ['bulgarian_split_squat', 'paused_box_squat', 'romanian_deadlift', 'hip_thrust', 'box_step_up'],
    UPPER1: ['chest_supported_row', 'bench_press', 'incline_db_press', 'dips', 'tempo_curl'],
    CORE:   ['suitcase_carry', 'ab_rollout', 'copenhagen_plank', 'spanish_squat', 'loaded_single_leg_stand'],
    LEGS2:  ['deficit_reverse_lunge', 'trap_bar_deadlift', 'nordic_curl', 'trap_bar_carry', 'seated_calf_raise'],
    UPPER2: ['inverted_row', 'overhead_press', 'push_up_plus', 'single_arm_row', 'face_pull'],
  },
  late: {
    LEGS1:  ['bulgarian_split_squat', 'paused_box_squat', 'romanian_deadlift', 'hip_thrust', 'box_step_up'],
    UPPER1: ['chest_supported_row', 'bench_press', 'incline_db_press', 'weighted_dip', 'tempo_curl'],
    CORE:   ['suitcase_carry', 'ab_rollout', 'copenhagen_plank', 'wall_sit', 'loaded_single_leg_stand'],
    LEGS2:  ['deficit_reverse_lunge', 'trap_bar_deadlift', 'nordic_curl', 'trap_bar_carry', 'seated_calf_raise'],
    UPPER2: ['inverted_row', 'overhead_press', 'band_assisted_pull_up', 'single_arm_row', 'face_pull'],
  },
};

const WEEK_PLAN = ['LEGS1', 'UPPER1', 'CORE', 'LEGS2', 'UPPER2', 'SPRINT', 'REST'];

/* ---------- Journey 3 (scheme 'v39') ----------
   The rep ladders are gone. Every slot has a prescription (engine.js:
   prescribe) and every round is computed from ONE work weight per lift.
   P1 carries the volume, P2 is the anchor (a top set of 5, or fast fives on
   the box squat), P3 to P5 run straight sets. Seven days, no rest day in the
   grid: Zone 2 and the Core circuit are real days of the week. */
const WEEK_PLAN_J3 = ['LEGS1', 'ZONE2', 'CORE', 'LEGS2', 'UPPER1', 'SPRINT', 'UPPER2'];

// the same five exercises in weeks 1-3 and 4-6; slot order = P1 to P5
const J3_BLOCKS = {
  LEGS1:  ['bulgarian_split_squat', 'paused_box_squat', 'romanian_deadlift', 'single_leg_hip_thrust', 'tempo_curl'],
  LEGS2:  ['deficit_reverse_lunge', 'trap_bar_deadlift', 'trap_bar_carry', 'nordic_curl', 'tempo_curl'],
  UPPER1: ['chest_supported_row', 'bench_press', 'incline_triceps_ext', 'db_overhead_press', 'face_pull'],
  UPPER2: ['inverted_row', 'overhead_press', 'push_up_plus', 'band_assisted_pull_up', 'face_pull'],
};

/* Work weight of each lift when a v39 journey starts. Barbell values include
   the bar; dumbbell values are one dumbbell with a count. */
const J3_START = {
  trap_bar_deadlift: 68, bench_press: 62.5, overhead_press: 35, paused_box_squat: 50,
  bulgarian_split_squat: { w: 12, count: 2 }, deficit_reverse_lunge: { w: 12, count: 2 },
  romanian_deadlift: { w: 16, count: 2 }, chest_supported_row: { w: 18, count: 2 },
  single_leg_hip_thrust: { w: 16, count: 1 }, db_overhead_press: { w: 12, count: 2 },
  tempo_curl: { w: 12, count: 2 }, incline_triceps_ext: { w: 8, count: 2 },
  trap_bar_carry: 68, suitcase_carry: { w: 24, count: 1 },
};

// the four lifts a v39 journey shows on its scoreboard: no targets, just the top set
const J3_SCOREBOARD = [
  { ex: 'trap_bar_deadlift' }, { ex: 'bench_press' }, { ex: 'overhead_press' }, { ex: 'bulgarian_split_squat' },
];

/* Core and stability day: a two-block circuit, not a pyramid. A station is a
   fixed exercise (`ex`) or a choice (`options`); `rounds` limits a station to
   some rounds of its block; `next` is the progression line under it. */
const CORE_CIRCUIT = [
  { name: 'Trunk and hips', rounds: 3, stations: [
    { ex: 'suitcase_carry', dose: '40 m each side', next: 'More distance, then a slower walk' },
    { options: ['body_saw', 'ab_rollout', 'dead_bug', 'pallof_press'], default: 'body_saw' },
    { ex: 'copenhagen_plank', secs: 30, sides: true, next: 'Up to 40 s, then the long lever' },
    { ex: 'loaded_single_leg_stand', secs: 30, sides: true, next: 'Eyes closed, then a heavier dumbbell' },
    { ex: 'spanish_squat', secs: 45, rounds: [1, 2], next: 'Longer hold' },
  ] },
  { name: 'Shoulder blades', rounds: 2, stations: [
    { options: ['supported_scap_shrug', 'active_hang'], default: 'supported_scap_shrug' },
    { ex: 'straight_arm_band_pulldown', reps: 12, next: 'Stronger band' },
    { ex: 'push_up_plus', reps: 10, next: 'Feet raised' },
    { ex: 'face_pull', reps: 15, next: 'Stronger band' },
  ] },
];

// starting dose of each option-station choice
const CIRCUIT_DOSES = {
  body_saw: { reps: 10, note: '8–10 slow reps' },
  ab_rollout: { reps: 10, note: '8–10 slow reps' },
  dead_bug: { reps: 8, note: '8 per side' },
  pallof_press: { reps: 10, note: '10 per side, 3-second hold' },
  supported_scap_shrug: { reps: 10, note: '10–12 reps' },
  active_hang: { secs: 15, note: '15–20 s' },
};

/* Recommended day templates for journeys before v39 — offered in
   Program → Days, never auto-applied. The rule behind them: slot A runs five
   times a session, so it holds the exercise you can accumulate the most
   volume on; the barbell anchor sits at B. Core has its own day, D/E are
   loaded slots, and a barbell press sits at B on both upper days. */
const RECOMMENDED_BLOCKS = {
  LEGS1: {
    title: 'Squat-led · hip thrust returns',
    early: {
      slots: ['bulgarian_split_squat', 'paused_box_squat', 'romanian_deadlift', 'hip_thrust', 'box_step_up'],
      why: [
        'A · Split squat carries the volume on the 25-rep ladder.',
        'B · Paused box squat is the anchor on the barbell ladder 12·10·8·6. Round 1 is a speed set.',
        'C · Romanian deadlift adds hamstring volume.',
        'D · Barbell hip thrust, the most spine-sparing lift on the sheet, +5 kg every clean session.',
        'E · Step-up to a 30–35 cm box.',
      ],
    },
    late: {
      slots: ['bulgarian_split_squat', 'paused_box_squat', 'romanian_deadlift', 'hip_thrust', 'box_step_up'],
      why: [
        'A–E · Unchanged. Weeks 4–6 progress by load only.',
      ],
    },
  },
  UPPER1: {
    title: 'Push-led · barbell bench anchor',
    early: {
      slots: ['chest_supported_row', 'bench_press', 'incline_db_press', 'dips', 'tempo_curl'],
      why: [
        'A · Chest-supported row: the loaded pull, fine at five rounds.',
        'B · Barbell bench press is the anchor on the ladder 12·10·8·6. Safety pins or a spotter.',
        'C · Incline DB press keeps a free hand path.',
        'D · Dips as a loaded slot: upper arms to parallel, load-only progression.',
        'E · Tempo curl, 3 s up and 3 s down, light.',
      ],
    },
    late: {
      slots: ['chest_supported_row', 'bench_press', 'incline_db_press', 'weighted_dip', 'tempo_curl'],
      why: [
        'D · Weighted dip: progression by load, never by depth.',
        'A–C, E · Unchanged; progress by load.',
      ],
    },
  },
  CORE: {
    title: 'Anti-movement · carries and holds',
    early: {
      slots: ['suitcase_carry', 'ab_rollout', 'copenhagen_plank', 'spanish_squat', 'loaded_single_leg_stand'],
      why: [
        'An anti-movement day: carries, anti-extension, adductors and balance.',
        'A · Suitcase carry, heavy: anti-lateral-flexion plus grip, five rounds.',
        'B · Ab rollout: anti-extension.',
        'C · Copenhagen plank, short lever (top knee on the bench).',
        'D · Spanish squat hold.',
        'E · Single-leg stand with the load in the opposite hand.',
      ],
    },
    late: {
      slots: ['suitcase_carry', 'ab_rollout', 'copenhagen_plank', 'wall_sit', 'loaded_single_leg_stand'],
      why: [
        'D · Wall sit rotates in for the Spanish squat: progress the angle.',
        'C · Copenhagen progresses from knee-on-bench to ankle-on-bench.',
      ],
    },
  },
  LEGS2: {
    title: 'Hinge-led · trap bar + trap-bar carry',
    early: {
      slots: ['deficit_reverse_lunge', 'trap_bar_deadlift', 'nordic_curl', 'trap_bar_carry', 'seated_calf_raise'],
      why: [
        'A · Deficit reverse lunge carries the volume.',
        'B · Trap bar is the anchor: add 2.5 kg every session the top set is clean.',
        'C · Nordic curl for the hamstrings.',
        'D · Trap-bar carry: the bar is already loaded, which makes D a heavy slot.',
        'E · Seated calf raise (soleus) for ankle range.',
      ],
    },
    late: {
      slots: ['deficit_reverse_lunge', 'trap_bar_deadlift', 'nordic_curl', 'trap_bar_carry', 'seated_calf_raise'],
      why: [
        'A–E · Unchanged. This day progresses by load only.',
      ],
    },
  },
  UPPER2: {
    title: 'Pull-led · overhead press anchor',
    early: {
      slots: ['inverted_row', 'overhead_press', 'push_up_plus', 'single_arm_row', 'face_pull'],
      why: [
        'A · Inverted row, feet down: the horizontal pull, and the first step toward pull-ups.',
        'B · Overhead press, strict. The landmine press is the shoulder-friendly alternative.',
        'C · Push-up plus for the serratus.',
        'D · Single-arm row, loaded slot.',
        'E · Band face pull, the scapular slot.',
      ],
    },
    late: {
      slots: ['inverted_row', 'overhead_press', 'band_assisted_pull_up', 'single_arm_row', 'face_pull'],
      why: [
        'A · Inverted row with the feet on a bench.',
        'C · Band-assisted pull-up, the last step before full pull-ups.',
        'B, D, E · Unchanged; progress by load.',
      ],
    },
  },
};

/* Exercise snacks — brief supplementary sessions. Reference + memory only:
   never logged to the journal. `target` is the prescription; reps/kg/band are user-owned. */
const SNACK_SESSIONS = {
  scapula: {
    name: 'Scapula',
    freq: '3×/week',
    minutes: 15,
    blurb: 'Serratus and lower trap — the base for pull-ups and overhead pressing.',
    intro: 'Do this fresh, never before or on an upper day. Judge it at eight weeks.',
    items: [
      { ex: 'prone_y_raise', target: '3 × 10–15' },
      { ex: 'wall_slide_band', target: '3 × 8–12' },
      { ex: 'serratus_punch_band', target: '3 × 12–15' },
      { ex: 'band_external_rotation', target: '2 × 12–15' },
      { ex: 'banded_scaption', target: '2 × 10–12' },
      { ex: 'straight_arm_band_pulldown', target: '3 × 12–20' },
      { ex: 'supported_scap_shrug', target: '3 × 10–12 · ladder step 1–2' },
      { ex: 'active_hang', target: '3 × 15–20 s · ladder step 3' },
    ],
  },
  volume: {
    name: 'Volume',
    freq: '2×/week',
    minutes: 12,
    blurb: 'Delts, calves, arms and rear delts — the volume the pyramid cannot hold.',
    intro: 'Run as a circuit, no rest between exercises. Light loads are fine, but take the last round close to failure.',
    items: [
      { ex: 'lateral_raise', target: '4 × 12–20' },
      { ex: 'calf_raise', target: '4 × 10–15 · standing' },
      { ex: 'tibialis_raise', target: '3 × 13–16' },
      { ex: 'african_curl', target: '3 × 10–15' },
      { ex: 'band_pull_apart', target: '2–3 × 15–20' },
    ],
  },
};

function seedState() {
  const exercises = {};
  SEED_EXERCISES.forEach((e) => { exercises[e.id] = Object.assign({}, e); });
  return {
    version: STORE_VERSION,
    settings: { cardioMinutes: 2, fontScale: 1, weightStep: 2.5, travelMode: false, sprintLeadIn: 3, equipment: defaultEquipment() },
    exercises,
    journeys: [{
      id: 'j1',
      name: 'Journey 1',
      startDate: localDate(),
      weekCount: 6,
      weekPlan: WEEK_PLAN.slice(),
      blocks: JSON.parse(JSON.stringify(SEED_BLOCKS)),
      scoreboard: JSON.parse(JSON.stringify(JOURNEY2_SCOREBOARD)),
    }],
    activeJourneyId: 'j1',
    sessions: [],
    zone2Checks: {},
    bigThree: {},
    missed: {},
    lastSprintRounds: [],
    bodyweight: {},
    work: {},
    tests: [],
    circuitDose: {},
    current: null,
  };
}

function blockForWeek(week) { return week <= 3 ? 'early' : 'late'; }
