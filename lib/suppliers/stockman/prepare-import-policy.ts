/**
 * Politique de securite STOCKMAN.
 *
 * Aucune approbation metier tracable n'existe encore dans
 * le parcours prepare_import : la preparation est donc
 * suspendue, independamment du statut confirmed_missing.
 *
 * Une future activation devra etre accompagnee d'un
 * controle serveur d'approbation par reference.
 */
export function stockmanImportPreparationEnabled(): boolean {
  return false;
}