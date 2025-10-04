export type Difficulty = \"easy\" | \"medium\" | \"hard\" | \"ugly\";
export type CoeffScale = \"small\" | \"medium\" | \"ugly_rational\" | \"clean_cancel\";
export type MethodBias = \"elimination\" | \"substitution\" | \"matrix\";
export type SolutionType = \"integers\" | \"rationals\" | \"surds\" | \"unique\" | \"none\" | \"infinite\";

export interface TimeTarget {
  twoByTwoSec: number;
  threeByThreeSec: number;
}

export interface SimulSolveControls {
  coeffScale: CoeffScale;
  methodBias: MethodBias;
  solutionPref: \"integers\" | \"rationals\" | \"surds\";
  uniqueness: \"auto\" | \"unique\" | \"none\" | \"infinite\";
  difficulty: Difficulty;
  time: TimeTarget;
}

export interface SimulSolveQuestionMeta {
  archetypeId: string;
  methodHint?: MethodBias;
  tags: string[];
  targetTimeSec: number;
  hasParameters?: boolean;
  trapVariant?: string;
}

export interface LinearAnswer {
  x?: string;
  y?: string;
  z?: string;
  special?: \"none\" | \"infinite\";
  param?: string;
  notes?: string | Record<string, unknown>;
}

export interface MultiSolutionAnswer {
  solutions: Array<Record<string, string>>;
  notes?: string | Record<string, unknown>;
}

export interface RearrangementAnswer {
  isolated: string;
  steps?: string[];
  notes?: string | Record<string, unknown>;
}

export type CanonicalAnswer = LinearAnswer | MultiSolutionAnswer | RearrangementAnswer;

export interface SimulSolveQuestion {
  id: string;
  prompt: string;
  meta: SimulSolveQuestionMeta;
  answer: CanonicalAnswer;
  workingSeed: number;
  methodAllowed: MethodBias[];
}

export interface SimulSolveSkillLadderItem {
  id: string;
  title: string;
  description: string;
  archetypeId: string;
  controls: SimulSolveControls;
  emphasis?: string;
}

export interface SimulSolveAssessmentMode {
  id: \"learn\" | \"practice\" | \"sprint\" | \"exam\" | \"fixit\";
  title: string;
  description: string;
  guidance: string;
}

export interface SimulSolveTopicConfig {
  id: string;
  title: string;
  short: string;
  subModes: SimulSolveAssessmentMode[\"id\"][];
  skillLadder: SimulSolveSkillLadderItem[];
  assessmentModes: SimulSolveAssessmentMode[];
}