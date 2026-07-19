import { getBusinessFamily } from "../registry";
import type {
  BusinessAnswers,
  BusinessDecisionResult,
  BusinessDecisionState,
  BusinessFamilyDefinition,
  BusinessStep,
  ComponentAction,
} from "../types";
import { isStepAnswered, isStepVisible } from "../rules/conditions";

function getChoiceActions(step: BusinessStep, answers: BusinessAnswers): ComponentAction[] {
  const answer = answers[step.id];
  if (!answer || !step.choices?.length) return [];

  if (Array.isArray(answer)) {
    return step.choices
      .filter((choice) => answer.includes(choice.id))
      .flatMap((choice) => choice.actions ?? []);
  }

  return step.choices.find((choice) => choice.id === answer)?.actions ?? [];
}

function getStepActions(step: BusinessStep, answers: BusinessAnswers): ComponentAction[] {
  return [...(step.actions ?? []), ...getChoiceActions(step, answers)];
}

export class BusinessDecisionEngine {
  constructor(private readonly getFamily = getBusinessFamily) {}

  evaluate(state: BusinessDecisionState): BusinessDecisionResult {
    const family = this.getFamily(state.familyId);
    return this.evaluateFamily(family, state.answers);
  }

  evaluateFamily(family: BusinessFamilyDefinition, answers: BusinessAnswers): BusinessDecisionResult {
    const visibleSteps = family.steps.filter((step) => isStepVisible(step, answers));
    const completedRequiredSteps = visibleSteps.filter(
      (step) => step.required && isStepAnswered(step, answers)
    );
    const missingRequiredStepIds = visibleSteps
      .filter((step) => step.required && !isStepAnswered(step, answers))
      .map((step) => step.id);
    const nextStep = visibleSteps.find((step) => !isStepAnswered(step, answers));

    const actions = [
      ...(family.defaultExclusions ?? []),
      ...visibleSteps.flatMap((step) => getStepActions(step, answers)),
    ];

    return {
      family,
      visibleSteps,
      completedRequiredSteps,
      nextStep,
      actions,
      missingRequiredStepIds,
    };
  }
}

export const businessDecisionEngine = new BusinessDecisionEngine();
