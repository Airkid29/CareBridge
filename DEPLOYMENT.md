# Déployer CareBridge AI

Ce guide couvre un déploiement **développement local** et les principes pour une **mise en production** (frontend React + backend FastAPI).

## Prérequis

- **Python** 3.11+ (3.12 recommandé)
- **Node.js** 18+ et npm
- Compte Google AI (optionnel) pour une clé **Gemini** — sans clé, l’API démarre quand même et les parties « IA » utilisent des réponses de secours.

---

## 1. Backend (FastAPI)

### 1.1 Environnement virtuel et dépendances

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 1.2 Fichier `backend/.env`

Créez `backend/.env` à côté de `main.py` (il est chargé **automatiquement depuis ce dossier**, même si vous lancez uvicorn depuis la racine du repo).

Variables utiles :

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `GEMINI_API_KEY` | Non | Si absent ou invalide, le serveur démarre ; les routes Gemini utilisent des fallbacks. |
| `JWT_SECRET` | Recommandé en prod | Secret pour signer les JWT (défaut démo dans le code). |

Exemple minimal :

```env
GEMINI_API_KEY=
JWT_SECRET=changez-moi-en-production
```

### 1.3 Lancer l’API

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Vérification : [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) doit renvoyer `{"status":"CareBridge AI running"}`.

### 1.4 Authentification (connexion / inscription)

- Comptes **démo** (toujours valides, non écrasés par le fichier utilisateurs) :  
  - `admin@carebridge.ai` / `admin123`  
  - `doctor@carebridge.ai` / `doctor123`
- Les **nouveaux comptes** sont enregistrés dans `backend/data/users.json` (créé au premier enregistrement).
- Si la connexion démo échouait à cause d’un ancien fichier corrompu, supprimez `backend/data/users.json` puis redémarrez le backend (les comptes démo restent protégés dans le code, mais ce fichier peut contenir des doublons ou erreurs pour d’autres e-mails).

---

## 2. Frontend (React)

### 2.1 Installation

```bash
cd frontend/carebridge-ui
npm install
```

### 2.2 URL de l’API

Par défaut le frontend appelle `http://localhost:8000`. Pour un autre hôte ou port, créez `frontend/carebridge-ui/.env` :

```env
REACT_APP_API_URL=http://127.0.0.1:8000
```

**Important :** après toute modification de `.env`, relancez `npm start` (Create React App lit les variables au démarrage).

Référence : `frontend/carebridge-ui/.env.example`.

### 2.3 Mode développement

```bash
cd frontend/carebridge-ui
npm start
```

L’UI s’ouvre en général sur [http://localhost:3000](http://localhost:3000) (ou 3001 si 3000 est pris). Le backend doit être joignable à l’URL configurée dans `REACT_APP_API_URL`.

### 2.4 Build de production (fichiers statiques)

```bash
cd frontend/carebridge-ui
npm run build
```

Le dossier `build/` contient les assets à servir derrière **nginx**, **Apache**, **Netlify**, **Vercel** (static), etc.

En production, définissez `REACT_APP_API_URL` **au moment du build** vers l’URL publique HTTPS de votre API (ex. `https://api.votredomaine.com`).

---

## 3. Production (schéma type)

1. **Backend** : uvicorn derrière un reverse proxy (nginx / Caddy) en HTTPS, process manager (systemd, supervisord, Docker).
2. **Frontend** : servir `build/` en HTTPS sur le même domaine ou un sous-domaine (ex. `app.` et `api.`).
3. **CORS** : le backend autorise déjà `*` en démo ; en production, restreignez `allow_origins` dans `main.py` à l’origine exacte du front.
4. **Secrets** : `JWT_SECRET` fort, clés Gemini dans les variables d’environnement du serveur, jamais commitées.

---

## 4. MCP (optionnel)

Le dossier `mcp-server/` expose des outils MCP avec la même clé `GEMINI_API_KEY` dans un `.env` à la racine du sous-projet ou via l’environnement du processus. Voir le script de lancement habituel : `python server.py` depuis `mcp-server/` avec venv activé.

---

## 5. Dépannage rapide

| Symptôme | Piste |
|----------|--------|
| « Cannot reach the API » | Backend non démarré, mauvais port, ou `REACT_APP_API_URL` incorrect. |
| 401 sur `/auth/login` | Mauvais mot de passe / email ; vérifier les comptes démo ci-dessus. |
| 409 sur inscription | E-mail déjà utilisé. |
| 400 mot de passe | Minimum 6 caractères à l’inscription. |
| Page blanche après build | Vérifier `homepage` dans `package.json` si l’app n’est pas servie à la racine du domaine. |

---

## 6. Fichiers sensibles (git)

- `backend/.env` — ne pas commiter.
- `backend/data/users.json` — ignoré par git (données locales).

Pour une équipe, partagez uniquement des **exemples** de variables (sans secrets), comme `frontend/carebridge-ui/.env.example`.
