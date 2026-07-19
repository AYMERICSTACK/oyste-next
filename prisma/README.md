# Fondation PostgreSQL OYSTE

## Première installation

1. Copier `.env.example` vers `.env.local`.
2. Renseigner `DATABASE_URL` avec l'URL PostgreSQL/Neon.
3. Installer les dépendances : `npm install`.
4. Créer la première migration :

```bash
npm run db:migrate -- --name init_oyste
```

5. Importer le catalogue actuel et les données initiales :

```bash
npm run db:seed
```

6. Ouvrir Prisma Studio pour contrôler les données :

```bash
npm run db:studio
```

## Déploiement

Les migrations déjà versionnées s'appliqueront avec :

```bash
npm run db:deploy
```

Le `postinstall` régénère automatiquement Prisma Client pendant l'installation et le build Vercel.

## Contenu du seed

Le seed est idempotent pour les données principales et importe :

- les produits de `data/catalogue/products.json` ;
- les variantes et caractéristiques ;
- les fournisseurs et catégories détectés ;
- les images et documents de `data/catalogue/media-manifest.json` ;
- un compte Super Admin invité `admin@oyste.fr` ;
- les premiers paramètres globaux du site.

Le compte créé par le seed n'a volontairement aucun mot de passe. Son activation sera réalisée dans la V35.2 dédiée à l'authentification.
