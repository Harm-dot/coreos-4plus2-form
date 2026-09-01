
// GET /api/engagements  →  { engagements: [ { id, name, client } ] }
// Feeds the universal-link picker (index.html ?pick=1). Lists only engagements a
// respondent can actually complete: one with a questionnaire AND at least one person.
//
// Optional access gate: set the env var PICK_CODE to require ?code=<PICK_CODE>.
// Leave PICK_CODE unset and the picker is open (access = keep the link private).

const { T, F, listAll } = require('../lib/airtable');

module.exports = async (req, res) => {
  try {
    const gate = process.env.PICK_CODE;
    if (gate) {
      const code = ((req.query && req.query.code) || '').toString();
      if (code !== gate) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(401).json({ needCode: true, message: 'This diagnostic is protected. Enter the access code you were given.' });
      }
    }

    const recs = await listAll(T.ENGAGEMENTS);
    const out = [];
    for (const r of recs) {
      const f = r.fields || {};
      const qnr = f[F.eng.questionnaire];
      const resp = f[F.eng.respondents];
      const hasQ = Array.isArray(qnr) && qnr.length;
      const hasR = Array.isArray(resp) && resp.length;
      if (!hasQ || !hasR) continue;
      out.push({
        id: r.id,
        name: (f[F.eng.name] || 'Diagnostic').toString(),
        client: (f[F.eng.client] || '').toString(),
        created: r.createdTime || '',
      });
    }
    out.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    out.forEach(o => { delete o.created; });

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ engagements: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
