// POST /api/admin — the question-picker backend (no password).
// Self-contained: reads the question bank directly, so it needs NO change to any
// existing file — just this new file + admin.html.
// Actions (JSON body):
//   { action:'questions' }
//       → { ok, questions:[{id,text,subtheme,driver,type,order,functions[],scenarios[]}] }
//   { action:'create', engagement:{name,client,type},
//     questionIds:['rec…'], people:[{name,role}] }
//       → { ok, engagementId, link }
const { T, F, listAll, selName, linkId, createRecords } = require('../lib/airtable');

// Question field ids (read-only here) + the 6 drivers by record id.
const QF = {
  text: 'fldOJDPlvyE4AuQzK', subtheme: 'fld1hDED3iwnxFTeq', order: 'fldoyGFH5qZFResyt',
  type: 'fldcXwo62r0FYiv7L', driver: 'fldXpppMQyyhBTb3L', func: 'fldikNOxyUrWk4onr',
  scenario: 'fldDx2SSaS7eW1iK6',
};
const DRIVER_BY_ID = {
  recTNRFgAJLt80Bsh: 'Culture', recnIZyrICBHaZw9B: 'Strategy', recnNWlcqD9InQ22p: 'Structure',
  rec7hn71vADFJFGcn: 'Execution', recJcIM6i3CDfQEui: 'Innovation', recASBOypstgCKQeW: 'Leadership',
};

// The 6 driver maturity self-ratings (1-5, "where are you now"). Auto-appended to
// EVERY engagement the picker creates, so the maturity score can never be forgotten.
const MATURITY_IDS = [
  'recZ2IU6FpjdDvuDu', // Culture
  'recG6BPNzAOxSt83a', // Strategy
  'recaQjcL0SKjXuNx8', // Structure
  'reca6t2SXZn9PQy0A', // Execution
  'recCqG8eHRjHGz1RL', // Innovation
  'recB4tTUkFf110KQ1', // Leadership
];

async function loadQuestions() {
    const recs = await listAll(T.QUESTIONS);
  // Only offer Active questions in the picker — Proposed (new form submissions) wait for approval.
  const activeOnly = recs.filter(r => selName(r.fields['fldlSKggkuPRPWzBM']) === 'Active');
  return activeOnly.map(r => {
    const c = r.fields;
    const drv = Array.isArray(c[QF.driver]) ? c[QF.driver][0] : null;
    return {
      id: r.id,
      text: c[QF.text] || '',
      subtheme: c[QF.subtheme] || '',
      order: (typeof c[QF.order] === 'number') ? c[QF.order] : 999,
      type: selName(c[QF.type]) || 'Open text',
      driver: drv ? (DRIVER_BY_ID[linkId(drv)] || null) : null,
      functions: Array.isArray(c[QF.func]) ? c[QF.func].map(selName).filter(Boolean) : [],
      scenarios: Array.isArray(c[QF.scenario]) ? c[QF.scenario].map(selName).filter(Boolean) : [],
    };
  });
}

module.exports = async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = body.action || (req.query && req.query.action) || '';

    // No password gate — access is controlled by keeping this URL private.

    if (action === 'questions') {
      const questions = await loadQuestions();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, questions });
    }

    if (action === 'create') {
      const eng = body.engagement || {};
      const name = (eng.name || '').toString().trim();
      const qIds = Array.isArray(body.questionIds) ? body.questionIds.filter(id => /^rec[A-Za-z0-9]{14}$/.test(id)) : [];
      const people = Array.isArray(body.people) ? body.people.filter(p => p && (p.name || '').toString().trim()) : [];
      if (!name) return res.status(400).json({ error: 'Give the engagement a name.' });
      if (!qIds.length) return res.status(400).json({ error: 'Pick at least one question.' });

      // Always include the 6 maturity ratings, whether or not they were ticked.
      const allIds = qIds.slice();
      for (const m of MATURITY_IDS) if (!allIds.includes(m)) allIds.push(m);

      const qnr = await createRecords(T.QUESTIONNAIRES, [{ fields: { [F.qnr.name]: name, [F.qnr.questions]: allIds } }]);
      const qnrId = qnr[0].id;

      const engFields = { [F.eng.name]: name, [F.eng.questionnaire]: [qnrId], [F.eng.status]: 'Setup' };
      if (eng.client) engFields[F.eng.client] = eng.client.toString().trim();
      if (eng.type) engFields[F.eng.type] = eng.type; // 'Individual' | 'Organization'
      const engRec = await createRecords(T.ENGAGEMENTS, [{ fields: engFields }]);
      const engId = engRec[0].id;

      if (people.length) {
        await createRecords(T.RESPONDENTS, people.map(p => ({
          fields: {
            [F.resp.name]: (p.name || '').toString().trim(),
            [F.resp.role]: (p.role || '').toString().trim(),
            [F.resp.engagement]: [engId],
          },
        })));
      }

      const host = (req.headers && req.headers.host) || 'coreos-4plus2-form.vercel.app';
      return res.status(200).json({ ok: true, engagementId: engId, link: `https://${host}/?e=${engId}` });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
