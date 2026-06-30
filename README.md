# Coach Sportif - Lancement en local

Guide rapide pour lancer le projet en local (frontend + API + base Supabase).

## 1) Prérequis

- Node.js 24+
- pnpm 10+
- Un projet Supabase

Vérifier les versions:

```bash
node -v
pnpm -v
```

## 2) Installer les dépendances

Depuis la racine du projet:

```bash
pnpm install
```

## 3) Configurer les variables d'environnement

### Backend API

Créer `artifacts/api-server/.env.local` avec:

```env
PORT=5001
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-secret>
# Optionnel (AI Coach hors Replit)
# REPLIT_AI_API_KEY=
```

### Frontend

Créer `artifacts/fitness-app/.env.local` avec:

```env
PORT=21558
BASE_PATH=/
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## 4) Initialiser la base de données

Appliquer le schema Drizzle:

```bash
set -a; . artifacts/api-server/.env.local; set +a
pnpm --filter @workspace/db run push
```

Seeder les exercices:

```bash
set -a; . artifacts/api-server/.env.local; set +a
pnpm --filter @workspace/scripts run seed-exercises
```

## 5) Lancer l'application

Ouvrir 2 terminaux depuis la racine.

Terminal 1 - API:

```bash
pnpm --filter @workspace/api-server dev
```

Terminal 2 - Frontend:

```bash
pnpm --filter @workspace/fitness-app dev
```

Ouvrir ensuite:

- Frontend: http://localhost:21558/
- API (health route selon routes): http://localhost:5001/api/health

### Stopper l'application 

Si tu as fermé le terminal ou si le port reste bloqué, trouve le process :

lsof -nP -iTCP:5001 -sTCP:LISTEN
lsof -nP -iTCP:21558 -sTCP:LISTEN

Puis tue-le avec son PID :

kill -9 <PID>

## 6) Vérifier que tout fonctionne

- Connexion / inscription utilisateur
- Création d'un workout
- Liste des workouts visible

## Dépannage rapide

### Erreur 500 sur création workout

Cause fréquente: schema DB non appliqué.

Relancer:

```bash
set -a; . artifacts/api-server/.env.local; set +a
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed-exercises
```

### Port déjà utilisé

- API en `5001` (évite le conflit fréquent sur `5000` macOS)
- Front en `21558`

Vérifier le process:

```bash
lsof -nP -iTCP:5001 -sTCP:LISTEN
lsof -nP -iTCP:21558 -sTCP:LISTEN
```

### Variables Supabase manquantes

- Front: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- API: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`

## Notes sécurité

- Ne jamais commiter `.env.local`
- Régénérer immédiatement une clé `service_role` si elle a été partagée publiquement


