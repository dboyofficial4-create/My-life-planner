import type { Db } from '../db';
import { UserStore } from '../repos/store';
import type { AppConfig } from '../app';
import { DEFAULT_REMINDERS, dueReminders, REMINDER_RETENTION_DAYS, type ReminderSettings } from '../../shared/domain/reminders';
import { awakeWindow } from '../../shared/domain/planner/build';
import { loadContext } from './context';
import { sendPush } from '../integrations/webpush';

export function reminderSettings(store: UserStore): ReminderSettings {
  return store.getSettings().reminders ?? DEFAULT_REMINDERS;
}

/** Push a "you have something new" signal to every browser this user turned notifications on in. */
export async function pushToUser(store: UserStore, config: AppConfig): Promise<number> {
  if (!config.vapid) return 0;
  let sent = 0;
  for (const endpoint of store.pushSubscriptions()) {
    const r = await sendPush(endpoint, config.vapid, config.vapidSubject ?? 'mailto:waypoint@example.com', config.fetch);
    if (r === 'gone') store.removePushSubscription(endpoint);
    if (r === 'sent') sent++;
  }
  return sent;
}

/** Create the reminders due for one user right now. Returns how many are new. */
export function remindersForUser(store: UserStore, now: Date): number {
  const ctx = loadContext(store, now);
  const settings = reminderSettings(store);
  if (!settings.enabled) return 0;
  const commitments = new Map(store.listCommitments().map((c) => [c.id, c.kind]));
  const items = store.itemsBetween(ctx.today, ctx.today).map((i) => ({
    id: i.id,
    date: i.date,
    start: i.start,
    end: i.end,
    title: i.title,
    category: i.category,
    source: i.source,
    status: i.status,
    commitmentKind: i.source === 'fixed' && i.refId ? commitments.get(i.refId) : undefined,
  }));
  const courses = new Map(store.courses().map((c) => [c.id, c.name]));
  const assignments = ctx.modules.has('school')
    ? store.assignments().map((a) => ({ id: a.id, title: a.title, type: a.type, dueDate: a.dueDate, status: a.status, courseName: a.courseId ? (courses.get(a.courseId) ?? null) : null }))
    : [];
  const due = dueReminders({
    today: ctx.today,
    nowMinute: ctx.nowMinute,
    awake: awakeWindow(ctx.settings, ctx.today),
    clock: ctx.settings.profile.clock,
    settings,
    items,
    assignments,
    cardsDue: ctx.modules.has('school') ? store.cardsDueBy(ctx.today) : 0,
  });
  let created = 0;
  for (const r of due) if (store.createNotification({ key: r.key, kind: r.kind, title: r.title, body: r.body, url: r.url })) created++;
  return created;
}

/** Run every minute: create due reminders for every user and push to their devices. */
export async function runReminders(db: Db, config: AppConfig, now = new Date()): Promise<{ users: number; created: number; pushed: number }> {
  const users = db.all<{ user_id: string }>("SELECT user_id FROM onboarding WHERE completed_at IS NOT NULL");
  let created = 0;
  let pushed = 0;
  for (const { user_id } of users) {
    const store = new UserStore(db, user_id);
    try {
      const n = remindersForUser(store, now);
      created += n;
      if (n > 0) pushed += await pushToUser(store, config);
      store.pruneNotifications(now.getTime() - REMINDER_RETENTION_DAYS * 86_400_000);
    } catch (e) {
      // Never let one account's data stop everyone else's reminders. No personal data in logs.
      console.error(`[reminders] failed for one user: ${(e as Error).name}`);
    }
  }
  return { users: users.length, created, pushed };
}
