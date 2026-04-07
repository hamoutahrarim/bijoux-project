# Déployer sur Vercel

Cette petite page explique comment déployer ce site statique sur Vercel en utilisant des variables d'environnement pour protéger (au moins à l'exécution) les identifiants admin.

1. Crée un nouveau projet sur Vercel en reliant ton dépôt GitHub (ou en pushant ce repo depuis ton ordinateur).

2. Dans le tableau de bord du projet Vercel, va dans Settings → Environment Variables et ajoute les deux variables :

   - Key: `ADMIN_USERNAME`
     Value: `SUPERUTILISATEUR`
   - Key: `ADMIN_PASSWORD`
     Value: `Bijoux1234$`

   (Tu peux changer ces valeurs. Elles seront lues au moment du build.)

3. Vercel exécutera `npm run build` (script défini dans `package.json`) pendant le déploiement. Le script `scripts/generate-config.js` va générer `security/config.js` à partir des variables d'environnement `ADMIN_USERNAME` et `ADMIN_PASSWORD`.

4. Le site est servi comme site statique. Après le déploiement, tu pourras te connecter en admin avec les identifiants fournis.

Notes de sécurité
- Ce dépôt contient un fichier `security/.env` et un `security/config.js` pour faciliter le développement local. Dans une vraie application, les secrets doivent rester côté serveur (hachés, non exposés au client).
- Le mécanisme ici est pratique pour un prototype ou un site statique simple, mais pas pour un site en production qui requiert une vraie authentification.

Tester localement
- Pour tester localement :

  1. Installer Node.js (si nécessaire).
  2. Dans le répertoire du projet :

     ```bash
     npm install
     npm run build
     ```

  3. Le script `npm run build` générera `security/config.js` (si tu veux tester avec d'autres identifiants, définis `ADMIN_USERNAME` et `ADMIN_PASSWORD` en local avant d'exécuter `npm run build`).

5. Tu peux ensuite ouvrir `index.html` ou `shop.html` dans ton navigateur (double-clique) pour tester localement.
