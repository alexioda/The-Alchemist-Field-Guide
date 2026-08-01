// api/content.js
// Vercel serverless function — returns the actual Field Guide cycle content
// (labels, prompts, lead copy, archetype descriptions). Previously this all
// lived directly in public/index.html's CYCLES array and ARCHETYPE_PROMPTS
// object, so viewing page source exposed the entire guide regardless of the
// cipher — the lock screen only hid it visually, it never protected it.
// Now it's served here after verifying the signed session token issued by
// api/authenticate.js, using the same X-Alchemist-Token header and
// SESSION_SECRET already used by api/pattern-analysis.js.
//
// Unlike api/pattern-analysis.js's token check (which falls back to
// allowing requests when SESSION_SECRET is unset, since an Origin check is
// its primary defense there), this endpoint has no other gate — serving the
// guide content IS the point of the cipher, so verification here fails
// closed: without SESSION_SECRET configured, this returns a 500 rather than
// silently serving the content to anyone.
//
// SETUP: set SESSION_SECRET in this project's Vercel environment variables
// (same value used by api/authenticate.js and api/pattern-analysis.js).
//
// Sessions are stored client-side in localStorage (not sessionStorage) so a
// buyer stays logged in on a given device across tabs/restarts for up to a
// year, whether they got in via the manual cipher or a Lemon Squeezy license
// key (see api/authenticate.js) — a new device still needs one of those
// entered once. api/pattern-analysis.js's MAX_AGE_MS is kept in sync with
// this file's, since both verify the same token and a mismatch would let
// the guide content keep loading while the AI analysis silently started
// rejecting the same session as expired.

const crypto = require("crypto");

function isValidSessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null; // "not configured" — distinct from "invalid"
  if (!token || typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [issuedAt, signature] = parts;
  if (!/^\d+$/.test(issuedAt)) return false;

  const expected = crypto.createHmac("sha256", secret).update(issuedAt).digest("hex");
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // matches api/pattern-analysis.js — sessions remembered for a year
  const age = Date.now() - Number(issuedAt);
  return age >= 0 && age <= MAX_AGE_MS;
}

module.exports = (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const valid = isValidSessionToken(req.headers["x-alchemist-token"]);

  if (valid === null) {
    return res.status(500).json({ error: "Server configuration error: SESSION_SECRET is not set." });
  }
  if (!valid) {
    return res.status(401).json({ error: "Invalid or expired session. Please re-authenticate." });
  }

  return res.status(200).json({ cycles: CYCLES, archetypePrompts: ARCHETYPE_PROMPTS });
};

const CYCLES = [
{
id: 'intro',
type: 'intro',
title: 'The Seven Cycles.',
subtitle: 'The Architecture',
body: 'You are not here to "fix" yourself. You are here to learn the mechanics of your own energy.',
cards: [
{ icon: '⚡', heading: 'The Biometrics', text: 'We do not assume stress. We measure it. Every cycle begins with a scan.' },
{ icon: '⚖️', heading: 'The Fork', text: 'Stress hits the Body (Weight) or the Mind (Noise). Learn to treat them differently.' },
{ icon: '🔥', heading: 'The Alchemy', text: 'We do not calm down. We transform friction into fuel for action.' },
]
},
{
id: 'cycle1',
type: 'anchor',
number: '01',
title: 'The Anchor',
lead: 'The first step in alchemy is locating the material. How does your stress manifest today?',
sliderLabel: 'Friction Baseline',
sliderSub: 'Quantify current state',
archetypes: [
{ name: 'The Rusher', desc: '"I don\'t have time." Anxiety, speed.' },
{ name: 'The Freezer', desc: '"I\'m overwhelmed." Paralysis, fog.' },
{ name: 'The Fixer', desc: '"It\'s all on me." Burden, tension.' },
],
required: ['archetype'],
requiredMessage: 'Select your archetype to continue — this shapes every cycle ahead.'
},
{
id: 'cycle2',
type: 'somatic',
number: '02',
title: 'The Body',
lead: 'Before the mind spins a story, the body sounds an alarm. Where is the physical friction located right now?',
fieldLabel: 'The Somatic Map',
placeholder: 'e.g., My chest feels tight and my jaw is locked...',
required: ['sensation'],
requiredMessage: 'Locate the physical friction before moving forward. Even one sentence.'
},
{
id: 'cycle3',
type: 'mind',
number: '03',
title: 'The Mind',
loopLabel: 'The Loop (Fiction)',
factLabel: 'The Fact (Data)',
factPlaceholder: 'The absolute objective truth is...',
required: ['thought', 'reframe'],
requiredMessage: 'Complete both the Fiction and the Fact before proceeding.'
},
{
id: 'cycle4',
type: 'pivot',
number: '04',
title: 'The Pivot',
lead: 'The Pivot is the exact moment you stop managing the symptom and address the root cause. You have identified the physical sensation and the mental loop. Now, we challenge the foundation.',
fearLabel: 'What is the core fear or assumption driving this friction?',
fearPlaceholder: 'e.g., I am afraid that if I fail this, I lose my status...',
pivotLabel: 'The Sovereign Pivot',
pivotSub: 'What is the highest-leverage action you can take right now despite that fear?',
pivotPlaceholder: 'e.g., I will send the email outlining the risk, because my status is built on honesty, not perfection...',
required: ['core_fear', 'sovereign_pivot'],
requiredMessage: 'Name the fear and the pivot before moving on — these are the load-bearing walls.'
},
{
id: 'cycle5',
type: 'void',
number: '05',
title: 'The Void',
lead: 'Action without integration is just more noise. You have identified the friction and decided on a pivot. Now, you must stop. For the next 60 seconds, do absolutely nothing. Your nervous system needs this pause to metabolize the cortisol and write the new neural pathway. Do not force an answer. Just observe what surfaces.',
label: 'In the stillness, what became clear?',
required: ['stillness'],
requiredMessage: 'Sit with the silence and write what surfaced — even a fragment.'
},
{
id: 'cycle6',
type: 'output',
number: '06',
title: 'The Output',
shadowTitle: 'The Golden Shadow',
shadowDesc: 'The Saboteur holds your fears. The Golden Shadow holds your unlived greatness. The traits you admire in others are merely your own latent potential waiting to be claimed.',
shadowLabel: 'Who is your hero, and what trait do they have that you "lack"?',
shadowPlaceholder: 'I admire [Name] because they are [Trait]. This trait lives in me as...',
contractLabel: 'The Contract',
required: ['action', 'commitment'],
requiredMessage: 'Complete the Contract — the commitment is the entire point of this cycle.'
},
{
id: 'cycle7',
type: 'pattern',
number: '07',
title: 'Pattern Rec',
lead: 'You have shifted your baseline. Let\'s quantify the alchemy.',
sliderLabel: 'Post-Protocol Audit',
sliderSub: 'Re-evaluate your friction state',
blueprintTitle: 'Your Execution Blueprint',
}
];

const ARCHETYPE_PROMPTS = {
'The Rusher': 'The Rusher says: "There isn\'t enough time." I keep thinking that...',
'The Freezer': 'The Freezer says: "I can\'t handle this." I keep thinking that...',
'The Fixer': 'The Fixer says: "It\'s all on me." I keep thinking that...',
default: 'I keep thinking that...'
};
