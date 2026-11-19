/**
 * Beginner cooking guides: every recipe written out for someone who has never cooked it.
 * Each step says what to do, how long it takes, how to tell it's done, and what can go wrong.
 * Safe internal temperatures follow USDA / UK FSA guidance (poultry 74 °C / 165 °F,
 * ground beef 71 °C / 160 °F, fish 63 °C / 145 °F).
 */

export interface GuideStep {
  text: string;
  /** Roughly how long this step takes; shown with a timer button when set. */
  minutes?: number;
  /** What you should see, hear or feel when the step is finished. */
  doneWhen?: string;
  tip?: string;
  safety?: string;
}

export interface RecipeGuide {
  equipment: string[];
  /** Do these before turning anything on ("mise en place"). */
  beforeYouStart: string[];
  steps: GuideStep[];
  storage?: string;
}

/** Cooking words used in the guides, explained. Shown when a step uses one. */
export const COOKING_TERMS: Record<string, string> = {
  dice: 'Cut into small cubes, about the size of a pea or a sugar cube. Cut slices first, then strips, then across the strips.',
  mince: 'Chop very finely, into pieces smaller than a grain of rice. Garlic is usually minced.',
  sauté: 'Cook in a little oil in a pan over medium to medium-high heat, stirring now and then, so the food softens and browns a little.',
  simmer: 'Cook a liquid with small bubbles gently breaking the surface. Lower the heat if it bubbles hard (that is boiling).',
  boil: 'Large, fast bubbles all over the surface. Water boils at 100 °C / 212 °F.',
  wilt: 'Cook leafy greens just until they go soft and shrink. Spinach takes 30 to 60 seconds.',
  brown: 'Cook meat until the outside turns brown, which adds flavor. Spread it out and don’t stir constantly.',
  drain: 'Pour off the liquid. Tip pasta into a colander in the sink; press a can lid against the can to pour out tuna water.',
  rinse: 'Run under cold water in a sieve or colander to wash off starch, dust or can liquid.',
  'set aside': 'Put it to one side (on a plate or in a bowl) to use later.',
  'medium heat': 'The middle of your stove dial. Oil in the pan should shimmer but not smoke.',
  'medium-high heat': 'Between medium and high. A drop of water flicked into the pan should sizzle right away.',
  'medium-low heat': 'Below the middle of the dial. Food should cook gently without sizzling loudly.',
  flake: 'Fish is done when it turns from see-through to solid and pulls apart into layers when you press it with a fork.',
};

/** Rice is in many recipes; one clear method, used by all of them. */
const RICE: GuideStep[] = [
  {
    text: 'Rinse the rice in a sieve under cold water for about 30 seconds, swirling it with your hand.',
    minutes: 1,
    doneWhen: 'The water running out looks much less cloudy.',
    tip: 'Rinsing washes off loose starch so the rice isn’t gluey.',
  },
  {
    text: 'Put the rice in a pot with water. For long-grain white rice use about 1½ cups of water per cup of rice (check your package; brown rice needs more water and longer). Add a pinch of salt.',
    tip: 'A cup is any mug you like, as long as you use the same one for rice and water.',
  },
  {
    text: 'Bring it to a boil on high heat with the lid off.',
    minutes: 5,
    doneWhen: 'Big bubbles all over the surface.',
  },
  {
    text: 'Turn the heat to the lowest setting, put the lid on, and leave it alone. Don’t lift the lid or stir.',
    minutes: 15,
    doneWhen: 'Tilt the pot a little: no water pools at the side, and small holes appear on the surface.',
  },
  {
    text: 'Turn off the heat and let it sit with the lid on, then fluff it with a fork.',
    minutes: 5,
    tip: 'Resting finishes the cooking with steam so the rice is evenly soft.',
  },
];

