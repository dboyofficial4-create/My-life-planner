import type { Allergen } from '../../schemas';
import type { Unit } from './units';

export type Section = 'Produce' | 'Protein' | 'Dairy & eggs' | 'Grains & bread' | 'Pantry' | 'Frozen' | 'Spices & oils';
export type Source = 'plant' | 'dairy' | 'egg' | 'fish' | 'shellfish' | 'poultry' | 'beef' | 'pork';

export interface Ingredient {
  key: string;
  name: string;
  section: Section;
  /** Base dimension used for grocery totals. */
  dim: 'mass' | 'volume' | 'count';
  source: Source;
  allergens: Allergen[];
  /** Cheaper swap suggestion, if any. */
  budgetSwap?: string;
}

export const INGREDIENTS: Record<string, Ingredient> = Object.fromEntries(
  (
    [
      ['oats', 'Rolled oats', 'Grains & bread', 'mass', 'plant', []],
      ['milk', 'Milk', 'Dairy & eggs', 'volume', 'dairy', ['milk']],
      ['soy_milk', 'Soy milk', 'Dairy & eggs', 'volume', 'plant', ['soy']],
      ['banana', 'Bananas', 'Produce', 'count', 'plant', []],
      ['berries_frozen', 'Frozen mixed berries', 'Frozen', 'mass', 'plant', []],
      ['peanut_butter', 'Peanut butter', 'Pantry', 'mass', 'plant', ['peanut']],
      ['sunflower_butter', 'Sunflower seed butter', 'Pantry', 'mass', 'plant', []],
      ['eggs', 'Eggs', 'Dairy & eggs', 'count', 'egg', ['egg']],
      ['bread_wholegrain', 'Whole-grain bread', 'Grains & bread', 'count', 'plant', ['wheat']],
      ['tortillas', 'Whole-wheat tortillas', 'Grains & bread', 'count', 'plant', ['wheat']],
      ['corn_tortillas', 'Corn tortillas', 'Grains & bread', 'count', 'plant', []],
      ['greek_yogurt', 'Plain Greek yogurt', 'Dairy & eggs', 'mass', 'dairy', ['milk']],
      ['granola', 'Granola', 'Grains & bread', 'mass', 'plant', ['wheat']],
      ['spinach', 'Spinach', 'Produce', 'mass', 'plant', []],
      ['cheddar', 'Cheddar cheese', 'Dairy & eggs', 'mass', 'dairy', ['milk']],
      ['black_beans', 'Black beans (canned)', 'Pantry', 'count', 'plant', []],
      ['chickpeas', 'Chickpeas (canned)', 'Pantry', 'count', 'plant', []],
      ['rice', 'Rice', 'Grains & bread', 'mass', 'plant', []],
      ['pasta', 'Pasta', 'Grains & bread', 'mass', 'plant', ['wheat']],
      ['chicken_thigh', 'Chicken thighs (boneless)', 'Protein', 'mass', 'poultry', [], 'Bone-in thighs, deboned at home'],
      ['ground_turkey', 'Ground turkey', 'Protein', 'mass', 'poultry', []],
      ['ground_beef', 'Lean ground beef', 'Protein', 'mass', 'beef', []],
      ['salmon', 'Salmon fillets', 'Protein', 'mass', 'fish', ['fish'], 'Canned salmon or frozen fillets'],
      ['tuna_can', 'Canned tuna', 'Protein', 'count', 'fish', ['fish']],
      ['tofu', 'Firm tofu', 'Protein', 'mass', 'plant', ['soy']],
      ['lentils_red', 'Red lentils (dry)', 'Pantry', 'mass', 'plant', []],
      ['onion', 'Onions', 'Produce', 'count', 'plant', []],
      ['garlic', 'Garlic cloves', 'Produce', 'count', 'plant', []],
      ['bell_pepper', 'Bell peppers', 'Produce', 'count', 'plant', []],
      ['broccoli', 'Broccoli', 'Produce', 'mass', 'plant', [], 'Frozen broccoli'],
      ['carrot', 'Carrots', 'Produce', 'count', 'plant', []],
      ['tomato_can', 'Crushed tomatoes (canned)', 'Pantry', 'count', 'plant', []],
      ['coconut_milk', 'Coconut milk (canned)', 'Pantry', 'count', 'plant', []],
      ['cucumber', 'Cucumbers', 'Produce', 'count', 'plant', []],
      ['lemon', 'Lemons', 'Produce', 'count', 'plant', []],
      ['apple', 'Apples', 'Produce', 'count', 'plant', []],
      ['hummus', 'Hummus', 'Dairy & eggs', 'mass', 'plant', ['sesame']],
      ['olive_oil', 'Olive oil', 'Spices & oils', 'volume', 'plant', []],
      ['soy_sauce', 'Soy sauce', 'Spices & oils', 'volume', 'plant', ['soy', 'wheat']],
      ['curry_powder', 'Curry powder', 'Spices & oils', 'volume', 'plant', []],
      ['cumin', 'Ground cumin', 'Spices & oils', 'volume', 'plant', []],
      ['salsa', 'Salsa', 'Pantry', 'mass', 'plant', []],
      ['frozen_veg', 'Frozen mixed vegetables', 'Frozen', 'mass', 'plant', []],
      ['almonds', 'Almonds', 'Pantry', 'mass', 'plant', ['tree_nut']],
      ['pumpkin_seeds', 'Pumpkin seeds', 'Pantry', 'mass', 'plant', []],
    ] as const
  ).map(([key, name, section, dim, source, allergens, budgetSwap]) => [key, { key, name, section, dim, source, allergens: [...allergens], budgetSwap }]),
) as Record<string, Ingredient>;

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type KitchenTool = 'stove' | 'oven' | 'microwave' | 'blender';

