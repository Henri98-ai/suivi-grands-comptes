# Grands comptes tracker

Outil de suivi des déploiements bobbee chez les cabinets grands comptes :
fiche par cabinet (groupe pilote, commercial, CTD, gestionnaire...), jalons
de déploiement avec ce qui est attendu à chaque étape, possibilité de
décaler un jalon avec historique, et dépôt de transcriptions de RDV avec
résumé automatique attaché au jalon concerné.

## Lancer en local

```bash
npm install
npm start
```

Puis ouvrir http://localhost:3000

## Résumé automatique des transcriptions

Le résumé auto utilise l'API Anthropic. Sans clé configurée, l'outil
fonctionne normalement : tu écris le résumé toi-même juste après avoir
déposé la transcription.

Pour l'activer :
1. Crée une clé sur https://console.anthropic.com/
2. Copie `.env.example` en `.env` et renseigne `ANTHROPIC_API_KEY`
3. En local : le fichier `.env` n'est pas lu automatiquement par ce projet
   (pas de dépendance dotenv pour rester léger) — exporte la variable avant
   de lancer, ou ajoute `require('dotenv').config()` si tu préfères.
4. Sur Render : renseigne `ANTHROPIC_API_KEY` dans Environment > Environment
   Variables du service (voir plus bas).

## Déploiement sur Render (même pattern que tes autres outils)

1. Crée un dépôt GitHub (ex. `Henri98-ai/grands-comptes-tracker`) et pousse
   ce dossier dedans :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/Henri98-ai/grands-comptes-tracker.git
   git push -u origin main
   ```
2. Sur [render.com](https://render.com), New > Web Service, connecte le dépôt.
3. Build command : `npm install`
4. Start command : `npm start`
5. Dans Environment, ajoute `ANTHROPIC_API_KEY` si tu veux le résumé auto.
6. Déploie.

## ⚠️ Persistance des données

Les données (cabinets, jalons, transcriptions) sont stockées dans
`data/db.json` sur le disque du service. Sur le plan gratuit de Render,
le système de fichiers n'est **pas garanti persistant** entre les
redéploiements (il peut être réinitialisé). Pour un usage durable :

- Active un **disque persistant** sur Render (Render Disks, payant) monté
  sur le dossier `data/`, **ou**
- Fais des exports réguliers du fichier `data/db.json` (bouton à ajouter
  si besoin), **ou**
- Migre vers une vraie base (SQLite avec disque persistant, ou Postgres
  managé) si le volume de cabinets suivis devient important.

Pour démarrer et valider l'usage, le fichier JSON suffit largement.
