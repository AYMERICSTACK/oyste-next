/**
 * Notes d'import ERP OYSTE
 *
 * Le fichier source `export_ouvrages_2026.ods` contient quatre feuilles :
 * - export_Ouvrage : liste des ouvrages / solutions.
 * - export_det : liaison technique ouvrage -> produits par identifiants ERP.
 * - Export_produits : catalogue des références produits.
 * - ouvrage+det : vue déjà enrichie ouvrage -> composants avec labels, ordre et prix.
 *
 * Pour la V6, le site consomme un snapshot TypeScript généré depuis `ouvrage+det`
 * et `Export_produits` : `data/erp/erp-snapshot.ts`.
 *
 * La logique importante :
 * - Le configurateur ne fabrique pas une liste de produits à la main.
 * - Il identifie un ouvrage ERP : ex. PFI500kg2000mm.
 * - Il charge ensuite les composants de cet ouvrage dans l'ordre ERP.
 * - Le total HT vient de la somme des lignes incluses.
 */
export {};
