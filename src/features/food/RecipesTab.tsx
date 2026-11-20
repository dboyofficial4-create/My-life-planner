import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Clock, CookingPot, Search, Users } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { Badge, Card, Chips, EmptyState, ErrorState, Input, Skeleton } from '@/ui/primitives';

interface RecipeCard {
  id: string;
  name: string;
  minutes: number;
  cost: number;
  slots: ('breakfast' | 'lunch' | 'dinner' | 'snack')[];
  skill: 'beginner' | 'comfortable' | 'confident';
  servings: number;
  packable: boolean;
  leftoverFriendly: boolean;
  kcal: number;
  proteinG: number;
  steps: number;
}
type SlotFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack';
const SKILL: Record<RecipeCard['skill'], string> = { beginner: 'Beginner', comfortable: 'Some experience', confident: 'Confident cook' };

/** Every recipe that fits the student's diet, allergies and kitchen; each opens its full beginner guide. */
export function RecipesTab({ onOpen, planned }: { onOpen: (id: string) => void; planned: Set<string> }) {
  const q = useQuery({ queryKey: ['recipes', 'all'], queryFn: () => api.get<{ recipes: RecipeCard[] }>('/food/recipes') });
  const [slot, setSlot] = useState<SlotFilter>('all');
  const [text, setText] = useState('');
  if (q.isPending) return <Card><Skeleton h={160} /></Card>;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const list = q.data.recipes
    .filter((r) => slot === 'all' || r.slots.includes(slot))
    .filter((r) => !text.trim() || r.name.toLowerCase().includes(text.trim().toLowerCase()))
    .sort((a, b) => Number(planned.has(b.id)) - Number(planned.has(a.id)) || a.minutes - b.minutes);
  return (
    <div className="stack-lg">
      <p className="small muted">Every recipe that fits your diet, allergies and kitchen. Each one is written for first-time cooks, with a step-by-step mode and timers.</p>
      <div className="recipe-filters">
        <Chips<SlotFilter> label="Meal" hideLabel value={slot} onChange={(v) => setSlot(v as SlotFilter)} options={[{ value: 'all', label: 'All' }, { value: 'breakfast', label: 'Breakfast' }, { value: 'lunch', label: 'Lunch' }, { value: 'dinner', label: 'Dinner' }, { value: 'snack', label: 'Snacks' }]} />
        <label className="recipe-search">
          <Search aria-hidden />
          <Input aria-label="Search recipes" placeholder="Search recipes" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
      {list.length === 0 ? (
        <Card><EmptyState icon={CookingPot} title="No recipes match">Try a different meal or search.</EmptyState></Card>
      ) : (
        <ul className="recipe-grid">
          {list.map((r) => (
            <li key={r.id}>
              <button type="button" className={clsx('recipe-card', planned.has(r.id) && 'is-planned')} onClick={() => onOpen(r.id)}>
                <span className="recipe-card__top">
                  <span className="recipe-card__slots">{r.slots.join(' · ')}</span>
                  {planned.has(r.id) && <Badge tone="accent">This week</Badge>}
                </span>
                <span className="recipe-card__name">{r.name}</span>
                <span className="recipe-card__meta">
                  <span><Clock aria-hidden /> {r.minutes} min</span>
                  <span><Users aria-hidden /> Makes {r.servings}</span>
                  <span>{'$'.repeat(r.cost)}</span>
                </span>
                <span className="recipe-card__meta subtle">~{r.kcal} kcal · {r.proteinG} g protein per serving · {r.steps} steps</span>
                <span className="row-wrap" style={{ gap: 6 }}>
                  <Badge tone={r.skill === 'beginner' ? 'success' : 'neutral'}>{SKILL[r.skill]}</Badge>
                  {r.packable && <Badge outline>Packs for school</Badge>}
                  {r.leftoverFriendly && <Badge outline>Good leftovers</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
