import { SimulSolveAssessmentMode, SimulSolveControls, SimulSolveSkillLadderItem, TimeTarget } from "./types";

export const DEFAULT_TIME_TARGET: TimeTarget = {
  twoByTwoSec: 20,
  threeByThreeSec: 30,
};

export const DEFAULT_SIMULSOLVE_CONTROLS: SimulSolveControls = {
  coeffScale: "small",
  methodBias: "elimination",
  solutionPref: "integers",
  uniqueness: "auto",
  difficulty: "easy",
  time: { ...DEFAULT_TIME_TARGET },
};

function mergeControls(partial: Partial<SimulSolveControls>): SimulSolveControls {
  return {
    ...DEFAULT_SIMULSOLVE_CONTROLS,
    ...partial,
    time: {
      ...DEFAULT_TIME_TARGET,
      ...DEFAULT_SIMULSOLVE_CONTROLS.time,
      ...(partial.time ?? {}),
    },
  };
}

export const skillLadder: SimulSolveSkillLadderItem[] = [
  {
    id: "simulsolve/rearrange_micro",
    title: "Rearrangement micro-drills",
    description: "One-symbol isolation reps (10–20 s).",
    archetypeId: "simulsolve/rearrange_micro",
    controls: mergeControls({
      coeffScale: "small",
      methodBias: "substitution",
      difficulty: "easy",
      time: { twoByTwoSec: 12, threeByThreeSec: 20 },
    }),
    emphasis: "Micro isolations, keep the timer honest.",
  },
  {
    id: "simulsolve/2x2_linear_clean",
    title: "2×2 clean",
    description: "Designed cancellation; integer solutions.",
    archetypeId: "simulsolve/2x2_linear_clean",
    controls: mergeControls({
      coeffScale: "clean_cancel",
      methodBias: "elimination",
      difficulty: "easy",
      time: { twoByTwoSec: 18, threeByThreeSec: 28 },
    }),
    emphasis: "Eliminate in two moves; check cancellation traps.",
  },
  {
    id: "simulsolve/2x2_linear_general",
    title: "2×2 general",
    description: "Fractions + LCM judgement.",
    archetypeId: "simulsolve/2x2_linear_general",
    controls: mergeControls({
      coeffScale: "medium",
      methodBias: "elimination",
      solutionPref: "rationals",
      difficulty: "medium",
      time: { twoByTwoSec: 22, threeByThreeSec: 30 },
    }),
    emphasis: "Keep denominators sane; decide elimination vs substitution quickly.",
  },
  {
    id: "simulsolve/3x3_triangularizable",
    title: "3×3 triangularizable",
    description: "One obvious elimination path.",
    archetypeId: "simulsolve/3x3_triangularizable",
    controls: mergeControls({
      coeffScale: "small",
      methodBias: "elimination",
      difficulty: "medium",
      time: { twoByTwoSec: 22, threeByThreeSec: 36 },
    }),
    emphasis: "Push to upper-triangular fast.",
  },
  {
    id: "simulsolve/3x3_general",
    title: "3×3 general",
    description: "Pivot choices; avoid fraction blow-up.",
    archetypeId: "simulsolve/3x3_general",
    controls: mergeControls({
      coeffScale: "medium",
      methodBias: "matrix",
      solutionPref: "rationals",
      difficulty: "hard",
      time: { twoByTwoSec: 24, threeByThreeSec: 42 },
    }),
    emphasis: "Pick pivots; rationals acceptable.",
  },
  {
    id: "simulsolve/mixed_line_circle",
    title: "Non-linear pairs (line–circle)",
    description: "Substitute + square completion reps.",
    archetypeId: "simulsolve/mixed_line_circle",
    controls: mergeControls({
      coeffScale: "small",
      methodBias: "substitution",
      solutionPref: "rationals",
      difficulty: "medium",
      time: { twoByTwoSec: 25, threeByThreeSec: 38 },
    }),
    emphasis: "Complete the square calmly; watch symmetric pairs.",
  },
  {
    id: "simulsolve/parameterised_rank",
    title: "Parameterised systems",
    description: "Determinant / rank judgement.",
    archetypeId: "simulsolve/parameterised_rank",
    controls: mergeControls({
      coeffScale: "small",
      methodBias: "matrix",
      solutionPref: "rationals",
      difficulty: "hard",
      uniqueness: "auto",
      time: { twoByTwoSec: 26, threeByThreeSec: 40 },
    }),
    emphasis: "Classify a-values first, then solve.",
  },
];

export const assessmentModes: SimulSolveAssessmentMode[] = [
  {
    id: "learn",
    title: "Learn",
    description: "Full hints, soft timer windows.",
    guidance: "Pause after each elimination and annotate the method bias chosen.",
  },
  {
    id: "practice",
    title: "Practice",
    description: "Light hints, target times active.",
    guidance: "Stick to ladder rung defaults; reset timer if algebra slips.",
  },
  {
    id: "sprint",
    title: "Sprint",
    description: "Short mixed set, answer-only flow.",
    guidance: "Keep notes off-screen; commit to first viable method.",
  },
  {
    id: "exam",
    title: "Exam",
    description: "Strict timing, no hints.",
    guidance: "Lock in the assessment mix – expect pivots + non-linear pairs.",
  },
  {
    id: "fixit",
    title: "Fix-it",
    description: "Pulls the last-missed tags only.",
    guidance: "Retry the archetypes you flagged; micro-step review allowed.",
  },
];

export const SIMULSOLVE_SUB_MODES = assessmentModes.map((mode) => mode.id);

export function cloneControls(value: SimulSolveControls): SimulSolveControls {
  return {
    ...value,
    time: { ...value.time },
  };
}