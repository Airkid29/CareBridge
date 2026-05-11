# CareBridge AI - Frontend (React UI)

Interface utilisateur React pour la plateforme CareBridge AI, un système intelligent de gestion des plans de sortie hospitalière alimenté par Gemini AI.

## 📋 À Propos

CareBridge AI est une solution de santé numérique qui utilise l'intelligence artificielle pour :
- Analyser les données des patients (standard FHIR R4)
- Générer des plans de sortie personnalisés
- Identifier les interactions médicamenteuses critiques
- Suivre les alertes patients et les métriques de santé

## 🛠️ Prérequis

Avant de commencer, assurez-vous d'avoir installé :
- **Node.js** (v16+) et **npm** (v7+)
- Backend API exécutée localement (voir `../backend/`)
- MCP Server exécuté en arrière-plan (voir `../../mcp-server/`)

## ⚡ Installation Rapide

### 1. Installer les dépendances

```bash
cd frontend/carebridge-ui
npm install
```

### 2. Configurer les variables d'environnement

Créer un fichier `.env` à la racine du projet frontend :

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_API_TIMEOUT=30000
```

### 3. Démarrer le serveur de développement

```bash
npm start
```

L'application s'ouvrira automatiquement à [http://localhost:3000](http://localhost:3000)

## 📦 Scripts Disponibles

### `npm start`
Lance le serveur de développement en mode hot-reload.
- L'application se recharge automatiquement lors de modifications
- Les erreurs de linting apparaissent dans la console

### `npm run build`
Crée une version optimisée pour la production dans le dossier `build/`.
- Bundle minimisé avec hachage des fichiers
- Prêt pour déploiement en production

### `npm test`
Lance la suite de tests en mode watch interactif.
- Utilise Jest et React Testing Library
- Monitore les changements de fichiers

### `npm run eject`
⚠️ **Irreversible** - Éjecte la configuration Create React App
- Donne accès Direct à webpack, Babel, ESLint
- À utiliser uniquement en dernier recours

## 🏗️ Structure du Projet

```
src/
├── components/
│   ├── Auth.jsx              # Authentification utilisateur
│   ├── AdminDashboard.jsx    # Tableau de bord admin
│   ├── AlertsList.jsx        # Liste des alertes patients
│   ├── AlertIcon.jsx         # Composant d'alerte visuelle
│   ├── PatientCard.jsx       # Carte info patient
│   ├── DischargePlan.jsx     # Plan de sortie
│   └── MetricsChart.jsx      # Graphiques métriques
├── App.jsx                   # Composant racine
├── App.css                   # Styles globaux
├── index.js                  # Point d'entrée
└── reportWebVitals.js        # Métriques performance
public/
├── index.html                # Template HTML
├── manifest.json             # PWA manifest
└── robots.txt                # SEO robots
```

## 🎨 Technologies

- **React 19.2.5** - UI framework
- **Tailwind CSS 3.4.19** - Utility-first CSS
- **Axios 1.15.2** - HTTP client
- **PostCSS 8.5.10** - CSS processing
- **React Testing Library** - Tests components

## 🔄 Workflow de Développement

### 1. Connexion à l'API Backend

L'application communique avec le backend FastAPI sur `http://localhost:8000` :

```javascript
// Exemple dans les composants
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  timeout: process.env.REACT_APP_API_TIMEOUT
});
```

### 2. Structure des Données Patient (FHIR R4)

Les données patients suivent le standard FHIR R4 incluant :
- Informations démographiques
- Conditions médicales
- Médicaments actifs
- Alertes d'interactions
- Plans de sortie

### 3. Composition des Composants

Chaque composant React utilise :
- Tailwind CSS pour le styling
- Props pour la communication parent-enfant
- Hooks (useState, useEffect, useContext)

## 🚀 Lancement Complet du Projet

Pour un lancement propre de l'ensemble du projet :

```bash
# Terminal 1 - Backend FastAPI
cd backend/
python main.py
# → Backend sur http://localhost:8000

# Terminal 2 - MCP Server
cd mcp-server/
python server.py
# → MCP Server écoute les requêtes

# Terminal 3 - Frontend React
cd frontend/carebridge-ui/
npm install
npm start
# → Frontend sur http://localhost:3000
```

## 🧪 Tests

Lancer la suite de tests :

```bash
npm test
```

Générer un rapport de couverture :

```bash
npm test -- --coverage --watchAll=false
```

## 📦 Build pour Production

Créer un bundle optimisé :

```bash
npm run build
```

Le dossier `build/` contient :
- HTML minimisé
- CSS optimisé
- JavaScript bundlé et minifié
- Assets images/fonts

Déployer le contenu du dossier `build/` sur un serveur web statique.

## 🔐 Variables d'Environnement

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_API_URL` | `http://localhost:8000` | URL backend API |
| `REACT_APP_API_TIMEOUT` | `30000` | Timeout requêtes (ms) |

## 🐛 Dépannage

### Port 3000 déjà utilisé
```bash
PORT=3001 npm start
```

### Dépendances cassées
```bash
rm -rf node_modules package-lock.json
npm install
```

### Cache de build
```bash
rm -rf build/
npm run build
```

## 📚 Ressources

- [React Documentation](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [FHIR R4 Standard](https://www.hl7.org/fhir/r4/)
- [Axios Documentation](https://axios-http.com/docs/intro)

## 📝 Notes de Développement

- Le projet utilise Create React App pour la configuration
- CSS compilé dynamiquement avec Tailwind CSS à partir de `tailwind.config.js`
- Hot reload activé pour développement rapide
- Testing préconfiguré avec Jest et React Testing Library

## 🎯 État Actuel (Hackathon Agents Assemble)

- ✅ Scaffolding frontend créé
- ✅ Tailwind CSS configuré
- 🔄 Composants en développement (Auth, Dashboard, Alerts)
- ⏳ Intégration backend en cours
- ⏳ Tests réflexes à ajouter

---

**Hackathon:** Agents Assemble - Healthcare AI 2026  
**Deadline:** 11 mai 2026

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
