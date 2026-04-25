# Amiv 🎂 — PWA Setup Guide

> Application mobile de gestion d'anniversaires et d'événements entre amis.

---

## Stack technique
- **React + Vite** — framework UI
- **CSS-in-JS inline** — design system fidèle à la maquette
- **Supabase** (prochaine étape) — auth + base de données
- **Vercel** (prochaine étape) — déploiement PWA

---

## 🚀 Lancer le projet en local

### Prérequis
- [Node.js](https://nodejs.org) version 18+ (vérifie avec `node -v`)
- [Cursor](https://cursor.sh) ou VS Code

### Étapes

```bash
# 1. Ouvre ce dossier dans Cursor
# Fichier → Ouvrir le dossier → sélectionne "amiv"

# 2. Ouvre le terminal intégré (Ctrl+` ou Cmd+`)

# 3. Installe les dépendances
npm install

# 4. Lance le serveur de développement
npm run dev

# 5. Ouvre http://localhost:5173 dans ton navigateur
# Sur mobile : ouvre l'URL de ton réseau local affiché dans le terminal
```

---

## 📁 Structure du projet

```
amiv/
├── public/
│   ├── manifest.json     ← Config PWA (icône, nom, couleurs)
│   └── amiv-icon.svg     ← Icône de l'app
├── src/
│   ├── components/
│   │   ├── StatusBar.jsx  ← Barre de statut iOS
│   │   ├── BottomNav.jsx  ← Navigation bas de page
│   │   └── EventCard.jsx  ← Carte événement réutilisable
│   ├── screens/
│   │   ├── Onboarding.jsx ← 3 slides d'introduction
│   │   ├── Home.jsx       ← Liste événements + anniversaires
│   │   ├── Calendar.jsx   ← Vue calendrier mensuel
│   │   ├── Messages.jsx   ← Messagerie + conversations
│   │   ├── Create.jsx     ← Formulaire création événement
│   │   ├── EventDetail.jsx← Détail événement + RSVP
│   │   ├── Invitation.jsx ← Vue invitation reçue
│   │   └── Profile.jsx    ← Profil + paramètres
│   ├── data/
│   │   └── mockData.js    ← Données fictives (à remplacer par Supabase)
│   ├── App.jsx            ← Routeur principal
│   ├── main.jsx           ← Point d'entrée React
│   └── index.css          ← Variables CSS globales + reset
├── index.html
├── package.json
└── vite.config.js
```

---

## 🗄️ Prochaine étape — Brancher Supabase

1. Crée un compte sur [supabase.com](https://supabase.com)
2. Nouveau projet → note ton `URL` et ta clé `anon`
3. Installe le client :
```bash
npm install @supabase/supabase-js
```
4. Crée `src/lib/supabase.js` :
```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'TON_URL_SUPABASE',
  'TA_CLE_ANON'
)
```
5. Les tables à créer dans Supabase :
   - `users` (id, name, email, avatar_url, created_at)
   - `events` (id, name, emoji, date, location, organizer_id, description, created_at)
   - `invitations` (id, event_id, user_id, status: 'yes'|'no'|'maybe'|'pending')
   - `contacts` (id, user_id, contact_id, birthday)
   - `messages` (id, event_id, user_id, text, created_at)

---

## ☁️ Déployer sur Vercel

```bash
# 1. Push sur GitHub
git init
git add .
git commit -m "feat: init amiv v1"
git remote add origin https://github.com/TON_USERNAME/amiv.git
git push -u origin main

# 2. Va sur vercel.com → Import Git Repository → sélectionne "amiv"
# 3. Clique Deploy — c'est tout !
```

---

## 📱 Installer comme PWA sur mobile

Une fois déployé sur Vercel :
- **iOS** : Safari → Partager → "Sur l'écran d'accueil"
- **Android** : Chrome → Menu → "Ajouter à l'écran d'accueil"

---

*Amiv v0.1.0 — Friends come first 🎂*
