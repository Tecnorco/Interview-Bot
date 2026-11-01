// Supported interview roles. Each role carries its own theme, aliases used for
// search validation, starter prompts, and the context injected into the LLM.

export const ROLES = [
  {
    id: 'ai-pm',
    title: 'AI Product Manager',
    short: 'AI PM',
    badge: 'PM',
    tagline: 'Ship AI products people trust — from model capability to customer value.',
    hue: 248, // indigo
    aliases: [
      'ai product manager', 'ai pm', 'aipm', 'pm ai', 'product manager ai',
      'ml product manager', 'machine learning product manager', 'genai product manager',
      'generative ai product manager', 'llm product manager', 'ai product lead',
      'product manager', 'pm', 'technical product manager ai', 'ai tpm',
    ],
    focus: ['Product sense', 'AI evals & metrics', 'Model trade-offs', 'Strategy', 'Execution', 'Responsible AI'],
    starters: [
      'Run a mock product-sense interview with me',
      'How would you define success metrics for an LLM feature?',
      'Give me a framework for AI product strategy questions',
      'What behavioral questions should I expect?',
    ],
    context: `ROLE: AI Product Manager (AI PM)

What the job is: owns AI-powered products end to end — identifying problems where ML/LLMs add real user value, translating model capabilities and limits into product requirements, defining evaluation strategy, partnering with research/engineering, and managing risk (safety, privacy, hallucination, bias, cost).

Typical interview loop:
- Recruiter screen and hiring-manager screen (motivation, AI fluency, past impact)
- Product sense / product design (e.g. "Design an AI assistant for X", "Improve feature Y with LLMs")
- Analytical / metrics (north-star metrics, online vs offline evals, A/B testing for non-deterministic systems, guardrail metrics)
- Technical fluency for AI (LLMs, RAG, fine-tuning vs prompting, latency/cost/quality trade-offs, eval sets, human feedback) — no coding, but must reason credibly with engineers
- Strategy (build vs buy vs partner, platform vs application, moats when models commoditize, pricing with token costs)
- Execution & behavioral (prioritization, stakeholder conflict, shipping under uncertainty, a launch that went wrong)
- Responsible AI (safety mitigations, red-teaming, policy, user trust & transparency)

What strong candidates show: user-first framing, crisp structure (clarify → users → problems → solutions → prioritize → metrics → risks), concrete eval plans, honest treatment of model failure modes, and quantified past impact (STAR stories).`,
  },
  {
    id: 'fde',
    title: 'Forward Deployed Engineer',
    short: 'FDE',
    badge: 'FDE',
    tagline: 'Build with customers in the field — turn messy real-world problems into working AI systems.',
    hue: 172, // teal
    aliases: [
      'forward deployed engineer', 'forward-deployed engineer', 'fde', 'forward deployed software engineer',
      'fdse', 'forward deployed ai engineer', 'deployed engineer', 'deployment engineer',
      'ai deployment engineer', 'field engineer ai', 'solutions engineer ai', 'ai solutions engineer',
      'customer engineer ai', 'applied ai engineer', 'forward engineer',
    ],
    focus: ['Coding', 'System design', 'LLM apps & RAG', 'Customer scenarios', 'Debugging', 'Communication'],
    starters: [
      'Give me a realistic customer-scenario interview',
      'Walk me through designing a RAG system for an enterprise',
      'Give me a practical coding problem FDEs get',
      'How do I talk about ambiguous projects I owned?',
    ],
    context: `ROLE: Forward Deployed Engineer (FDE)

What the job is: a software engineer embedded with customers. Scopes ambiguous business problems, builds production-grade solutions on top of the company's AI platform/models (integrations, data pipelines, LLM apps, agents, evals), unblocks deployments, and feeds field learnings back to product/research. Mix of strong engineering, product judgment and customer-facing communication; often travel and high ownership.

Typical interview loop:
- Recruiter / hiring-manager screen (why FDE, customer-facing experience, ownership)
- Practical coding (realistic tasks over leetcode trivia: parse/transform data, build a small API, call an LLM, handle errors/rate limits; sometimes a take-home or pair-programming)
- System design for AI applications (RAG over enterprise docs, agents with tool use, evaluation harnesses, latency/cost budgets, security, data governance, on-prem/VPC constraints)
- Customer decomposition / case interview (a vague customer ask → clarify goals, stakeholders, data, success criteria, MVP plan, risks)
- Debugging / troubleshooting (a deployment is failing or quality regressed — how do you find out why?)
- Behavioral (ownership, handling difficult customers, pushing back, shipping under pressure, learning fast)

What strong candidates show: bias to action with sound engineering, ability to clarify ambiguity, pragmatic architecture choices, evaluation-driven iteration, clear communication with both executives and engineers, and stories of end-to-end ownership.`,
  },
  {
    id: 'ai-researcher',
    title: 'AI Researcher',
    short: 'Researcher',
    badge: 'RS',
    tagline: 'Push the frontier — from first-principles ML to rigorous experiments.',
    hue: 18, // warm coral/amber
    aliases: [
      'ai researcher', 'ai research scientist', 'research scientist', 'ml researcher',
      'machine learning researcher', 'research scientist ai', 'ai research engineer',
      'research engineer', 'ml research scientist', 'deep learning researcher', 'nlp researcher',
      'llm researcher', 'applied scientist', 'applied research scientist', 'ai scientist', 'researcher',
    ],
    focus: ['ML fundamentals', 'Deep learning & LLMs', 'Math', 'Research taste', 'Paper discussion', 'Coding'],
    starters: [
      'Quiz me on transformer and attention fundamentals',
      'Run a research-discussion interview on my past work',
      'Give me an ML coding question (e.g. implement attention)',
      'How do I answer "what research would you do here?"',
    ],
    context: `ROLE: AI Researcher (Research Scientist / Research Engineer)

What the job is: advances model capabilities, efficiency, alignment or understanding through novel research and rigorous experimentation; designs experiments, trains/evaluates models at scale, writes papers/internal reports, and translates findings into model improvements.

Typical interview loop:
- Recruiter / hiring-manager screen (research interests, fit with team agenda)
- ML fundamentals & math (probability, linear algebra, optimization, generalization, bias-variance, information theory basics)
- Deep learning & LLM depth (transformers, attention variants, tokenization, pretraining objectives, scaling laws, RLHF/RLAIF/DPO, fine-tuning, inference efficiency, interpretability, evals)
- ML coding (implement from scratch in Python/NumPy/PyTorch: attention, a training loop, beam search, backprop for a small net; debugging a broken training run)
- Research discussion / paper deep-dive (present past work: motivation, hypotheses, ablations, what failed, what you'd do next; critique a recent paper)
- Research design / taste ("How would you study X?", proposing experiments, choosing baselines, controlling confounders, compute budgeting)
- Behavioral (collaboration, handling negative results, prioritizing research directions)

What strong candidates show: first-principles reasoning, precise math, clear experimental thinking (hypothesis → minimal experiment → ablations → conclusions), awareness of recent literature, intellectual honesty about limitations, and strong implementation skills.`,
  },
];

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Similarity score between 0 and 1 for a query against one alias. */
function score(query, alias) {
  if (query === alias) return 1;
  if (alias.startsWith(query) && query.length >= 2) return 0.9;
  const dist = levenshtein(query, alias);
  const editSim = 1 - dist / Math.max(query.length, alias.length);
  const qTokens = new Set(query.split(' '));
  const aTokens = new Set(alias.split(' '));
  const overlap = [...qTokens].filter((t) => aTokens.has(t)).length;
  const tokenSim = overlap / Math.max(qTokens.size, aTokens.size);
  return Math.max(editSim, tokenSim * 0.85);
}

