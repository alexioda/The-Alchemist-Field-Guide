// api/pattern-analysis.js
// Vercel serverless function — reads a full Field Guide session and returns
// a clinical pattern analysis + gap identification.
//
// Uses the same ADAPTIV_MIND identity and containsCrisisLanguage as generate-decree.js.
// Requires: GEMINI_API_KEY (already set in Vercel from SCC deployment).

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { ADAPTIV_MIND, containsCrisisLanguage } = require("../lib/adaptiv-mind");

const ALLOWED_ORIGINS = [
  "https://liveadaptiv.com",
  "https://sovereign.liveadaptiv.com",
  "https://alchemist.liveadaptiv.com",
  "http://localhost:3000"
];

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin && origin.endsWith(".vercel.app")) return true;
  return false;
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";

  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: "Forbidden. Invalid Origin." });
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    archetype,
    friction_entry,
    somatic,
    mental_loop,
    reframe,
    core_fear,
    sovereign_pivot,
    stillness,
    golden_shadow,
    commitment_action,
    commitment_by,
    friction_exit
  } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  if (!core_fear?.trim() && !sovereign_pivot?.trim()) {
    return res.status(400).json({ error: "Insufficient session data for analysis." });
  }

  // Crisis check across the full session — same function as SCC
  const fullText = [
    somatic, mental_loop, reframe, core_fear,
    sovereign_pivot, stillness, golden_shadow,
    commitment_action, commitment_by
  ].filter(Boolean).join(' ');

  if (containsCrisisLanguage(fullText)) {
    console.warn("Crisis language detected in Field Guide session — safe exit triggered");
    return res.status(200).json({
      crisis: true,
      message: "The system is quiet right now. Your word is enough. If you are carrying a weight heavier than stress, please reach out to someone you trust — or dial 988."
    });
  }

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ];

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // ── PASS 1: Extract structural pattern from raw session ─────────
    // Low temperature — clinical extraction, not creativity.
    // mirrors the preprocessing pass in generate-decree.js
    const extractModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
      generationConfig: {
        temperature: 0.15,
        responseMimeType: "application/json"
      }
    });

    const frictionDelta = (friction_entry ?? 5) - (friction_exit ?? 5);
    const frictionNote = frictionDelta > 0
      ? `Friction dropped ${frictionDelta} points — the session metabolized something.`
      : frictionDelta < 0
      ? `Friction increased ${Math.abs(frictionDelta)} points — the session surfaced something unresolved.`
      : 'Friction held steady — the session named it without yet shifting it.';

    const extractPrompt = `${ADAPTIV_MIND}

You are now running the Pattern Extraction pass for the Alchemist Field Guide — a deep-session protocol, not the daily reset tool.

Read this completed seven-cycle session in full. Your job is to identify the structural pattern beneath the content — not to summarize what the person wrote, but to name the mechanism underneath.

SESSION DATA:
Archetype: ${archetype || 'Not selected'}
Friction entry: ${friction_entry ?? 5}/10
Somatic signal: ${somatic || 'Not provided'}
Mental loop (fiction): ${mental_loop || 'Not provided'}
Cognitive reframe (fact): ${reframe || 'Not provided'}
Core fear: ${core_fear || 'Not provided'}
Sovereign pivot: ${sovereign_pivot || 'Not provided'}
Stillness insight: ${stillness || 'Not provided'}
Golden shadow: ${golden_shadow || 'Not provided'}
Commitment: ${commitment_action || 'Not provided'} — by ${commitment_by || 'Not provided'}
Friction exit: ${friction_exit ?? 5}/10
${frictionNote}

Extract with clinical precision:

1. FEAR_CORE: The actual mechanism beneath the named fear. Not their words — the structural force driving it. One sentence.
2. PIVOT_CORE: What the sovereign pivot is actually doing — confronting, redirecting, protecting, or bypassing the fear. One sentence.
3. CONGRUENT: true if the pivot directly addresses the fear mechanism. false if it routes around it.
4. PATTERN_LABEL: The pattern type in two words maximum. Examples: "avoidance loop", "control collapse", "identity displacement", "perfectionism mask", "congruent confrontation", "fixer trap", "speed avoidance".

Return ONLY valid JSON, no preamble, no markdown:
{
  "fear_core": "...",
  "pivot_core": "...",
  "congruent": true,
  "pattern_label": "..."
}`;

    let extracted = {
      fear_core: core_fear || '',
      pivot_core: sovereign_pivot || '',
      congruent: true,
      pattern_label: 'unnamed pattern',
    };

    try {
      const extractResult = await extractModel.generateContent(extractPrompt);
      const rawJson = extractResult.response.text();
      extracted = JSON.parse(rawJson);
    } catch (e) {
      console.warn("Extraction pass failed — proceeding with raw inputs:", e?.message);
    }

    // ── PASS 2: Write the clinical analysis in LiveAdaptiv voice ────
    // mirrors the decree generation pass — same identity, same voice rules,
    // but the output is pattern analysis, not a personal declaration
    const analysisModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 300,
        responseMimeType: "application/json"
      }
    });

    const analysisPrompt = `${ADAPTIV_MIND}

You are now running the Pattern Recognition output for the Alchemist Field Guide.

A seven-cycle session has been completed and pre-processed. Your job is surgical: name the pattern and name the gap. This is the output that justifies the depth of the protocol. It must be worth reading.

EXTRACTED PATTERN (from pre-processing pass):
Fear core: ${extracted.fear_core}
Pivot core: ${extracted.pivot_core}
Congruent: ${extracted.congruent}
Pattern type: ${extracted.pattern_label}

RAW SESSION ANCHORS:
Archetype: ${archetype || 'Not selected'}
Core fear (their words): ${core_fear || 'Not provided'}
Sovereign pivot (their words): ${sovereign_pivot || 'Not provided'}
Commitment: ${commitment_action || '—'} by ${commitment_by || '—'}
${frictionNote}

YOUR OUTPUT — two parts:

ANALYSIS: 2–4 sentences. Name the actual pattern — the relationship between the fear mechanism and what the pivot is doing about it. If the pivot is congruent, name what it costs them to hold that position. If it sidesteps the fear, name precisely what it is protecting. Do not summarize their words. Interpret the structure. This is the reading a skilled clinician would give after sitting with the full session.

GAP: 1–2 sentences. The one unresolved tension — the specific place where the commitment and the fear are not yet aligned. What will they need to return to? This is not encouragement. This is the next session's opening.

ABSOLUTE VOICE RULES:
- Short declarative sentences. No hedging. No "it seems" or "perhaps" or "one might."
- No therapeutic softening. No validation language.
- Third person or impersonal — write about the pattern, never directly at the client ("the pivot does X" not "you are doing X").
- All constraints from the core identity apply: no forbidden words, no affirmations, no questions at the end.
- The analysis should feel like something a skilled practitioner would say quietly after reviewing the full session — not a summary, a reading.

Respond ONLY with valid JSON, no preamble, no markdown fences:
{"analysis": "...", "gap": "..."}`;

    const analysisResult = await analysisModel.generateContent(analysisPrompt);
    const rawJson = analysisResult.response.text();

    let parsed;
    try {
      const clean = rawJson.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.warn("Analysis JSON parse failed:", rawJson);
      // Return raw text rather than blank screen
      return res.status(200).json({ analysis: rawJson, gap: null });
    }

    return res.status(200).json({
      analysis: parsed.analysis || '',
      gap: parsed.gap || null,
    });

  } catch (error) {
    console.error("Pattern analysis error:", error?.message || error);

    // Archetype-matched fallbacks in Alex voice — never leave the screen blank
    const fallbacks = {
      'The Rusher': {
        analysis: "The speed is the avoidance. What reads as urgency is a system that has learned to outrun the thing it named as fear. The pivot is real — but it was chosen fast, which is the Rusher's signature move.",
        gap: "The commitment has a deadline. The fear does not. That asymmetry is what to return to."
      },
      'The Freezer': {
        analysis: "The freeze is not inaction — it is a load-bearing wall built to prevent something worse. The pivot names a direction but does not yet address what the freeze was originally protecting against.",
        gap: "Movement was chosen. The thing that made stillness feel safer has not yet been named. That is the next session."
      },
      'The Fixer': {
        analysis: "The commitment points outward. The fear lives inside. That is the Fixer's structural gap — the repair work addresses the external while the source of the friction stays untouched.",
        gap: "Who carries the load when the fixing is done? That question is still open."
      },
      default: {
        analysis: "The fear and the pivot were both named. Whether the pivot addresses the fear directly or routes around it is the central question this session raised. That distinction matters more than the commitment itself.",
        gap: "The gap is in the distance between what was named as fear and what was chosen as action. That is where the next session begins."
      }
    };

    const fallback = fallbacks[archetype] || fallbacks.default;
    return res.status(200).json({ ...fallback, fallback: true });
  }
};
