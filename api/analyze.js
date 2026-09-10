// POST /api/analyze — the "Generate draft" button's backend (private URL, no password).
// Two actions:
//   { action:'engagements' }              → { ok, engagements:[{id,name,client,status}] }
//   { action:'analyze', engagementId }    → { ok, markdown }   (the CLIENT / honey draft)
//
// Needs two environment variables in Vercel (Settings → Environment Variables):
//   AIRTABLE_TOKEN      — already set (used by the rest of the app)
//   ANTHROPIC_API_KEY   — your Anthropic API key (NEW — add this one)
// Optional:
//   ANALYZE_MODEL       — override the model id if the default isn't on your key.
//
// This NEVER sends anything to a client. It returns a draft for you to read, edit and send yourself.

const { T, F, listAll, getRecord, getQuestionMap, selName, linkId, DRIVER_ORDER } = require('../lib/airtable');

const MODEL = process.env.ANALYZE_MODEL || 'claude-sonnet-4-5';

// ---- the locked 4+2 "Brutal Facts" method (client / honey register) ----
const SYSTEM = `You are the analysis engine for Harm's Core 4+2 "Brutal Facts" organizational diagnostic. You turn a set of leadership responses into a readout. Produce the CLIENT register: clear, direct, human — it names what works before what doesn't, attacks the MECHANISM never the person ("your team describes the company two ways", never "your CEO is in denial"), and is safe if forwarded. Same findings a blunt version would have, not one fact softer — just delivered so a team can act on it.

Lenses (the spine): Core 4+2 (what to fix, in order) · the Competing Values Framework / OCAI (Cameron & Quinn) for the culture read · 80/20 for the shortlist.

Write the readout in Markdown, in this structure:
1. A one-line HEADLINE naming the single #1 move, regardless of which step it sits in.
2. Front framing: one short line that output quality = input quality ("greatness in, greatness out"), and a candor read — concrete, specific, uncomfortable answers signal an aware org; smooth or empty answers are themselves a tell (candor + specificity, not volume).
3. The LEAD finding — the single most important thing, stated plainly.
4. A short "temperature & distance" read — treat any 1-5 rating as a gut thermometer, NOT a grade; lead instead on the DIVERGENCE between respondents on the same driver (Aligned / Close / Wide / Widest), with attributed quotes.
5. THE SHORTLIST — always all six, in this FIXED order, never reordered by impact: 1 Culture, 2 Strategy, 3 Structure (structure follows strategy), 4 Execution, 5 Innovation, 6 Leadership. Skip Talent-development and M&A. For each step give an evidence gate label — "Ready to act" / "Firm this up first" / "Gather more" — and never manufacture advice: where the data is thin, say so and name what to collect. Healthy steps still appear, marked "solid — protect it." The gate is a CHAIN: a thin upstream step CAPS what you can advise downstream — say so with a forward remark (e.g. "sharpen the one-sentence strategy and Steps 3 & 4 get materially easier").
6. Close with a coach hand-off: this is a starting point, bring questions to your coach.

Be concise and specific. Use the respondents' own words where they said something concrete. If only one respondent answered, say so — divergence is the core signal and needs at least two.`;

async function loadEngagements() {
  const recs = await listAll(T.ENGAGEMENTS);
  return recs.map(r => {
    const c = r.fields;
    return {
      id: r.id,
      name: c[F.eng.name] || '(unnamed)',
      client: c[F.eng.client] || '',
      status: selName(c[F.eng.status]) || '',
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function buildTranscript(engagementId) {
  const [respondents, responses, qmap] = await Promise.all([
    listAll(T.RESPONDENTS),
    listAll(T.RESPONSES),
    getQuestionMap(),
  ]);

  // Respondents that belong to this engagement.
  const mine = respondents.filter(r => {
    const link = r.fields[F.resp.engagement];
    return Array.isArray(link) && link.map(linkId).includes(engagementId);
  });
  const nameById = {}, roleById = {};
  for (const r of mine) { nameById[r.id] = r.fields[F.resp.name] || 'Someone'; roleById[r.id] = r.fields[F.resp.role] || ''; }
  const mineIds = new Set(mine.map(r => r.id));

  // Their responses.
  const rows = [];
  for (const resp of responses) {
    const c = resp.fields;
    const rId = linkId(Array.isArray(c[F.ans.respondent]) ? c[F.ans.respondent][0] : null);
    if (!mineIds.has(rId)) continue;
    const qId = linkId(Array.isArray(c[F.ans.question]) ? c[F.ans.question][0] : null);
    const q = qmap[qId];
    if (!q) continue;
    rows.push({
      driver: q.driver || 'Other',
      qtext: q.text,
      person: nameById[rId] + (roleById[rId] ? ` (${roleById[rId]})` : ''),
      answer: (c[F.ans.answer] || '').toString().trim(),
      rating: (typeof c[F.ans.rating] === 'number') ? c[F.ans.rating] : null,
    });
  }

  // Group by driver in the fixed 4+2 order.
  const order = DRIVER_ORDER.concat(['Other']);
  let out = '';
  for (const driver of order) {
    const drows = rows.filter(r => r.driver === driver);
    if (!drows.length) continue;
    out += `\n## ${driver}\n`;
    for (const r of drows) {
      const val = r.rating != null ? `[${r.rating}/5] ${r.answer}` : r.answer;
      if (!val) continue;
      out += `- ${r.person} — ${r.qtext}\n  → ${val}\n`;
    }
  }
  return { transcript: out.trim(), respondentCount: mine.length, responseCount: rows.length };
}

async function callClaude(transcript, engName) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 5000,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Engagement: ${engName}\n\nHere are the collected responses, grouped by 4+2 driver. Write the client-register readout.\n${transcript}` }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || []).map(b => b.text || '').join('').trim();
}

async function handler(req, res) {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action || (req.query && req.query.action) || '';

    if (action === 'engagements') {
      const engagements = await loadEngagements();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, engagements });
    }

    if (action === 'analyze') {
      const engagementId = body.engagementId;
      if (!/^rec[A-Za-z0-9]{14}$/.test(engagementId || '')) return res.status(400).json({ error: 'Pick an engagement.' });
      const eng = await getRecord(T.ENGAGEMENTS, engagementId).catch(() => null);
      const engName = eng ? (eng.fields[F.eng.name] || 'Engagement') : 'Engagement';
      const { transcript, respondentCount, responseCount } = await buildTranscript(engagementId);
      if (!responseCount) return res.status(400).json({ error: 'No responses are in yet for this engagement.' });
      const markdown = await callClaude(transcript, engName);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, markdown, engName, respondentCount, responseCount });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 60 };
