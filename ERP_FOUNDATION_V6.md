# OYSTE Next.js — V6 ERP Foundation

Cette V6 pose la fondation ERP-first du configurateur.

## Principe

React ne connaît plus les familles métier. Il appelle le moteur :

```ts
buildOuvrageInstallation(answers)
```

Le moteur retrouve l'ouvrage ERP, charge ses composants, puis calcule le total à partir des lignes ERP.

## Nouvelle architecture

```txt
export_ouvrages_2026.ods
        ↓
scripts/import-erp.js
        ↓
lib/erp/normalizer.ts
        ↓
data/erp/erp-snapshot.json
        ↓
lib/erp/repository.ts
        ↓
lib/erp/ouvrageEngine.ts
        ↓
lib/configurator/engine.ts
        ↓
components/configurator/*
```

## Fichiers importants

- `scripts/import-erp.js` : lit l'ODS/XLSX, détecte les feuilles et régénère le snapshot ERP.
- `scripts/check-erp.js` : vérifie rapidement la présence des familles clés.
- `lib/erp/parsers.ts` : parsers par famille (`PFI`, `PFT`, `PMI`, `PMT`, `PORT`, etc.).
- `lib/erp/normalizer.ts` : transforme les feuilles ERP en données normalisées.
- `lib/erp/repository.ts` : accès propre aux ouvrages, produits et composants.
- `lib/erp/ouvrageEngine.ts` : moteur ERP-first utilisé par le configurateur.
- `data/erp/erp-snapshot.json` : données ERP normalisées générées.
- `data/erp/erp-snapshot.ts` : wrapper typé utilisé par Next.js.

## Commandes

Installer la dépendance de lecture Excel/ODS :

```bash
npm install xlsx
```

Regénérer le snapshot ERP :

```bash
npm run import:erp -- ./export_ouvrages_2026.ods
```

Contrôler rapidement le snapshot :

```bash
npm run erp:check
```

## Résultat de l'import actuel

- Ouvrages : 576
- Produits : 7501
- Familles : 341
- Lignes composants : 7587
- Familles clés détectées : `PFI`, `PFT`, `PMI`, `PMT`, `PORT`

## Important

`PORT` est bien détecté dans `Export_produits`, mais l'export actuel ne contient pas encore d'ouvrages `PORT` dans `export_Ouvrage`. C'est normal avec ce fichier : la fondation est prête, il faudra brancher le parser portique au configurateur quand les ouvrages portiques seront présents côté ERP.