export interface RecipeIngredient {
  key: string;
  qty: number;
  unit: Unit;
  note?: string;
  /** Optional swaps shown to the user. */
  swap?: string;
}

export interface Recipe {
  id: string;
  name: string;
  slots: MealSlot[];
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  tools: KitchenTool[];
  skill: 'beginner' | 'comfortable' | 'confident';
  cost: 1 | 2 | 3;
  packable: boolean;
  leftoverFriendly: boolean;
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Rough per-serving estimate; see NUTRITION_BASIS. */
  nutrition: { kcal: number; proteinG: number; carbsG: number; fatG: number };
}

export const NUTRITION_BASIS =
  'Rough per-serving estimate from typical ingredient values — not from a verified nutrition database. Brands and portions vary.';

export const RECIPES: Recipe[] = [
  {
    id: 'overnight_oats', name: 'Peanut butter banana overnight oats', slots: ['breakfast'], servings: 1, prepMinutes: 5, cookMinutes: 0, tools: [], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: false,
    ingredients: [{ key: 'oats', qty: 50, unit: 'g' }, { key: 'milk', qty: 180, unit: 'ml', swap: 'Soy milk for dairy-free' }, { key: 'peanut_butter', qty: 16, unit: 'g', swap: 'Sunflower seed butter for nut-free' }, { key: 'banana', qty: 1, unit: 'count' }],
    steps: ['Stir oats, milk and peanut butter together in a jar.', 'Slice half the banana in, cover and refrigerate overnight.', 'Top with the rest of the banana in the morning.'],
    nutrition: { kcal: 470, proteinG: 18, carbsG: 68, fatG: 15 },
  },
  {
    id: 'yogurt_bowl', name: 'Greek yogurt berry bowl', slots: ['breakfast', 'snack'], servings: 1, prepMinutes: 3, cookMinutes: 0, tools: [], skill: 'beginner', cost: 2, packable: true, leftoverFriendly: false,
    ingredients: [{ key: 'greek_yogurt', qty: 200, unit: 'g' }, { key: 'berries_frozen', qty: 80, unit: 'g' }, { key: 'granola', qty: 30, unit: 'g' }],
    steps: ['Spoon yogurt into a bowl or container.', 'Top with berries (thawed overnight or straight from frozen) and granola.'],
    nutrition: { kcal: 360, proteinG: 22, carbsG: 45, fatG: 9 },
  },
  {
    id: 'egg_toast', name: 'Scrambled eggs on toast with spinach', slots: ['breakfast'], servings: 1, prepMinutes: 3, cookMinutes: 7, tools: ['stove'], skill: 'beginner', cost: 1, packable: false, leftoverFriendly: false,
    ingredients: [{ key: 'eggs', qty: 2, unit: 'count' }, { key: 'bread_wholegrain', qty: 2, unit: 'count', note: 'slices' }, { key: 'spinach', qty: 30, unit: 'g' }, { key: 'olive_oil', qty: 1, unit: 'tsp' }],
    steps: ['Warm oil in a pan over medium-low heat and wilt the spinach.', 'Add beaten eggs and stir gently until just set.', 'Serve on toasted bread.'],
    nutrition: { kcal: 390, proteinG: 21, carbsG: 30, fatG: 19 },
  },
  {
    id: 'tofu_scramble', name: 'Tofu scramble wrap', slots: ['breakfast', 'lunch'], servings: 2, prepMinutes: 5, cookMinutes: 10, tools: ['stove'], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: true,
    ingredients: [{ key: 'tofu', qty: 300, unit: 'g' }, { key: 'bell_pepper', qty: 1, unit: 'count' }, { key: 'spinach', qty: 60, unit: 'g' }, { key: 'cumin', qty: 1, unit: 'tsp' }, { key: 'corn_tortillas', qty: 4, unit: 'count' }, { key: 'olive_oil', qty: 1, unit: 'tbsp' }],
    steps: ['Crumble tofu with your hands.', 'Cook diced pepper in oil for 3 minutes, add tofu and cumin, cook 5 minutes.', 'Stir in spinach until wilted. Wrap in warmed tortillas.'],
    nutrition: { kcal: 380, proteinG: 22, carbsG: 32, fatG: 18 },
  },
  {
    id: 'hummus_wrap', name: 'Hummus veggie wrap', slots: ['lunch'], servings: 1, prepMinutes: 7, cookMinutes: 0, tools: [], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: false,
    ingredients: [{ key: 'tortillas', qty: 1, unit: 'count' }, { key: 'hummus', qty: 60, unit: 'g' }, { key: 'cucumber', qty: 0.5, unit: 'count' }, { key: 'carrot', qty: 1, unit: 'count' }, { key: 'spinach', qty: 20, unit: 'g' }, { key: 'chickpeas', qty: 0.25, unit: 'count', note: 'can, rinsed' }],
    steps: ['Spread hummus over the tortilla.', 'Layer spinach, sliced cucumber, grated carrot and chickpeas.', 'Roll tightly and halve.'],
    nutrition: { kcal: 420, proteinG: 15, carbsG: 55, fatG: 15 },
  },
  {
    id: 'tuna_salad_sandwich', name: 'Lemon tuna sandwich', slots: ['lunch'], servings: 1, prepMinutes: 6, cookMinutes: 0, tools: [], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: false,
    ingredients: [{ key: 'tuna_can', qty: 1, unit: 'count' }, { key: 'greek_yogurt', qty: 30, unit: 'g' }, { key: 'lemon', qty: 0.25, unit: 'count' }, { key: 'bread_wholegrain', qty: 2, unit: 'count', note: 'slices' }, { key: 'cucumber', qty: 0.25, unit: 'count' }],
    steps: ['Mix drained tuna with yogurt and a squeeze of lemon.', 'Spread on bread and add sliced cucumber.'],
    nutrition: { kcal: 380, proteinG: 34, carbsG: 32, fatG: 10 },
  },
  {
    id: 'bean_burrito_bowl', name: 'Black bean burrito bowl', slots: ['lunch', 'dinner'], servings: 4, prepMinutes: 10, cookMinutes: 20, tools: ['stove'], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: true,
    ingredients: [{ key: 'rice', qty: 300, unit: 'g' }, { key: 'black_beans', qty: 2, unit: 'count', note: 'cans' }, { key: 'bell_pepper', qty: 2, unit: 'count' }, { key: 'onion', qty: 1, unit: 'count' }, { key: 'salsa', qty: 200, unit: 'g' }, { key: 'cumin', qty: 2, unit: 'tsp' }, { key: 'cheddar', qty: 80, unit: 'g', swap: 'Skip or use avocado for dairy-free' }, { key: 'olive_oil', qty: 1, unit: 'tbsp' }],
    steps: ['Cook rice according to the package.', 'Sauté diced onion and pepper in oil for 6–8 minutes.', 'Add beans and cumin; warm through for 5 minutes.', 'Serve over rice with salsa and cheese. Store leftovers separately from salsa.'],
    nutrition: { kcal: 560, proteinG: 22, carbsG: 92, fatG: 11 },
  },
  {
    id: 'chicken_rice_bowl', name: 'Soy-garlic chicken rice bowl', slots: ['dinner', 'lunch'], servings: 4, prepMinutes: 10, cookMinutes: 25, tools: ['stove'], skill: 'comfortable', cost: 2, packable: true, leftoverFriendly: true,
    ingredients: [{ key: 'chicken_thigh', qty: 600, unit: 'g' }, { key: 'rice', qty: 300, unit: 'g' }, { key: 'broccoli', qty: 400, unit: 'g' }, { key: 'garlic', qty: 3, unit: 'count' }, { key: 'soy_sauce', qty: 3, unit: 'tbsp' }, { key: 'olive_oil', qty: 1, unit: 'tbsp' }],
    steps: ['Cook rice.', 'Brown bite-size chicken in oil over medium-high heat, 8–10 minutes, until cooked through (74 °C / 165 °F inside).', 'Add garlic and broccoli with a splash of water; cover 4 minutes.', 'Stir in soy sauce and serve over rice.'],
    nutrition: { kcal: 590, proteinG: 39, carbsG: 68, fatG: 16 },
  },
  {
    id: 'turkey_pasta', name: 'Turkey tomato pasta', slots: ['dinner'], servings: 4, prepMinutes: 5, cookMinutes: 20, tools: ['stove'], skill: 'beginner', cost: 2, packable: true, leftoverFriendly: true,
    ingredients: [{ key: 'pasta', qty: 350, unit: 'g' }, { key: 'ground_turkey', qty: 450, unit: 'g', swap: 'Lentils for vegetarian' }, { key: 'tomato_can', qty: 1, unit: 'count' }, { key: 'onion', qty: 1, unit: 'count' }, { key: 'garlic', qty: 2, unit: 'count' }, { key: 'spinach', qty: 100, unit: 'g' }, { key: 'olive_oil', qty: 1, unit: 'tbsp' }],
    steps: ['Boil pasta.', 'Cook onion in oil 4 minutes, add turkey and brown fully.', 'Add garlic and tomatoes, simmer 10 minutes, stir in spinach.', 'Toss with drained pasta.'],
    nutrition: { kcal: 600, proteinG: 36, carbsG: 74, fatG: 17 },
  },
  {
    id: 'beef_tacos', name: 'Quick beef tacos', slots: ['dinner'], servings: 4, prepMinutes: 10, cookMinutes: 12, tools: ['stove'], skill: 'beginner', cost: 2, packable: false, leftoverFriendly: true,
    ingredients: [{ key: 'ground_beef', qty: 450, unit: 'g' }, { key: 'corn_tortillas', qty: 12, unit: 'count' }, { key: 'onion', qty: 1, unit: 'count' }, { key: 'cumin', qty: 2, unit: 'tsp' }, { key: 'salsa', qty: 150, unit: 'g' }, { key: 'cheddar', qty: 80, unit: 'g' }],
    steps: ['Brown beef with diced onion, 8–10 minutes, until no pink remains.', 'Season with cumin and a splash of water.', 'Warm tortillas and fill with beef, salsa and cheese.'],
    nutrition: { kcal: 560, proteinG: 32, carbsG: 44, fatG: 28 },
  },
  {
    id: 'sheet_pan_salmon', name: 'Sheet-pan salmon and vegetables', slots: ['dinner'], servings: 2, prepMinutes: 10, cookMinutes: 18, tools: ['oven'], skill: 'comfortable', cost: 3, packable: false, leftoverFriendly: false,
    ingredients: [{ key: 'salmon', qty: 300, unit: 'g' }, { key: 'broccoli', qty: 300, unit: 'g' }, { key: 'carrot', qty: 2, unit: 'count' }, { key: 'lemon', qty: 0.5, unit: 'count' }, { key: 'olive_oil', qty: 1, unit: 'tbsp' }, { key: 'rice', qty: 150, unit: 'g' }],
    steps: ['Heat oven to 220 °C / 425 °F and cook rice.', 'Toss vegetables in oil on a tray; roast 8 minutes.', 'Add salmon, squeeze lemon over, roast 10 more minutes until it flakes.'],
    nutrition: { kcal: 640, proteinG: 38, carbsG: 66, fatG: 24 },
  },
  {
    id: 'lentil_curry', name: 'Coconut red lentil curry', slots: ['dinner', 'lunch'], servings: 4, prepMinutes: 10, cookMinutes: 25, tools: ['stove'], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: true,
    ingredients: [{ key: 'lentils_red', qty: 250, unit: 'g' }, { key: 'coconut_milk', qty: 1, unit: 'count' }, { key: 'tomato_can', qty: 1, unit: 'count' }, { key: 'onion', qty: 1, unit: 'count' }, { key: 'garlic', qty: 3, unit: 'count' }, { key: 'curry_powder', qty: 1, unit: 'tbsp' }, { key: 'spinach', qty: 100, unit: 'g' }, { key: 'rice', qty: 250, unit: 'g' }],
    steps: ['Cook rice.', 'Soften onion and garlic in a pot, 5 minutes; stir in curry powder.', 'Add rinsed lentils, tomatoes, coconut milk and 500 ml water. Simmer 20 minutes, stirring.', 'Stir in spinach and serve over rice.'],
    nutrition: { kcal: 580, proteinG: 20, carbsG: 82, fatG: 19 },
  },
  {
    id: 'veg_fried_rice', name: 'Egg and vegetable fried rice', slots: ['dinner', 'lunch'], servings: 2, prepMinutes: 5, cookMinutes: 12, tools: ['stove'], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: true,
    ingredients: [{ key: 'rice', qty: 150, unit: 'g', note: 'ideally cooked the day before' }, { key: 'eggs', qty: 3, unit: 'count' }, { key: 'frozen_veg', qty: 250, unit: 'g' }, { key: 'soy_sauce', qty: 2, unit: 'tbsp' }, { key: 'olive_oil', qty: 1, unit: 'tbsp' }],
    steps: ['Cook rice ahead if you can (cold rice fries best).', 'Stir-fry vegetables in oil 4 minutes; push aside and scramble eggs.', 'Add rice and soy sauce; toss until hot.'],
    nutrition: { kcal: 520, proteinG: 20, carbsG: 70, fatG: 17 },
  },
  {
    id: 'microwave_bean_quesadilla', name: 'Microwave bean quesadilla', slots: ['lunch', 'snack'], servings: 1, prepMinutes: 4, cookMinutes: 2, tools: ['microwave'], skill: 'beginner', cost: 1, packable: false, leftoverFriendly: false,
    ingredients: [{ key: 'tortillas', qty: 1, unit: 'count' }, { key: 'black_beans', qty: 0.25, unit: 'count', note: 'can, mashed' }, { key: 'cheddar', qty: 30, unit: 'g' }, { key: 'salsa', qty: 40, unit: 'g' }],
    steps: ['Spread mashed beans on half the tortilla, add cheese, fold.', 'Microwave 60–90 seconds until melted. Serve with salsa.'],
    nutrition: { kcal: 400, proteinG: 18, carbsG: 50, fatG: 14 },
  },
  {
    id: 'apple_pb', name: 'Apple with peanut butter', slots: ['snack'], servings: 1, prepMinutes: 2, cookMinutes: 0, tools: [], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: false,
    ingredients: [{ key: 'apple', qty: 1, unit: 'count' }, { key: 'peanut_butter', qty: 32, unit: 'g', swap: 'Sunflower seed butter for nut-free' }],
    steps: ['Slice the apple and serve with peanut butter.'],
    nutrition: { kcal: 280, proteinG: 8, carbsG: 28, fatG: 16 },
  },
  {
    id: 'trail_mix', name: 'Seed and fruit trail mix', slots: ['snack'], servings: 1, prepMinutes: 1, cookMinutes: 0, tools: [], skill: 'beginner', cost: 2, packable: true, leftoverFriendly: false,
    ingredients: [{ key: 'pumpkin_seeds', qty: 25, unit: 'g' }, { key: 'banana', qty: 1, unit: 'count' }],
    steps: ['Pack a handful of pumpkin seeds with a banana — easy fuel before practice.'],
    nutrition: { kcal: 240, proteinG: 8, carbsG: 30, fatG: 12 },
  },
  {
    id: 'hummus_snack', name: 'Hummus and veggie sticks', slots: ['snack'], servings: 1, prepMinutes: 4, cookMinutes: 0, tools: [], skill: 'beginner', cost: 1, packable: true, leftoverFriendly: false,
    ingredients: [{ key: 'hummus', qty: 60, unit: 'g' }, { key: 'carrot', qty: 1, unit: 'count' }, { key: 'cucumber', qty: 0.5, unit: 'count' }],
    steps: ['Cut carrot and cucumber into sticks and serve with hummus.'],
    nutrition: { kcal: 190, proteinG: 6, carbsG: 18, fatG: 11 },
  },
];

export function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function recipeAllergens(r: Recipe): Allergen[] {
  return [...new Set(r.ingredients.flatMap((i) => INGREDIENTS[i.key]?.allergens ?? []))];
}

export function recipeSources(r: Recipe): Source[] {
  return [...new Set(r.ingredients.map((i) => INGREDIENTS[i.key]!.source))];
}
