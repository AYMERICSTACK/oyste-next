import type { BusinessAnswers, BusinessStep, BusinessStepCondition } from "../types";

function conditionMatches(condition: BusinessStepCondition, answers: BusinessAnswers) {
  const value = answers[condition.answerId];

  if (condition.equals !== undefined && value !== condition.equals) return false;
  if (condition.notEquals !== undefined && value === condition.notEquals) return false;

  if (condition.includes !== undefined) {
    if (!Array.isArray(value)) return false;
    if (!value.includes(condition.includes)) return false;
  }

  return true;
}

export function isStepVisible(step: BusinessStep, answers: BusinessAnswers) {
  if (step.clientVisible === false) return false;
  if (!step.showWhen?.length) return true;

  return step.showWhen.every((condition) => conditionMatches(condition, answers));
}

export function isStepAnswered(step: BusinessStep, answers: BusinessAnswers) {
  const value = answers[step.id];

  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== "";
}
