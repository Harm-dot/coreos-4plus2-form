// GET /api/engagement?e=<engagementRecordId>
const { T, F, DRIVER_ORDER, linkId, selName, getRecord, getQuestionMap } = require('../lib/airtable');

module.exports = async (req, res) => {
  try {
    const e = ((req.query && req.query.e) || '').toString().trim();
    if (!/^rec[A-Za-z0-9]{14}$/.test(e)) return res.status(400).json({ error: 'Missing or invalid engagement id.' });

    const eng = await getRecord(T.ENGAGEMENTS, e);
    const ef = eng.fields;
    const qnrLink = ef[F.eng.questionnaire];
    if (!Array.isArray(qnrLink) || !qnrLink.length) return res.status(422).json({ error: 'This engagement has no questionnaire assigned.' });
    const qnr = await getRecord(T.QUESTIONNAIRES, linkId(qnrLink[0]));
    const qf = qnr.fields;
    const qIds = (qf[F.qnr.questions] || []).map(linkId);

    const qmap = await getQuestionMap();
    const picked = qIds.map(id => qmap[id]).filter(Boolean);

    const groups = DRIVER_ORDER.map(d => ({
      driver: d,
      questions: picked.filter(q => q.driver === d).sort((a, b) => a.order - b.order),
    })).filter(g => g.questions.length);

    const rLinks = ef[F.eng.respondents] || [];
    const roster = [];
    for (const r of rLinks) {
      try {
        const rec = await getRecord(T.RESPONDENTS, linkId(r));
        roster.push({ id: rec.id, name: rec.fields[F.resp.name] || '', role: selName(rec.fields[F.resp.role]) });
      } catch (_) {}
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      engagement: { id: eng.id, name: ef[F.eng.name] || 'Diagnostic', client: ef[F.eng.client] || '', type: selName(ef[F.eng.type]) },
      questionnaire: { id: qnr.id, name: qf[F.qnr.name] || '' },
      groups,
      roster: roster.filter(r => r.name),
      totalQuestions: picked.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
