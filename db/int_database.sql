-- PostgreSQL initialization script for coach_sportif
-- Includes existing tables from lib/db/src/schema/*.ts + new profile/check-in tables.

BEGIN;

-- -----------------------------------------------------------------------------
-- Existing schema tables (aligned with Drizzle schema in lib/db/src/schema)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workouts (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  reps INTEGER NOT NULL CHECK (reps > 0),
  weight_kg NUMERIC(6, 2) NOT NULL CHECK (weight_kg >= 0),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  target_value NUMERIC(10, 2) NOT NULL,
  current_value NUMERIC(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  deadline DATE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_id INTEGER NULL REFERENCES goals(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('running', 'strength', 'fitness', 'recovery')),
  title TEXT NOT NULL,
  target_duration_min INTEGER NOT NULL CHECK (target_duration_min > 0),
  target_intensity_rpe NUMERIC(3, 1) NULL CHECK (target_intensity_rpe BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'done', 'skipped', 'adapted')),
  plan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_goals_user_completed ON goals(user_id, completed);
CREATE INDEX IF NOT EXISTS idx_workout_sets_workout_id ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_date ON user_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_status_date ON user_sessions(user_id, status, session_date);

-- -----------------------------------------------------------------------------
-- New user profiling and readiness tables
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT PRIMARY KEY,
  age INTEGER NOT NULL CHECK (age >= 13 AND age <= 100),
  sexe TEXT,
  taille_cm INTEGER NOT NULL CHECK (taille_cm >= 100 AND taille_cm <= 250),
  poids_kg NUMERIC(5, 2) NOT NULL CHECK (poids_kg >= 30 AND poids_kg <= 400),
  niveau_sportif_initial TEXT NOT NULL,
  objectif_principal TEXT NOT NULL,
  contraintes_physiques TEXT,
  sports_preferes TEXT[] NOT NULL DEFAULT '{}',
  sports_detestes TEXT[] NOT NULL DEFAULT '{}',
  materiel_disponible TEXT[] NOT NULL DEFAULT '{}',
  jours_disponibles SMALLINT[] NOT NULL DEFAULT '{}',
  duree_max_par_seance INTEGER NOT NULL CHECK (duree_max_par_seance >= 10 AND duree_max_par_seance <= 300),
  historique_blessures TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT user_profile_sexe_check
    CHECK (sexe IS NULL OR sexe IN ('femme', 'homme', 'non_binaire', 'autre', 'non_precise')),
  CONSTRAINT user_profile_niveau_check
    CHECK (niveau_sportif_initial IN ('debutant', 'intermediaire', 'avance', 'expert')),
  CONSTRAINT user_profile_objectif_check
    CHECK (objectif_principal IN ('perte_de_poids', 'prise_de_muscle', 'sante', 'performance')),
  CONSTRAINT user_profile_jours_disponibles_check
    CHECK (jours_disponibles <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[])
);

CREATE TABLE IF NOT EXISTS daily_checkin (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profile(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sommeil_qualite TEXT NOT NULL,
  sommeil_heures NUMERIC(3, 1) NOT NULL CHECK (sommeil_heures >= 0 AND sommeil_heures <= 24),
  fatigue TEXT NOT NULL,
  motivation TEXT NOT NULL,
  stress TEXT NOT NULL,
  courbatures TEXT NOT NULL,
  humeur TEXT NOT NULL,
  alimentation_percue TEXT NOT NULL,
  alcool_ou_soiree BOOLEAN NOT NULL DEFAULT FALSE,
  douleur_presente BOOLEAN NOT NULL DEFAULT FALSE,
  zone_douleur TEXT,
  seance_faite BOOLEAN NOT NULL DEFAULT FALSE,
  seance_loupee_raison TEXT,
  commentaire TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_checkin_unique_user_date UNIQUE (user_id, date),
  CONSTRAINT daily_checkin_qualite_sommeil_check CHECK (sommeil_qualite IN ('mauvais', 'moyen', 'bon')),
  CONSTRAINT daily_checkin_fatigue_check CHECK (fatigue IN ('mauvais', 'moyen', 'bon')),
  CONSTRAINT daily_checkin_motivation_check CHECK (motivation IN ('mauvais', 'moyen', 'bon')),
  CONSTRAINT daily_checkin_stress_check CHECK (stress IN ('mauvais', 'moyen', 'bon')),
  CONSTRAINT daily_checkin_courbatures_check CHECK (courbatures IN ('mauvais', 'moyen', 'bon')),
  CONSTRAINT daily_checkin_humeur_check CHECK (humeur IN ('mauvais', 'moyen', 'bon')),
  CONSTRAINT daily_checkin_alimentation_check CHECK (alimentation_percue IN ('mauvais', 'moyen', 'bon')),
  CONSTRAINT daily_checkin_zone_douleur_check
    CHECK (douleur_presente = TRUE OR zone_douleur IS NULL)
);

CREATE TABLE IF NOT EXISTS workout_feedback (
  id SERIAL PRIMARY KEY,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_profile(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  seance_effectuee TEXT NOT NULL,
  difficulte_percue SMALLINT NOT NULL CHECK (difficulte_percue BETWEEN 1 AND 5),
  plaisir SMALLINT NOT NULL CHECK (plaisir BETWEEN 1 AND 5),
  energie_avant SMALLINT NOT NULL CHECK (energie_avant BETWEEN 1 AND 5),
  energie_apres SMALLINT NOT NULL CHECK (energie_apres BETWEEN 1 AND 5),
  douleur_pendant BOOLEAN NOT NULL DEFAULT FALSE,
  commentaire TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT workout_feedback_unique_workout UNIQUE (workout_id),
  CONSTRAINT workout_feedback_seance_effectuee_check
    CHECK (seance_effectuee IN ('oui', 'non', 'partielle'))
);

CREATE TABLE IF NOT EXISTS user_state (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profile(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  readiness_score SMALLINT NOT NULL CHECK (readiness_score BETWEEN 0 AND 100),
  motivation_score SMALLINT NOT NULL CHECK (motivation_score BETWEEN 0 AND 100),
  fatigue_score SMALLINT NOT NULL CHECK (fatigue_score BETWEEN 0 AND 100),
  adherence_score SMALLINT NOT NULL CHECK (adherence_score BETWEEN 0 AND 100),
  injury_risk_score SMALLINT NOT NULL CHECK (injury_risk_score BETWEEN 0 AND 100),
  progression_score SMALLINT NOT NULL CHECK (progression_score BETWEEN 0 AND 100),
  dropout_risk_score SMALLINT NOT NULL CHECK (dropout_risk_score BETWEEN 0 AND 100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT user_state_unique_user_date UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkin_user_date ON daily_checkin(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_feedback_user_date ON workout_feedback(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_state_user_date ON user_state(user_id, date);

COMMIT;
