import type { Answers, EngineWarning, SummaryLine } from "./types";

export function getRuleWarnings(answers: Answers): EngineWarning[] {
  const warnings: EngineWarning[] = [];

  if (answers.capacity === "1000" && answers.reach === "3m") {
    warnings.push({
      id: "reinforced-configuration",
      title: "Configuration renforcée",
      message:
        "La combinaison 1 tonne / 3 m nécessite une attention particulière sur le support et les accessoires compatibles.",
      tone: "warning",
    });
  }

  if (answers.environment === "exterieur") {
    warnings.push({
      id: "outdoor-protection",
      title: "Options extérieures disponibles",
      message:
        "L’assistant affiche les options adaptées à l’extérieur. Chaque option reste indépendante.",
      tone: "info",
    });
  }

  if (answers.fixing === "murale") {
    warnings.push({
      id: "wall-mounted-alternative",
      title: "Orientation potence murale",
      message:
        "Une fixation murale peut orienter vers une autre famille de potences selon la structure disponible.",
      tone: "info",
    });
  }

  return warnings;
}

export function getRuleSummaryLines(answers: Answers): SummaryLine[] {
  const lines: SummaryLine[] = [];

  if (answers.environment === "exterieur") {
    lines.push({
      id: "rule-outdoor",
      label: "Règle métier",
      value: "Options extérieures disponibles",
      type: "rule",
    });
  }

  if (answers.fixing === "massif") {
    lines.push({
      id: "rule-massif",
      label: "Règle métier",
      value: "Semelle pour massif intégrée",
      type: "rule",
    });
  }

  return lines;
}