/** Ranked role suggestions for a free-text query (used for the autocomplete list). */
export function suggestRoles(query) {
  const q = normalize(query);
  if (!q) return ROLES.map((role) => ({ role, score: 0 }));
  return ROLES.map((role) => ({
    role,
    score: Math.max(...[role.title, role.short, ...role.aliases].map((a) => score(q, normalize(a)))),
  }))
    .filter((r) => r.score >= 0.45)
    .sort((a, b) => b.score - a.score);
}

/**
 * Validate a free-text job role.
 * Returns { valid: true, role } on a confident match,
 * or { valid: false, reason, suggestion? } otherwise.
 */
export function validateRole(query) {
  const q = normalize(query);
  if (!q) return { valid: false, reason: 'Type a job role to get started.' };
  if (q.length < 2) return { valid: false, reason: 'That is too short to be a job role.' };

  // Confident match: exact alias, a meaningful prefix of an alias, or a small typo.
  for (const role of ROLES) {
    for (const alias of [role.title, role.short, ...role.aliases].map(normalize)) {
      if (q === alias) return { valid: true, role };
      if (q.length >= 4 && alias.startsWith(q)) return { valid: true, role };
      if (alias.length >= 6 && levenshtein(q, alias) <= Math.max(1, Math.floor(alias.length / 8))) {
        return { valid: true, role };
      }
    }
  }

  const [best] = suggestRoles(query);
  if (best) {
    return {
      valid: false,
      reason: `"${query.trim()}" isn't a role we support yet.`,
      suggestion: best.role,
    };
  }
  return {
    valid: false,
    reason: `"${query.trim()}" isn't a recognized AI role. Try one of: ${ROLES.map((r) => r.title).join(', ')}.`,
  };
}

export const getRole = (id) => ROLES.find((r) => r.id === id);
