import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight, Info, Minus, Plus, RefreshCcw, ShoppingBasket } from 'lucide-react';
import { useState } from 'react';
import { clsx } from 'clsx';
import { addDays, startOfWeek } from '@shared/domain/time';
import type { Recipe } from '@shared/domain/nutrition/recipes';
import { guideFor } from '@shared/domain/nutrition/guides';
import { CookGuide } from './CookGuide';

const ingredientLabel = (i: { qty: number; unit: string; name: string; note?: string }) => `${i.qty} ${i.unit === 'count' ? '' : `${i.unit} `}${i.name}${i.note ? ` (${i.note})` : ''}`.replace(/\s+/g, ' ');
import { api, errorMessage } from '@/lib/api';
import { dayLabel } from '@/lib/format';
import { Dialog, useToast } from '@/ui/overlay';
import { Badge, Button, Callout, Card, EmptyState, ErrorState, PageHeader, PageSkeleton, Select, Skeleton, Tabs } from '@/ui/primitives';

type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
interface Entry {
  id: string;
  date: string;
  slot: Slot;
  recipeId: string | null;
  servings: number;
  leftoverOf: { date: string; slot: Slot } | null;
  label?: string;
  recipe: null | { id: string; name: string; minutes: number; servings: number; nutrition: Recipe['nutrition'] };
}
interface GroceryItem { key: string; name: string; display: string; owned: boolean; checked: boolean; usedIn: string[]; budgetSwap?: string }
interface FoodData {
  weekStart: string;
  today: string;
  householdSize: number;
  entries: Entry[];
  days: { date: string; estimate: { kcal: number; proteinG: number } }[];
  grocery: { sections: { section: string; items: GroceryItem[] }[] };
  basis: string;
  policyNotes: string[];
}

