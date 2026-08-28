import {
  AGENT_META,
  AGENT_TYPES,
  buildExtractUserPrompt,
  getAgentSystemPrompt,
  buildAgentUserPrompt,
  buildDebateSystemPrompt,
  buildDebateUserPrompt,
  buildJudgeUserPrompt,
} from "../src/prompts.js";

describe("agent roster", () => {
  test("defines exactly the four required personas", () => {
    expect(AGENT_TYPES.sort()).toEqual(
      ["hiring_manager", "hr_culture", "skeptic", "technical"].sort()
    );
  });

  test("every agent has a distinct evaluation lens (no duplicate personas)", () => {
    const lenses = AGENT_TYPES.map((t) => AGENT_META[t].lens);
    expect(new Set(lenses).size).toBe(lenses.length);
  });
});

describe("candidate profile extraction prompt", () => {
  test("embeds both resume and transcript text verbatim", () => {
    const prompt = buildExtractUserPrompt("RESUME_MARKER_123", "TRANSCRIPT_MARKER_456");
    expect(prompt).toContain("RESUME_MARKER_123");
    expect(prompt).toContain("TRANSCRIPT_MARKER_456");
  });
});

describe("agent opinion isolation", () => {
  test("each agent's system prompt is unique (no shared/copy-pasted persona)", () => {
    const prompts = AGENT_TYPES.map((t) => getAgentSystemPrompt(t));
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  test("throws for an unknown agent type instead of silently returning empty", () => {
    expect(() => getAgentSystemPrompt("not_a_real_agent")).toThrow();
  });

  test("agent user prompt is built ONLY from the shared candidate profile, never raw text", () => {
    const profile = { skills: ["Python"], experience: [], claims: [], contradictions: [] };
    const prompt = buildAgentUserPrompt(profile);
    expect(prompt).toContain("Python");
    // Guards the isolation rule: the per-agent prompt builder takes a single
    // profile argument and has no parameter for another agent's opinion.
    expect(buildAgentUserPrompt.length).toBe(1);
  });
});

describe("debate step", () => {
  test("debate prompt requires the agent to address the OTHER agents' opinions, not its own", () => {
    const myOpinion = { verdict: "Hire", confidence: 80, reasoning: "Strong system design.", quotes: [] };
    const others = {
      skeptic: { verdict: "No Hire", confidence: 60, reasoning: "Vague scope claims.", quotes: [] },
    };
    const prompt = buildDebateUserPrompt("technical", myOpinion, others);
    expect(prompt).toContain("Skeptic Agent");
    expect(prompt).toContain("Vague scope claims");
  });

  test("debate system prompt differs per agent type", () => {
    const a = buildDebateSystemPrompt("technical");
    const b = buildDebateSystemPrompt("skeptic");
    expect(a).not.toEqual(b);
  });
});

describe("final judge decision", () => {
  test("judge prompt includes all debated opinions for weighted reasoning", () => {
    const debated = {
      technical: { updatedVerdict: "Hire", updatedConfidence: 85, respondedTo: "skeptic", rebuttal: "Evidence held up.", quotes: [] },
      skeptic: { updatedVerdict: "Hold", updatedConfidence: 55, respondedTo: "technical", rebuttal: "Still cautious.", quotes: [] },
    };
    const prompt = buildJudgeUserPrompt(debated);
    expect(prompt).toContain("Technical Agent");
    expect(prompt).toContain("Skeptic Agent");
    expect(prompt).toContain("85");
    expect(prompt).toContain("55");
  });

  test("throws clearly if given an unknown agent key rather than producing a broken prompt", () => {
    const debated = { not_a_real_agent: { updatedVerdict: "Hire", updatedConfidence: 90 } };
    expect(() => buildJudgeUserPrompt(debated)).toThrow();
  });
});
