
import {
  CanonicalAnswer,
  MethodBias,
  SimulSolveControls,
  SimulSolveQuestion,
} from "./types";
import { DEFAULT_SIMULSOLVE_CONTROLS } from "./presets";

type Fraction = { num: number; den: number };
type FractionRecord = Record<string, Fraction>;

const ZERO_FRACTION: Fraction = { num: 0, den: 1 };
function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function lcmSmall(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs((a * b) / gcd(a, b));
}

export function seededRng(seed: number): () => number {
  let state = Math.floor(seed) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function rngInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function nonZeroInt(rng: () => number, min: number, max: number): number {
  let value = 0;
  while (value === 0) {
    value = rngInt(rng, min, max);
  }
  return value;
}

function rngChoice<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

export function toFrac(value: number): Fraction {
  if (!Number.isFinite(value)) return { num: 0, den: 1 };
  if (Number.isInteger(value)) return { num: value, den: 1 };
  const str = value.toString();
  if (/e/i.test(str)) {
    const [mantissa, exponentPart] = str.split(/e/i);
    const exponent = Number(exponentPart);
    const base = Number(mantissa);
    return toFrac(base * Math.pow(10, exponent));
  }
  const [intPart, decimalPart = ""] = str.split(".");
  const digits = decimalPart.length;
  const den = Math.pow(10, digits);
  const num = Math.round(value * den);
  return simplifyFrac({ num, den });
}

export function simplifyFrac(frac: Fraction): Fraction {
  if (!Number.isFinite(frac.num) || !Number.isFinite(frac.den) || frac.den === 0) {
    return { num: 0, den: 1 };
  }
  if (frac.num === 0) return { num: 0, den: 1 };
  const common = gcd(frac.num, frac.den);
  let num = frac.num / common;
  let den = frac.den / common;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  return { num, den };
}

export function fracToString(frac: Fraction): string {
  const simplified = simplifyFrac(frac);
  if (simplified.den === 1) return String(simplified.num);
  return `${simplified.num}/${simplified.den}`;
}

function addFrac(a: Fraction, b: Fraction): Fraction {
  return simplifyFrac({ num: a.num * b.den + b.num * a.den, den: a.den * b.den });
}

function subFrac(a: Fraction, b: Fraction): Fraction {
  return simplifyFrac({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
}

function mulFrac(a: Fraction, b: Fraction): Fraction {
  return simplifyFrac({ num: a.num * b.num, den: a.den * b.den });
}

function cloneControls(controls?: SimulSolveControls): SimulSolveControls {
  const base = controls ?? DEFAULT_SIMULSOLVE_CONTROLS;
  return {
    ...base,
    time: { ...base.time },
  };
}

function shuffleInPlace<T>(rng: () => number, list: T[]): void {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

type Term = { sign: "+" | "-"; body: string };

function makeTerm(frac: Fraction, variable: string): Term | null {
  const simplified = simplifyFrac(frac);
  if (simplified.num === 0) return null;
  const sign: "+" | "-" = simplified.num < 0 ? "-" : "+";
  const absNum = Math.abs(simplified.num);
  const { den } = simplified;
  let body: string;
  if (den === 1 && absNum === 1) {
    body = variable;
  } else if (den === 1) {
    body = `${absNum}${variable}`;
  } else {
    body = `${absNum}/${den} ${variable}`;
  }
  return { sign, body };
}

function joinTerms(terms: Term[]): string {
  if (!terms.length) return "0";
  return terms
    .map((term, index) => {
      if (index === 0) {
        return term.sign === "-" ? `-${term.body}` : term.body;
      }
      return `${term.sign === "+" ? "+" : "-"} ${term.body}`;
    })
    .join(" ");
}

function formatConstant(frac: Fraction): string {
  const simplified = simplifyFrac(frac);
  if (simplified.den === 1) return String(simplified.num);
  return `${simplified.num}/${simplified.den}`;
}

function formatLinearEquation(
  rng: () => number,
  coeffs: FractionRecord,
  constant: Fraction,
  variables: string[],
): string {
  const order = [...variables];
  shuffleInPlace(rng, order);
  const terms: Term[] = [];
  order.forEach((variable) => {
    const coeff = coeffs[variable] ?? ZERO_FRACTION;
    const term = makeTerm(coeff, variable);
    if (term) terms.push(term);
  });

  const left = joinTerms(terms);
  const right = formatConstant(constant);

  const variant = rngInt(rng, 0, 2);
  if (variant === 0) return `${left} = ${right}`;
  if (variant === 1) return `${right} = ${left}`;
  return `${left} - ${right} = 0`;
}

function buildLinearPrompt(intro: string, equations: string[]): string {
  const lines = equations.map((eq, index) => `${index + 1}) ${eq}`);
  return `${intro}\n${lines.join("\n")}`;
}

function fractionsFromSolution(solution: Record<string, number | Fraction>): FractionRecord {
  const entries: FractionRecord = {};
  Object.entries(solution).forEach(([key, value]) => {
    entries[key] = typeof value === "number" ? toFrac(value) : simplifyFrac(value);
  });
  return entries;
}

function evaluateConstant(coeffs: FractionRecord, solution: FractionRecord): Fraction {
  return Object.entries(coeffs).reduce((acc, [variable, coeff]) => {
    const sol = solution[variable] ?? ZERO_FRACTION;
    return addFrac(acc, mulFrac(coeff, sol));
  }, ZERO_FRACTION);
}

function buildLinearAnswer(solution: FractionRecord): CanonicalAnswer {
  const response: Record<string, string> = {};
  Object.entries(solution).forEach(([key, value]) => {
    response[key] = fracToString(value);
  });
  return response;
}

function normaliseMethods(methods: MethodBias[]): MethodBias[] {
  const seen = new Set<MethodBias>();
  const ordered: MethodBias[] = [];
  methods.forEach((method) => {
    if (!method) return;
    if (!seen.has(method)) {
      seen.add(method);
      ordered.push(method);
    }
  });
  return ordered;
}
const REARRANGE_BANK: Array<{ formula: string; target: string; isolated: string; steps?: string[] }> = [
  {
    formula: "ax + by = c",
    target: "x",
    isolated: "x = (c - by) / a",
    steps: ["subtract by", "divide by a"],
  },
  {
    formula: "ax + by = c",
    target: "y",
    isolated: "y = (c - ax) / b",
    steps: ["subtract ax", "divide by b"],
  },
  {
    formula: "x^2 + y^2 + Dx + Ey + F = 0",
    target: "centre and radius",
    isolated: "centre (-D/2, -E/2), r = sqrt((D^2 + E^2)/4 - F)",
    steps: ["complete the square", "identify centre", "radius from constant"],
  },
  {
    formula: "1/f = 1/u + 1/v",
    target: "v",
    isolated: "v = 1 / (1/f - 1/u)",
    steps: ["move 1/u", "reciprocate"],
  },
  {
    formula: "pV = nRT",
    target: "T",
    isolated: "T = pV / (nR)",
  },
  {
    formula: "v = f lambda",
    target: "f",
    isolated: "f = v / lambda",
  },
  {
    formula: "P = IV",
    target: "I",
    isolated: "I = P / V",
  },
  {
    formula: "P = IV",
    target: "V",
    isolated: "V = P / I",
  },
  {
    formula: "P = I^2 R",
    target: "I",
    isolated: "I = sqrt(P / R)",
  },
  {
    formula: "P = I^2 R",
    target: "R",
    isolated: "R = P / I^2",
  },
  {
    formula: "P = V^2 / R",
    target: "V",
    isolated: "V = sqrt(P R)",
  },
  {
    formula: "P = V^2 / R",
    target: "R",
    isolated: "R = V^2 / P",
  },
  {
    formula: "F_x = m a_x",
    target: "a_x",
    isolated: "a_x = F_x / m",
  },
  {
    formula: "f = 1/T",
    target: "T",
    isolated: "T = 1 / f",
  },
];

const LINE_CIRCLE_CASES = [
  {
    line: "x + y = 4",
    circle: "x^2 + y^2 = 10",
    solutions: [
      { x: { num: 1, den: 1 }, y: { num: 3, den: 1 } },
      { x: { num: 3, den: 1 }, y: { num: 1, den: 1 } },
    ],
    tags: ["symmetric"],
  },
  {
    line: "x - y = 1",
    circle: "x^2 + y^2 = 13",
    solutions: [
      { x: { num: 3, den: 1 }, y: { num: 2, den: 1 } },
      { x: { num: -2, den: 1 }, y: { num: -3, den: 1 } },
    ],
    tags: ["offset"],
  },
  {
    line: "2x + y = 7",
    circle: "x^2 + y^2 = 13",
    solutions: [
      { x: { num: 2, den: 1 }, y: { num: 3, den: 1 } },
      { x: { num: 3, den: 1 }, y: { num: 1, den: 1 } },
    ],
    tags: ["oblique"],
  },
];

const LINE_PARABOLA_CASES = [
  {
    line: "y = x + 2",
    parabola: "y = x^2 - 3x + 5",
    solutions: [
      { x: { num: 1, den: 1 }, y: { num: 3, den: 1 } },
      { x: { num: 3, den: 1 }, y: { num: 5, den: 1 } },
    ],
  },
  {
    line: "y = 2x - 2",
    parabola: "y = x^2 - 4x + 6",
    solutions: [
      { x: { num: 2, den: 1 }, y: { num: 2, den: 1 } },
      { x: { num: 4, den: 1 }, y: { num: 6, den: 1 } },
    ],
  },
  {
    line: "y = -x + 6",
    parabola: "y = x^2 - 5x + 8",
    solutions: [
      { x: { num: 2, den: 1 }, y: { num: 4, den: 1 } },
      { x: { num: 4, den: 1 }, y: { num: 2, den: 1 } },
    ],
  },
];

const QUAD_QUAD_CASES = [
  {
    eq1: "(x - 2)(x - 4) = 0",
    eq2: "(y - 1)(y - 3) = 0",
    solutions: [
      { x: { num: 2, den: 1 }, y: { num: 1, den: 1 } },
      { x: { num: 2, den: 1 }, y: { num: 3, den: 1 } },
      { x: { num: 4, den: 1 }, y: { num: 1, den: 1 } },
      { x: { num: 4, den: 1 }, y: { num: 3, den: 1 } },
    ],
  },
  {
    eq1: "(x + 1)(x - 3) = 0",
    eq2: "(y - 2)(y - 4) = 0",
    solutions: [
      { x: { num: -1, den: 1 }, y: { num: 2, den: 1 } },
      { x: { num: -1, den: 1 }, y: { num: 4, den: 1 } },
      { x: { num: 3, den: 1 }, y: { num: 2, den: 1 } },
      { x: { num: 3, den: 1 }, y: { num: 4, den: 1 } },
    ],
  },
];

const EXP_LOG_CASES = [
  {
    description: "exponential sum",
    equations: ["2^x = y", "x + y = 6"],
    solutions: [
      { x: { num: 2, den: 1 }, y: { num: 4, den: 1 } },
    ],
    tags: ["exp"],
  },
  {
    description: "exponential offset",
    equations: ["3^x = y + 6", "x + y = 5"],
    solutions: [
      { x: { num: 2, den: 1 }, y: { num: 3, den: 1 } },
    ],
    tags: ["exp"],
  },
  {
    description: "log linear mix",
    equations: ["log_2(x) + y = 5", "y = x - 1"],
    solutions: [
      { x: { num: 4, den: 1 }, y: { num: 3, den: 1 } },
    ],
    tags: ["log"],
  },
];

const MODULUS_CASES = [
  {
    modulus: "|2x - y| = 4",
    line: "x + y = 10",
    cases: [
      {
        label: "Case A (positive)",
        equation: "2x - y = 4",
        solution: { x: { num: 14, den: 3 }, y: { num: 16, den: 3 } },
      },
      {
        label: "Case B (negative)",
        equation: "2x - y = -4",
        solution: { x: { num: 2, den: 1 }, y: { num: 8, den: 1 } },
      },
    ],
  },
  {
    modulus: "|x - 3y| = 5",
    line: "x + y = 7",
    cases: [
      {
        label: "Case A (positive)",
        equation: "x - 3y = 5",
        solution: { x: { num: 8, den: 1 }, y: { num: -1, den: 1 } },
      },
      {
        label: "Case B (negative)",
        equation: "x - 3y = -5",
        solution: { x: { num: 1, den: 1 }, y: { num: 2, den: 1 } },
      },
    ],
  },
];
function formatMultiSolution(solutions: Array<Record<string, Fraction>>): CanonicalAnswer {
  return {
    solutions: solutions.map((solution) => {
      const entry: Record<string, string> = {};
      Object.entries(solution).forEach(([key, value]) => {
        entry[key] = fracToString(value);
      });
      return entry;
    }),
  };
}
export function generate_2x2_linear_clean(
  controls: SimulSolveControls,
  seed: number,
): SimulSolveQuestion {
  const applied = cloneControls(controls);
  const rng = seededRng(seed);

  const solution = fractionsFromSolution({
    x: { num: nonZeroInt(rng, -5, 5), den: 1 },
    y: { num: rngInt(rng, -5, 5) || 2, den: 1 },
  });

  const pivotVariable = rngChoice(rng, ["x", "y"] as const);
  const base = nonZeroInt(rng, 2, applied.coeffScale === "clean_cancel" ? 6 : 9);
  const sign = rng() < 0.5 ? 1 : -1;

  let coeff1: FractionRecord;
  let coeff2: FractionRecord;

  const other1 = toFrac(nonZeroInt(rng, -6, 6));
  const other2 = toFrac(nonZeroInt(rng, -6, 6));

  if (pivotVariable === "x") {
    coeff1 = { x: toFrac(base * sign), y: other1 };
    coeff2 = { x: toFrac(-base * sign), y: other2 };
  } else {
    coeff1 = { x: other1, y: toFrac(base * sign) };
    coeff2 = { x: other2, y: toFrac(-base * sign) };
  }

  const constant1 = evaluateConstant(coeff1, solution);
  const constant2 = evaluateConstant(coeff2, solution);

  const eq1 = formatLinearEquation(rng, coeff1, constant1, ["x", "y"]);
  const eq2 = formatLinearEquation(rng, coeff2, constant2, ["x", "y"]);

  const otherVar = pivotVariable === "x" ? "y" : "x";
  const sameMagnitude = Math.abs(coeff1[otherVar]?.num ?? 0) === Math.abs(coeff2[otherVar]?.num ?? 0);

  const tags = ["2x2", "clean", pivotVariable === "x" ? "cancel-x" : "cancel-y", "elimination"];
  if (sameMagnitude) tags.push("trap-symmetric");

  return {
    id: `simulsolve-2x2-linear-clean-${seed}`,
    prompt: buildLinearPrompt("Solve the simultaneous system:", [eq1, eq2]),
    meta: {
      archetypeId: "simulsolve/2x2_linear_clean",
      methodHint: "elimination",
      tags,
      targetTimeSec: applied.time.twoByTwoSec,
      trapVariant: sameMagnitude ? "mirror-coefficient" : undefined,
    },
    answer: buildLinearAnswer(solution),
    workingSeed: seed,
    methodAllowed: normaliseMethods([applied.methodBias, "elimination", "substitution", "matrix"]),
  };
}
export function generate_2x2_linear_general(
  controls: SimulSolveControls,
  seed: number,
): SimulSolveQuestion {
  const applied = cloneControls(controls);
  const rng = seededRng(seed);

  const solution = fractionsFromSolution({
    x: { num: nonZeroInt(rng, -6, 6), den: rngInt(rng, 1, 4) },
    y: { num: nonZeroInt(rng, -6, 6), den: rngInt(rng, 1, 4) },
  });

  let coeff1: FractionRecord;
  let coeff2: FractionRecord;
  let determinant: Fraction;

  do {
    coeff1 = {
      x: toFrac(nonZeroInt(rng, -6, 6)),
      y: toFrac(nonZeroInt(rng, -6, 6)),
    };
    coeff2 = {
      x: toFrac(nonZeroInt(rng, -6, 6)),
      y: toFrac(nonZeroInt(rng, -6, 6)),
    };
    determinant = subFrac(mulFrac(coeff1.x, coeff2.y), mulFrac(coeff1.y, coeff2.x));
  } while (determinant.num === 0);

  const constant1 = evaluateConstant(coeff1, solution);
  const constant2 = evaluateConstant(coeff2, solution);

  const eq1 = formatLinearEquation(rng, coeff1, constant1, ["x", "y"]);
  const eq2 = formatLinearEquation(rng, coeff2, constant2, ["x", "y"]);

  const denominatorMix = lcmSmall(coeff1.x.den * coeff1.y.den, coeff2.x.den * coeff2.y.den);
  const tags = ["2x2", "general", "fraction", "elimination"];
  if (denominatorMix > 20) tags.push("trap-lcm");

  return {
    id: `simulsolve-2x2-linear-general-${seed}`,
    prompt: buildLinearPrompt("Solve the system (general coefficients):", [eq1, eq2]),
    meta: {
      archetypeId: "simulsolve/2x2_linear_general",
      methodHint: applied.methodBias,
      tags,
      targetTimeSec: applied.time.twoByTwoSec + 2,
    },
    answer: buildLinearAnswer(solution),
    workingSeed: seed,
    methodAllowed: normaliseMethods([applied.methodBias, "elimination", "substitution", "matrix"]),
  };
}
export function generate_3x3_triangularizable(
  controls: SimulSolveControls,
  seed: number,
): SimulSolveQuestion {
  const applied = cloneControls(controls);
  const rng = seededRng(seed);

  const solution = fractionsFromSolution({
    x: { num: rngInt(rng, -4, 4) || 2, den: 1 },
    y: { num: rngInt(rng, -4, 4) || -3, den: 1 },
    z: { num: nonZeroInt(rng, -5, 5), den: 1 },
  });

  const coeff3 = { x: toFrac(0), y: toFrac(0), z: toFrac(nonZeroInt(rng, 2, 6)) };
  const coeff2 = { x: toFrac(0), y: toFrac(nonZeroInt(rng, 1, 6)), z: toFrac(rngInt(rng, -4, 4)) };
  const coeff1 = {
    x: toFrac(nonZeroInt(rng, 1, 5)),
    y: toFrac(rngInt(rng, -4, 4)),
    z: toFrac(rngInt(rng, -3, 3)),
  };

  const eq1 = formatLinearEquation(rng, coeff1, evaluateConstant(coeff1, solution), ["x", "y", "z"]);
  const eq2 = formatLinearEquation(rng, coeff2, evaluateConstant(coeff2, solution), ["x", "y", "z"]);
  const eq3 = formatLinearEquation(rng, coeff3, evaluateConstant(coeff3, solution), ["x", "y", "z"]);

  return {
    id: `simulsolve-3x3-triangular-${seed}`,
    prompt: buildLinearPrompt("Solve the 3x3 system (upper-triangular path):", [eq1, eq2, eq3]),
    meta: {
      archetypeId: "simulsolve/3x3_triangularizable",
      methodHint: "elimination",
      tags: ["3x3", "triangular", "elimination"],
      targetTimeSec: applied.time.threeByThreeSec,
    },
    answer: buildLinearAnswer(solution),
    workingSeed: seed,
    methodAllowed: normaliseMethods(["elimination", applied.methodBias, "matrix", "substitution"]),
  };
}
function det3(matrix: number[][]): number {
  const [a, b, c] = matrix;
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0])
  );
}

export function generate_3x3_general(
  controls: SimulSolveControls,
  seed: number,
): SimulSolveQuestion {
  const applied = cloneControls(controls);
  const rng = seededRng(seed);

  const solution = fractionsFromSolution({
    x: { num: rngInt(rng, -3, 4) || 1, den: 1 },
    y: { num: rngInt(rng, -4, 4) || -2, den: 1 },
    z: { num: rngInt(rng, -3, 5) || 3, den: 1 },
  });

  let rows: number[][];
  do {
    rows = [
      [nonZeroInt(rng, -5, 5), rngInt(rng, -4, 4), rngInt(rng, -4, 4)],
      [rngInt(rng, -4, 4), nonZeroInt(rng, -5, 5), rngInt(rng, -4, 4)],
      [rngInt(rng, -4, 4), rngInt(rng, -4, 4), nonZeroInt(rng, -5, 5)],
    ];
  } while (det3(rows) === 0);

  const coeffs = rows.map((row) => ({ x: toFrac(row[0]), y: toFrac(row[1]), z: toFrac(row[2]) }));
  const constants = coeffs.map((coeff) => evaluateConstant(coeff, solution));

  const eqs = coeffs.map((coeff, index) => formatLinearEquation(rng, coeff, constants[index], ["x", "y", "z"]));

  const zeroPivot = rows.some((row) => row.filter((value) => value !== 0).length < 3);

  return {
    id: `simulsolve-3x3-general-${seed}`,
    prompt: buildLinearPrompt("Solve the 3x3 system:", eqs),
    meta: {
      archetypeId: "simulsolve/3x3_general",
      methodHint: "matrix",
      tags: ["3x3", "general", zeroPivot ? "trap-pivot" : "pivot"],
      targetTimeSec: applied.time.threeByThreeSec + 4,
      trapVariant: zeroPivot ? "requires-swaps" : undefined,
    },
    answer: buildLinearAnswer(solution),
    workingSeed: seed,
    methodAllowed: normaliseMethods(["matrix", applied.methodBias, "elimination"]),
  };
}
export function generate_mixed_line_circle(
  controls: SimulSolveControls,
  seed: number,
): SimulSolveQuestion {
  const rng = seededRng(seed);
  const applied = cloneControls(controls);
  const scenario = rngChoice(rng, LINE_CIRCLE_CASES);

  const eqs = rng() < 0.5 ? [scenario.circle, scenario.line] : [scenario.line, scenario.circle];
  const prompt = buildLinearPrompt("Solve the non-linear pair:", eqs);

  return {
    id: `simulsolve-line-circle-${seed}`,
    prompt,
    meta: {
      archetypeId: "simulsolve/mixed_line_circle",
      methodHint: "substitution",
      tags: ["nonlinear", "line-circle", ...scenario.tags],
      targetTimeSec: applied.time.twoByTwoSec + 6,
    },
    answer: formatMultiSolution(scenario.solutions),
    workingSeed: seed,
    methodAllowed: normaliseMethods(["substitution", applied.methodBias, "elimination"]),
  };
}
export function generate_mixed_line_parabola(
  controls: SimulSolveControls,
  seed: number,
): SimulSolveQuestion {
  const rng = seededRng(seed);
  const applied = cloneControls(controls);
  const scenario = rngChoice(rng, LINE_PARABOLA_CASES);

  const prompt = buildLinearPrompt("Solve the line-parabola system:", [scenario.line, scenario.parabola]);

  return {
    id: `simulsolve-line-parabola-${seed}`,
    prompt,
    meta: {
      archetypeId: "simulsolve/mixed_line_parabola",
      methodHint: "substitution",
      tags: ["nonlinear", "line-parabola"],
      targetTimeSec: applied.time.twoByTwoSec + 6,
    },
    answer: formatMultiSolution(scenario.solutions),
    workingSeed: seed,
    methodAllowed: normaliseMethods(["substitution", applied.methodBias]),
  };
}