export default function FoodPage() {
  const [week, setWeek] = useState<string | null>(null);
  const [tab, setTab] = useState<'meals' | 'grocery'>('meals');
  const [entry, setEntry] = useState<Entry | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const key = ['food', week];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<FoodData>(`/food${week ? `?week=${week}` : ''}`) });
  const regen = useMutation({
    mutationFn: (weekStart: string) => api.post<FoodData>('/food/regenerate', { weekStart }),
    onSuccess: (d) => {
      qc.setQueryData(key, d);
      qc.invalidateQueries({ queryKey: ['plan'] });
      toast({ message: 'New meal plan created. Review your plan to update meal times.' });
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  if (q.isPending) return <PageSkeleton />;
  if (q.error) return <div className="page"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data;
  const thisWeek = startOfWeek(d.today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(d.weekStart, i));
  const slots: Slot[] = d.entries.some((e) => e.slot === 'snack') ? ['breakfast', 'lunch', 'dinner', 'snack'] : ['breakfast', 'lunch', 'dinner'];
  const toBuy = d.grocery.sections.flatMap((s) => s.items).filter((i) => !i.owned && !i.checked).length;

  return (
    <div className="page">
      <PageHeader
        title="Food"
        description={`Week of ${dayLabel(d.weekStart, { month: 'long', day: 'numeric' })} · cooking for ${d.householdSize}`}
        actions={
          <>
            <div className="row-sm">
              <Button size="sm" iconOnly icon={ChevronLeft} aria-label="Previous week" onClick={() => setWeek(addDays(d.weekStart, -7))} disabled={d.weekStart <= thisWeek} />
              <Button size="sm" onClick={() => setWeek(null)} disabled={d.weekStart === thisWeek}>This week</Button>
              <Button size="sm" iconOnly icon={ChevronRight} aria-label="Next week" onClick={() => setWeek(addDays(d.weekStart, 7))} disabled={d.weekStart >= addDays(thisWeek, 21)} />
            </div>
            <Button size="sm" icon={RefreshCcw} loading={regen.isPending} onClick={() => { if (confirm('Replace this week’s meals with a new plan? Your edits for this week will be lost.')) regen.mutate(d.weekStart); }}>New meal plan</Button>
            <Link to="/settings/food" className="btn btn-secondary btn-sm">Preferences</Link>
          </>
        }
      />
      {d.policyNotes.map((n) => <Callout key={n} tone="info">{n}</Callout>)}
      <Tabs label="Food sections" value={tab} onChange={setTab} tabs={[{ value: 'meals', label: 'Meals' }, { value: 'grocery', label: `Grocery list${toBuy ? ` (${toBuy})` : ''}` }]} />
      {tab === 'meals' ? (
        d.entries.length === 0 ? (
          <Card><EmptyState icon={ShoppingBasket} title="No meals planned">No recipes fit your current settings. Try adjusting kitchen or diet preferences.</EmptyState></Card>
        ) : (
          <>
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="meal-grid" role="table" aria-label="Meal plan">
                <div role="row" style={{ display: 'contents' }}>
                  <div className="meal-cell-head" role="columnheader" style={{ borderLeft: 0 }}><span className="sr-only">Meal</span></div>
                  {dates.map((dt) => (
                    <div key={dt} className="meal-cell-head" role="columnheader">
                      <div className={clsx('strong', dt === d.today && 'num')} style={{ color: dt === d.today ? 'var(--accent-text)' : 'var(--text)' }}>{dayLabel(dt, { weekday: 'short', day: 'numeric' })}</div>
                      <div className="num">~{d.days.find((x) => x.date === dt)?.estimate.kcal ?? 0} kcal</div>
                    </div>
                  ))}
                </div>
                {slots.map((slot) => (
                  <div role="row" key={slot} style={{ display: 'contents' }}>
                    <div className="meal-slot" role="rowheader">{slot}</div>
                    {dates.map((dt) => {
                      const e = d.entries.find((x) => x.date === dt && x.slot === slot);
                      return (
                        <div key={dt} className="meal-cell" role="cell">
                          {e ? (
                            <button className={clsx('meal-btn', e.leftoverOf && 'is-leftover', !e.recipeId && 'is-out')} onClick={() => setEntry(e)}>
                              {e.recipe?.name ?? e.label ?? 'Eating out'}
                              {e.leftoverOf && <div className="subtle">Leftovers</div>}
                              {e.recipe && !e.leftoverOf && e.servings !== d.householdSize && <div className="subtle">{e.servings} servings</div>}
                            </button>
                          ) : <span className="xsmall subtle">—</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <p className="xsmall subtle row-sm"><Info aria-hidden style={{ width: 12 }} /> Calories are per person. {d.basis}</p>
          </>
        )
      ) : (
        <GroceryList d={d} />
      )}
      {entry && <MealDialog entry={entry} d={d} onClose={() => setEntry(null)} onRecipe={setRecipeId} queryKey={key} />}
      {recipeId && <RecipeDialog id={recipeId} onClose={() => setRecipeId(null)} />}
    </div>
  );
}

function MealDialog({ entry, d, onClose, onRecipe, queryKey }: { entry: Entry; d: FoodData; onClose: () => void; onRecipe: (id: string) => void; queryKey: unknown[] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const options = useQuery({ queryKey: ['recipes', entry.slot], queryFn: () => api.get<{ recipes: { id: string; name: string; minutes: number; cost: number }[] }>(`/food/recipes?slot=${entry.slot}`) });
  const update = useMutation({
    mutationFn: (patch: { recipeId?: string | null; servings?: number; label?: string }) => api.patch<FoodData>(`/food/entries/${entry.id}`, patch),
    onSuccess: (data) => {
      qc.setQueryData(queryKey, data);
      qc.invalidateQueries({ queryKey: ['plan'] });
      toast({ message: 'Meal updated — grocery list recalculated.' });
      onClose();
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const [servings, setServings] = useState(entry.servings);
  return (
    <Dialog open onClose={onClose} title={`${entry.slot[0]!.toUpperCase()}${entry.slot.slice(1)} · ${dayLabel(entry.date, { weekday: 'long' })}`} description={entry.recipe?.name ?? entry.label}>
      <div className="stack">
        {entry.leftoverOf && <Callout tone="info">Leftovers from {dayLabel(entry.leftoverOf.date, { weekday: 'long' })}’s dinner — no extra groceries needed.</Callout>}
        {entry.recipe && (
          <div className="row between">
            <div className="small muted">{entry.recipe.minutes} min · ~{entry.recipe.nutrition.kcal} kcal, {entry.recipe.nutrition.proteinG} g protein per serving (estimate)</div>
            <Button size="sm" variant="ghost" onClick={() => onRecipe(entry.recipe!.id)}>View recipe</Button>
          </div>
        )}
        {entry.recipe && !entry.leftoverOf && (
          <div className="row between">
            <span className="field-label">Servings to cook</span>
            <div className="row-sm">
              <Button size="sm" iconOnly icon={Minus} aria-label="Fewer servings" disabled={servings <= 1} onClick={() => setServings((s) => Math.max(1, s - 1))} />
              <span className="num strong" aria-live="polite" style={{ minWidth: 24, textAlign: 'center' }}>{servings}</span>
              <Button size="sm" iconOnly icon={Plus} aria-label="More servings" disabled={servings >= 20} onClick={() => setServings((s) => Math.min(20, s + 1))} />
              <Button size="sm" variant="primary" disabled={servings === entry.servings} loading={update.isPending} onClick={() => update.mutate({ servings })}>Save</Button>
            </div>
          </div>
        )}
        <div className="stack-sm">
          <div className="field-label">Swap for</div>
          {options.isPending ? <Skeleton h={38} /> : options.error ? <Callout tone="danger">{errorMessage(options.error)}</Callout> : (
            <Select aria-label="Choose a different recipe" value="" onChange={(e) => e.target.value && update.mutate({ recipeId: e.target.value })}>
              <option value="">Choose a recipe that fits your settings…</option>
              {options.data.recipes.filter((r) => r.id !== entry.recipeId).map((r) => <option key={r.id} value={r.id}>{r.name} · {r.minutes} min · {'$'.repeat(r.cost)}</option>)}
            </Select>
          )}
          <p className="xsmall subtle">Only recipes that match your diet, allergies and kitchen are listed.</p>
        </div>
        {entry.recipeId && <Button variant="ghost" size="sm" onClick={() => update.mutate({ recipeId: null, label: 'Eating out' })}>Mark as eating out (removes from groceries)</Button>}
        <p className="xsmall subtle">Household of {d.householdSize}. Changing a dinner also frees up the next day’s leftover lunch.</p>
      </div>
    </Dialog>
  );
}

function RecipeDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['recipe', id], queryFn: () => api.get<{ recipe: Omit<Recipe, 'ingredients'> & { ingredients: (Recipe['ingredients'][number] & { name: string })[]; allergens: string[] }; basis: string }>(`/food/recipes/${id}`) });
  const r = q.data?.recipe;
  const guide = guideFor(id);
  return (
    <Dialog open onClose={onClose} title={r?.name ?? 'Recipe'} description={guide ? 'Written for first-time cooks: what to get ready, every step, and how to tell it’s done.' : undefined} wide>
      {q.isPending ? <Skeleton h={200} /> : q.error ? <ErrorState error={q.error} /> : r && (
        <div className="stack">
          <div className="row-wrap">
            <Badge>Prep {r.prepMinutes} min</Badge>
            {r.cookMinutes > 0 && <Badge>Cook {r.cookMinutes} min</Badge>}
            <Badge>Makes {r.servings}</Badge>
            {r.allergens.map((a) => <Badge key={a} tone="warning">Contains {a.replace('_', ' ')}</Badge>)}
          </div>
          <div className="stack-sm">
            <h3>Ingredients</h3>
            <ul className="small" style={{ paddingLeft: 18 }}>
              {r.ingredients.map((i) => <li key={i.key}>{ingredientLabel(i)}{i.swap ? <span className="subtle"> ({i.swap})</span> : null}</li>)}
            </ul>
          </div>
          {guide ? (
            <CookGuide guide={guide} ingredients={r.ingredients.map((i) => ({ key: i.key, label: ingredientLabel(i) }))} />
          ) : (
            <div className="stack-sm">
              <h3>Steps</h3>
              <ol className="small" style={{ paddingLeft: 18 }}>{r.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          )}
          <Callout tone="neutral" title={`Per serving: ~${r.nutrition.kcal} kcal · ${r.nutrition.proteinG} g protein · ${r.nutrition.carbsG} g carbs · ${r.nutrition.fatG} g fat`}>{q.data!.basis}</Callout>
        </div>
      )}
    </Dialog>
  );
}

function GroceryList({ d }: { d: FoodData }) {
  const qc = useQueryClient();
  const toast = useToast();
  const toggle = useMutation({
    mutationFn: ({ kind, key, on }: { kind: 'pantry' | 'checked'; key: string; on: boolean }) => (kind === 'pantry' ? api.put('/food/pantry', { key, owned: on }) : api.put('/food/checked', { weekStart: d.weekStart, key, checked: on })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['food'] }),
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  if (!d.grocery.sections.length) return <Card><EmptyState icon={ShoppingBasket} title="Nothing to buy">No home-cooked meals are planned this week.</EmptyState></Card>;
  return (
    <div className="stack-lg">
      <p className="small muted">Quantities combine every recipe this week. Tick items as you shop; mark staples you always have as “in pantry” to hide them in future weeks.</p>
      <div className="grid-2">
        {d.grocery.sections.map((s) => (
          <Card key={s.section} title={s.section}>
            <ul style={{ listStyle: 'none' }}>
              {s.items.map((i) => (
                <li key={i.key} className={clsx('grocery-row', (i.checked || i.owned) && 'is-checked')}>
                  <label className="checkbox grow" style={{ minWidth: 0 }}>
                    <input type="checkbox" checked={i.checked || i.owned} disabled={i.owned} onChange={(e) => toggle.mutate({ kind: 'checked', key: i.key, on: e.target.checked })} />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="grocery-name small strong">{i.name}</span>
                      <span className="xsmall subtle truncate" style={{ display: 'block' }} title={i.usedIn.join(', ')}>{i.usedIn.join(', ')}{i.budgetSwap ? ` · Cheaper: ${i.budgetSwap}` : ''}</span>
                    </span>
                  </label>
                  <span className="small num">{i.display}</span>
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ kind: 'pantry', key: i.key, on: !i.owned })} aria-pressed={i.owned}>
                    {i.owned ? 'In pantry' : 'Have it'}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