export const RECIPE_GUIDES: Record<string, RecipeGuide> = {
  overnight_oats: {
    equipment: ['A jar or container with a lid (about 500 ml / 2 cups)', 'Spoon', 'Knife and cutting board'],
    beforeYouStart: ['Measure the oats (about ½ cup) and milk (¾ cup).', 'Have the peanut butter and banana out.'],
    steps: [
      { text: 'Put the oats, milk and peanut butter in the jar and stir well, scraping the bottom so no dry oats are stuck there.', minutes: 2, doneWhen: 'No dry clumps of oats or blobs of peanut butter.', tip: 'Stir the peanut butter into a little milk first if it’s stiff; it mixes in more easily.' },
      { text: 'Slice half the banana into rounds and stir them in. Wrap the other half and keep it for the morning.', minutes: 1 },
      { text: 'Put the lid on and refrigerate overnight (at least 6 hours).', doneWhen: 'In the morning the oats are soft and have soaked up most of the milk.' },
      { text: 'In the morning, stir, add a splash of milk if it’s too thick, and slice the rest of the banana on top.', minutes: 1, tip: 'Eat it cold, or microwave 1 minute (without the metal lid) if you prefer it warm.' },
    ],
    storage: 'Keeps 2 days in the fridge, so you can make two at once.',
  },
  yogurt_bowl: {
    equipment: ['Bowl or lidded container', 'Spoon'],
    beforeYouStart: ['If you want the berries soft, move them from the freezer to the fridge the night before.'],
    steps: [
      { text: 'Spoon the yogurt (about ¾ cup) into the bowl and smooth it out.', minutes: 1 },
      { text: 'Add the berries on top. Frozen ones straight from the freezer are fine; they thaw in 10 to 15 minutes and make the yogurt cold.', minutes: 1 },
      { text: 'Add the granola just before you eat.', tip: 'If you’re packing it, keep the granola in a separate bag so it stays crunchy.' },
    ],
    storage: 'Yogurt and berries keep a day in the fridge; add granola when you eat.',
  },
  egg_toast: {
    equipment: ['Non-stick frying pan', 'Silicone or wooden spatula', 'Small bowl and fork', 'Toaster'],
    beforeYouStart: ['Crack the eggs into the bowl, add a pinch of salt, and beat with a fork until the yellow and white are fully mixed.', 'Put the bread in the toaster, but don’t start it yet.'],
    steps: [
      { text: 'Put the pan on medium-low heat with the oil.', minutes: 1, doneWhen: 'The oil looks thinner and runs easily when you tilt the pan.' },
      { text: 'Add the spinach and stir until it wilts.', minutes: 1, doneWhen: 'The leaves are dark green, soft and have shrunk a lot.' },
      { text: 'Start the toaster now.' },
      { text: 'Pour in the eggs. Let them sit 15 seconds, then slowly push them from the edges to the middle with the spatula. Keep doing this.', minutes: 2, doneWhen: 'Soft curds form and only a little shiny, wet egg is left.', tip: 'Low heat and slow stirring give soft eggs. High heat makes them rubbery.' },
      { text: 'Take the pan off the heat while the eggs still look slightly wet; they finish cooking in the pan’s heat.', doneWhen: 'No liquid egg runs out when you tilt the pan.', safety: 'Cook until no runny liquid egg remains.' },
      { text: 'Pile the eggs on the toast and add a little pepper.' },
    ],
  },
  tofu_scramble: {
    equipment: ['Large frying pan', 'Spatula', 'Knife and cutting board', 'Paper towel or clean tea towel'],
    beforeYouStart: ['Drain the tofu and press it between paper towels for a minute to squeeze out water.', 'Dice the pepper (see "dice").', 'Measure the cumin.'],
    steps: [
      { text: 'Crumble the tofu into a bowl with your hands, into pieces about the size of scrambled egg.', minutes: 1 },
      { text: 'Heat the oil in the pan on medium heat, add the pepper and sauté it.', minutes: 3, doneWhen: 'The pepper is a little soft and has a few brown spots.' },
      { text: 'Add the tofu, cumin and a pinch of salt. Stir, then let it cook, stirring every minute.', minutes: 5, doneWhen: 'The tofu is hot, a little golden in places, and most of the water has cooked off.', tip: 'Tofu is already cooked, so you are heating it and adding flavor.' },
      { text: 'Add the spinach and stir until it wilts.', minutes: 1 },
      { text: 'Warm the tortillas: 20 seconds each side in a dry pan, or 20 seconds in the microwave under a damp paper towel. Fill and roll up.', minutes: 2 },
    ],
    storage: 'The filling keeps 3 days in the fridge. Reheat until hot, then wrap.',
  },
  hummus_wrap: {
    equipment: ['Knife and cutting board', 'Grater', 'Sieve or colander', 'Spoon'],
    beforeYouStart: ['Open the chickpeas, tip them into the sieve, rinse and shake dry. You need about a quarter of the can.', 'Wash the cucumber and carrot.'],
    steps: [
      { text: 'Grate the carrot on the large holes of the grater.', minutes: 2, safety: 'Stop before your fingers reach the grater; leave the last stub.' },
      { text: 'Slice the cucumber into thin rounds or strips.', minutes: 1 },
      { text: 'Lay the tortilla flat and spread the hummus over it, leaving a 2 cm (1 inch) border.', minutes: 1 },
      { text: 'Pile the spinach, cucumber, carrot and chickpeas in a line across the middle.', minutes: 1, tip: 'Don’t overfill, or it won’t close.' },
      { text: 'Fold in the left and right sides, then roll tightly from the bottom. Cut it in half.', minutes: 1, doneWhen: 'It holds together seam-side down.' },
    ],
    storage: 'Best the same day. Wrap tightly in foil or wax paper to pack.',
  },
  tuna_salad_sandwich: {
    equipment: ['Can opener', 'Bowl and fork', 'Knife'],
    beforeYouStart: ['Cut the lemon into quarters.'],
    steps: [
      { text: 'Open the tuna and drain it: press the lid down on the tuna and tip the can over the sink.', minutes: 1, safety: 'Can lids are sharp. Press with a fork, not your fingers.' },
      { text: 'Put the tuna in the bowl with the yogurt, a squeeze of lemon and a pinch of pepper. Mash with a fork.', minutes: 1, doneWhen: 'Evenly mixed, with no dry chunks.' },
      { text: 'Slice the cucumber thinly.', minutes: 1 },
      { text: 'Spread the tuna on one slice of bread, add cucumber, and top with the other slice. Cut in half.', minutes: 1 },
    ],
    storage: 'The tuna mix keeps 1 day in the fridge in a closed container. Keep a packed sandwich cold.',
  },
  bean_burrito_bowl: {
    equipment: ['Medium pot with lid (for rice)', 'Large frying pan', 'Knife and cutting board', 'Sieve', 'Can opener'],
    beforeYouStart: ['Dice the onion and peppers (see "dice").', 'Open the beans, tip them into the sieve, rinse and drain.', 'Grate the cheese.'],
    steps: [
      ...RICE,
      { text: 'While the rice cooks: heat the oil in the frying pan on medium heat, add the onion and peppers, and sauté, stirring every minute or so.', minutes: 7, doneWhen: 'The onion is see-through and soft, the peppers are soft with some brown edges.' },
      { text: 'Add the beans, cumin, a pinch of salt and 3 tablespoons of water. Stir and cook.', minutes: 5, doneWhen: 'The beans are hot all the way through and the water has mostly cooked off.', tip: 'Mash a few beans against the pan with the spatula to make it creamier.' },
      { text: 'Fill bowls with rice, beans, salsa and cheese.' },
    ],
    storage: 'Keeps 4 days in the fridge. Store salsa separately so the rice doesn’t get soggy, and reheat until steaming.',
  },
  chicken_rice_bowl: {
    equipment: ['Medium pot with lid (for rice)', 'Large frying pan with lid', 'Knife and a cutting board used only for raw meat', 'Meat thermometer if you have one'],
    beforeYouStart: ['Peel and mince the garlic.', 'Cut the broccoli into bite-size pieces.', 'Cut the chicken into bite-size pieces on its own board. Then wash your hands, knife and board with hot soapy water.'],
    steps: [
      ...RICE,
      { text: 'Heat the oil in the frying pan on medium-high heat.', minutes: 2, doneWhen: 'The oil shimmers.' },
      { text: 'Add the chicken in one layer. Leave it alone for 3 minutes so it browns, then stir and keep cooking, stirring every couple of minutes.', minutes: 9, doneWhen: 'No pink inside when you cut the biggest piece open, and the juices are clear.', safety: 'Chicken must reach 74 °C / 165 °F inside. Never put cooked chicken back on the raw-meat board.' },
      { text: 'Add the garlic and stir for 30 seconds, then add the broccoli and 3 tablespoons of water and put the lid on.', minutes: 4, doneWhen: 'The broccoli is bright green and a fork goes in with a little resistance.' },
      { text: 'Stir in the soy sauce and serve over the rice.', tip: 'Taste first; add more soy sauce if you like it saltier.' },
    ],
    storage: 'Keeps 3 days in the fridge. Reheat until steaming hot all the way through.',
  },
  turkey_pasta: {
    equipment: ['Large pot (for pasta)', 'Large frying pan', 'Colander', 'Knife and cutting board', 'Can opener'],
    beforeYouStart: ['Dice the onion and mince the garlic.', 'Open the tomatoes.', 'Fill the big pot ¾ full of water.'],
    steps: [
      { text: 'Put the pot of water on high heat with the lid on, to boil for the pasta.', minutes: 8, doneWhen: 'Big rolling bubbles.' },
      { text: 'Meanwhile, heat the oil in the frying pan on medium heat and cook the onion.', minutes: 4, doneWhen: 'Soft and see-through.' },
      { text: 'Add the turkey. Break it into small pieces with the spatula and cook, stirring now and then.', minutes: 7, doneWhen: 'No pink left anywhere.', safety: 'Ground turkey must reach 74 °C / 165 °F. Wash your hands after touching raw meat.' },
      { text: 'When the water boils, add a big pinch of salt and the pasta. Stir once, set a timer for the time on the package, and stir every few minutes.', minutes: 10, doneWhen: 'Bite a piece: soft with a tiny bit of firmness in the middle.' },
      { text: 'Add the garlic to the turkey, stir 30 seconds, then add the tomatoes and a pinch of salt. Simmer.', minutes: 10, doneWhen: 'The sauce has thickened a little.' },
      { text: 'Stir the spinach into the sauce until it wilts.', minutes: 1 },
      { text: 'Drain the pasta in the colander and mix it into the sauce.', safety: 'Pour away from you; the steam is very hot.' },
    ],
    storage: 'Keeps 4 days in the fridge. Add a splash of water when reheating.',
  },
  beef_tacos: {
    equipment: ['Large frying pan', 'Spatula', 'Knife and cutting board'],
    beforeYouStart: ['Dice the onion.', 'Grate the cheese and put the salsa in a bowl.'],
    steps: [
      { text: 'Heat the pan on medium-high heat, then add the beef and onion. Break the beef up with the spatula.', minutes: 9, doneWhen: 'No pink left and the onion is soft.', safety: 'Ground beef must reach 71 °C / 160 °F. Wash your hands after touching raw meat.' },
      { text: 'If there is a lot of fat in the pan, tilt it and spoon most of the fat into a can or jar (not down the sink).', tip: 'Fat poured down the drain hardens and blocks pipes.' },
      { text: 'Add the cumin, a pinch of salt and 3 tablespoons of water. Stir and cook.', minutes: 2, doneWhen: 'The water has mostly cooked off and the beef looks glossy.' },
      { text: 'Warm the tortillas: 20 to 30 seconds per side in a dry pan, or wrapped in a damp paper towel in the microwave for 30 seconds.', minutes: 3, doneWhen: 'Soft and bendy, not cracking.' },
      { text: 'Fill each tortilla with beef, salsa and cheese.' },
    ],
    storage: 'The cooked beef keeps 3 days in the fridge. Warm tortillas fresh.',
  },
  sheet_pan_salmon: {
    equipment: ['Baking tray (lined with foil or baking paper)', 'Medium pot with lid (for rice)', 'Knife and cutting board', 'Oven mitts'],
    beforeYouStart: ['Heat the oven to 220 °C / 425 °F; it takes about 10 minutes.', 'Cut the broccoli into bite-size pieces and the carrots into thin sticks.', 'Cut the lemon in half.'],
    steps: [
      ...RICE,
      { text: 'On the tray, toss the vegetables with the oil and a pinch of salt using your hands, then spread them out in one layer.', minutes: 2, tip: 'Crowded vegetables steam instead of browning, so use two trays if needed.' },
      { text: 'Roast the vegetables.', minutes: 8, safety: 'Use oven mitts; the tray will be 220 °C.' },
      { text: 'Push the vegetables to the sides, put the salmon in the middle skin-side down, squeeze lemon over it and add salt and pepper. Roast again.', minutes: 10, doneWhen: 'The salmon is pale pink all the way through and flakes when pressed with a fork.', safety: 'Fish should reach 63 °C / 145 °F inside.' },
      { text: 'Serve the salmon and vegetables with the rice.' },
    ],
    storage: 'Best eaten fresh. Leftover salmon keeps 2 days in the fridge; eat it cold or reheat gently.',
  },
  lentil_curry: {
    equipment: ['Large pot with lid', 'Medium pot with lid (for rice)', 'Sieve', 'Knife and cutting board', 'Can opener', 'Wooden spoon'],
    beforeYouStart: ['Dice the onion and mince the garlic.', 'Rinse the lentils in the sieve until the water runs mostly clear.', 'Open the coconut milk and tomatoes. Measure 500 ml (2 cups) of water.'],
    steps: [
      ...RICE,
      { text: 'Heat a little oil in the large pot on medium heat, add the onion and garlic, and cook, stirring often.', minutes: 5, doneWhen: 'Soft and smells sweet, not browned.', tip: 'If the garlic starts turning dark brown, turn the heat down; burnt garlic tastes bitter.' },
      { text: 'Stir in the curry powder for 30 seconds.', minutes: 1, doneWhen: 'It smells strongly fragrant.' },
      { text: 'Add the lentils, tomatoes, coconut milk, water and a pinch of salt. Stir, bring it to a boil, then turn the heat down so it simmers.', minutes: 20, doneWhen: 'The lentils have fallen apart and it’s thick like porridge.', tip: 'Stir every few minutes, scraping the bottom, so the lentils don’t stick. Add a splash of water if it gets too thick.' },
      { text: 'Stir in the spinach until wilted. Taste and add salt if it’s flat. Serve over rice.', minutes: 1 },
    ],
    storage: 'Keeps 4 days in the fridge and freezes well for 3 months. It thickens as it cools; add water when reheating.',
  },
  veg_fried_rice: {
    equipment: ['Large frying pan or wok', 'Spatula', 'Small bowl and fork'],
    beforeYouStart: ['Use rice cooked the day before if you have it. If not, cook it (see the rice steps in another recipe) and spread it on a plate to cool for 15 minutes.', 'Beat the eggs in the bowl.', 'Measure the soy sauce.'],
    steps: [
      { text: 'Heat the oil in the pan on medium-high heat.', minutes: 1, doneWhen: 'The oil shimmers.' },
      { text: 'Add the frozen vegetables straight from the bag and stir-fry, stirring often.', minutes: 4, doneWhen: 'Hot, with no ice left.' },
      { text: 'Push the vegetables to one side, pour the eggs into the empty side, and stir them until scrambled.', minutes: 2, doneWhen: 'No runny egg left.' },
      { text: 'Add the rice, break up any clumps, add the soy sauce, and toss everything together.', minutes: 4, doneWhen: 'Steaming hot and the rice is evenly brown from the soy sauce.' },
    ],
    storage: 'Cool quickly and refrigerate within an hour. Keeps 2 days; reheat until steaming.',
  },
  microwave_bean_quesadilla: {
    equipment: ['Microwave-safe plate', 'Fork', 'Small bowl'],
    beforeYouStart: ['Rinse and drain about a quarter of a can of black beans.'],
    steps: [
      { text: 'Mash the beans in the bowl with a fork, with a pinch of salt.', minutes: 1, doneWhen: 'Mostly smooth, a few lumps are fine.' },
      { text: 'Spread the beans over half the tortilla, add the cheese, and fold the other half over.', minutes: 1 },
      { text: 'Microwave on the plate.', minutes: 1.5, doneWhen: 'The cheese is melted at the edges.', safety: 'The filling gets much hotter than the tortilla. Let it sit 1 minute before biting.' },
      { text: 'Cut into wedges and serve with salsa.' },
    ],
  },
  apple_pb: {
    equipment: ['Knife and cutting board'],
    beforeYouStart: ['Wash the apple.'],
    steps: [
      { text: 'Stand the apple up and cut the sides off around the core in four pieces, then slice each piece.', minutes: 2, safety: 'Keep the flat cut side down on the board so the apple doesn’t roll.' },
      { text: 'Serve with the peanut butter (about 2 tablespoons) to dip.', tip: 'Packing it? A squeeze of lemon stops the slices going brown.' },
    ],
  },
  trail_mix: {
    equipment: ['Small bag or container'],
    beforeYouStart: [],
    steps: [
      { text: 'Put a small handful of pumpkin seeds (about 3 tablespoons) in the bag and take a banana.', minutes: 1, tip: 'Eat it 30 to 60 minutes before practice for energy that lasts.' },
    ],
  },
  hummus_snack: {
    equipment: ['Knife and cutting board', 'Peeler (optional)'],
    beforeYouStart: ['Wash the carrot and cucumber.'],
    steps: [
      { text: 'Peel the carrot if you like, cut it in half across, then cut each half lengthwise into sticks.', minutes: 2 },
      { text: 'Cut the cucumber the same way.', minutes: 1 },
      { text: 'Serve with the hummus for dipping.' },
    ],
    storage: 'Cut sticks keep 3 days in a container in the fridge.',
  },
};

export function guideFor(recipeId: string): RecipeGuide | undefined {
  return RECIPE_GUIDES[recipeId];
}

/** The cooking terms a step uses (whole words, case-insensitive), for inline explanations. */
export function termsIn(text: string): string[] {
  // "brown rice" is a kind of rice, not the cooking word
  const t = text.toLowerCase().replace(/brown rice/g, '');
  return Object.keys(COOKING_TERMS).filter((k) => new RegExp(`(^|[^a-z])${k.replace(/[-]/g, '\\-')}([^a-z]|$)`).test(t));
}
