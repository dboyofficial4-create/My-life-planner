/**
 * Ordered, append-only migrations. Never edit a shipped migration — add a new one.
 * Every user-owned table has a user_id column with ON DELETE CASCADE so account
 * deletion removes all of a user's records.
 */
export const MIGRATIONS: { id: number; name: string; sql: string }[] = [
  {
    id: 1,
    name: 'core',
    sql: `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  birthday TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE onboarding (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  draft TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  target_date TEXT,
  priority INTEGER NOT NULL
);
CREATE INDEX goals_user ON goals(user_id);

CREATE TABLE commitments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  travel_before INTEGER NOT NULL DEFAULT 0,
  travel_after INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  intensity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX commitments_user ON commitments(user_id);
CREATE TABLE commitment_exceptions (
  commitment_id TEXT NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  PRIMARY KEY (commitment_id, date)
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  stale INTEGER NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '[]',
  warnings TEXT NOT NULL DEFAULT '[]',
  unscheduled TEXT NOT NULL DEFAULT '[]',
  UNIQUE (user_id, week_start)
);
CREATE TABLE plan_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  start_min INTEGER NOT NULL,
  end_min INTEGER NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  request_key TEXT,
  ref_id TEXT,
  shortened INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  load INTEGER NOT NULL DEFAULT 0,
  travel_before INTEGER NOT NULL DEFAULT 0,
  travel_after INTEGER NOT NULL DEFAULT 0,
  meta TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  locked INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  effort INTEGER,
  discomfort INTEGER,
  note TEXT
);
CREATE INDEX plan_items_user_date ON plan_items(user_id, date);
CREATE TABLE plan_proposals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  base_version INTEGER NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE meal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  recipe_id TEXT,
  servings REAL NOT NULL,
  leftover_of TEXT,
  label TEXT,
  UNIQUE (user_id, date, slot)
);
CREATE TABLE pantry (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ingredient_key TEXT NOT NULL,
  PRIMARY KEY (user_id, ingredient_key)
);
CREATE TABLE grocery_checked (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  ingredient_key TEXT NOT NULL,
  PRIMARY KEY (user_id, week_start, ingredient_key)
);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 3,
  target_grade REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  due_date TEXT NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  completed_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX assignments_external ON assignments(user_id, source, external_id) WHERE external_id IS NOT NULL;
CREATE TABLE grade_categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight REAL NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE grade_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES grade_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  points_earned REAL,
  points_possible REAL NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL
);

CREATE TABLE integrations (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  last_sync_at TEXT,
  last_error TEXT,
  token_enc TEXT,
  meta TEXT,
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE progress_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX progress_user_date ON progress_logs(user_id, date);
`,
  },
  {
    id: 2,
    name: 'canvas_sync',
    sql: `
ALTER TABLE courses ADD COLUMN external_grade REAL;
ALTER TABLE courses ADD COLUMN external_grade_at TEXT;
ALTER TABLE grade_categories ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE grade_categories ADD COLUMN external_id TEXT;
ALTER TABLE grade_entries ADD COLUMN external_id TEXT;
CREATE INDEX courses_external ON courses(user_id, source, external_id);
`,
  },
  {
    id: 3,
    name: 'sports_tests_and_video_cache',
    sql: `
CREATE TABLE skill_tests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  test_id TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX skill_tests_user ON skill_tests(user_id, sport, test_id, date);
CREATE TABLE video_cache (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, cache_key)
);
`,
  },
  {
    id: 4,
    name: 'study_materials',
    sql: `
CREATE TABLE study_materials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX study_materials_user ON study_materials(user_id, course_id, assignment_id);
CREATE TABLE study_topics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  box INTEGER NOT NULL DEFAULT 1,
  due_date TEXT NOT NULL,
  last_reviewed TEXT,
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX flashcards_user_due ON flashcards(user_id, due_date);
`,
  },
  {
    id: 5,
    name: 'practice_questions',
    sql: `
CREATE TABLE practice_questions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  assignment_id TEXT REFERENCES assignments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL,
  choices TEXT NOT NULL DEFAULT '[]',
  answer TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  correct INTEGER NOT NULL DEFAULT 0,
  wrong INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX practice_questions_user ON practice_questions(user_id, assignment_id, course_id);
`,
  },
  {
    id: 6,
    name: 'reminders',
    sql: `
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '/',
  created_at INTEGER NOT NULL,
  delivered_at INTEGER,
  read_at INTEGER,
  UNIQUE (user_id, key)
);
CREATE INDEX notifications_user ON notifications(user_id, created_at);
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
`,
  },
  {
    id: 7,
    name: 'look_reports',
    sql: `
CREATE TABLE look_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  used_photos INTEGER NOT NULL DEFAULT 0,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX look_reports_user ON look_reports(user_id, kind, created_at);
`,
  },
  {
    id: 8,
    name: 'remove_style_area',
    sql: `
DELETE FROM goals WHERE module = 'style';
UPDATE settings SET data = replace(replace(data, ',"style"', ''), '"style",', '') WHERE key = 'profile' AND data LIKE '%"style"%';
UPDATE onboarding SET draft = replace(replace(draft, ',"style"', ''), '"style",', '') WHERE draft LIKE '%"style"%';
`,
  },
  {
    id: 9,
    name: 'account_recovery',
    sql: `
ALTER TABLE users ADD COLUMN recovery_code_hash TEXT;
ALTER TABLE users ADD COLUMN recovery_code_created_at TEXT;
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX password_resets_user ON password_resets(user_id);
`,
  },
  {
    id: 10,
    name: 'readiness_and_team_schedule',
    sql: `
CREATE TABLE readiness (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  answers TEXT NOT NULL,
  score INTEGER NOT NULL,
  level TEXT NOT NULL,
  plan TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, date)
);
ALTER TABLE commitments ADD COLUMN external_uid TEXT;
CREATE INDEX commitments_external ON commitments(user_id, external_uid);
`,
  },
];
