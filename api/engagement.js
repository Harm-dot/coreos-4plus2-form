// GET /api/engagement?e=<engagementRecordId>   — shared engagement link (legacy, everyone sees every picked question)
// GET /api/engagement?r=<respondentRecordId>   — personal link: loads that person's engagement and only the
//                                                 wording of each anchor that matches their Level.
const { T, F, DRIVER_ORDER, linkId, selName, getRecord, getQuestionMap } = require('../lib/airtable');

const REC = /^rec[A-Za-z0-9]{14}$/;

module.exports = async (req, res) => {
  try {
    const q = req.query || {};
    const r = (q.r || '').toString().trim();
    let e = (q.e || '').toString().trim();
    let me = null;

    // Personal link: resolve the respondent first, the engagement comes from them.
    if (r) {
      if (!REC.test(r)) return res.status(400).json({ error: 'Invalid personal link.' });
      const rec = await getRecord(T.RESPONDENTS, r);
      const rf = rec.fields;
      const engLink = rf[F.resp.engagement];
      if (!Array.isArray(engLink) || !engLink.length) return res.status(422).json({ error: 'This link is not attached to a diagnostic yet.' });
      e = linkId(engLink[0]);
      me = {
        id: rec.id,
        name: rf[F.resp.name] || '',
        role: selName(rf[F.resp.role]),
        level: selName(rf[F.resp.level]),
      };
    }
    if (!REC.test(e)) return res.status(400).json({ error: 'Missing or invalid engagement id.' });

    const eng = await getRecord(T.ENGAGEMENTS, e);
    const ef = eng.fields;
    const qnrLink = ef[F.eng.questionnaire];
    if (!Array.isArray(qnrLink) || !qnrLink.length) return res.status(422).json({ error: 'This engagement has no questionnaire assigned.' });
    const qnr = await getRecord(T.QUESTIONNAIRES, linkId(qnrLink[0]));
    const qf = qnr.fields;
    const qIds = (qf[F.qnr.questions] || []).map(linkId);

    const qmap = await getQuestionMap();
    let picked = qIds.map(id => qmap[id]).filter(Boolean);

    // Level filter (personal links only). A question with no Level is for everyone.
    if (me) {
      const anchored = picked.filter(x => x.anchor);
      if (anchored.length && !me.level) {
        return res.status(422).json({ error: 'Your level has not been set for this diagnostic yet. Please ask the person who sent you this link.' });
      }
      if (me.level) {
        const fits = x => !x.levels.length || x.levels.indexOf(me.level) >= 0;
        // Red light: every picked anchor must have a version for this person's level.
        const anchors = [...new Set(anchored.map(x => x.anchor))];
        const missing = anchors.filter(a => !anchored.some(x => x.anchor === a && fits(x)));
        if (missing.length) {
          return res.status(422).json({ error: 'This diagnostic is not ready for your role yet. Please check back soon.', missingAnchors: missing, level: me.level });
        }
        picked = picked.filter(fits);
      }
    }

    const groups = DRIVER_ORDER.map(d => ({
      driver: d,
      questions: picked.filter(x => x.driver === d).sort((a, b) => a.order - b.order),
    })).filter(g => g.questions.length);

    // Roster only matters for the shared link; a personal link already knows who you are.
    const roster = [];
    if (!me) {
      for (const rl of (ef[F.eng.respondents] || [])) {
        try {
          const rec = await getRecord(T.RESPONDENTS, linkId(rl));
          roster.push({ id: rec.id, name: rec.fields[F.resp.name] || '', role: selName(rec.fields[F.resp.role]) });
        } catch (_) {}
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      engagement: { id: eng.id, name: ef[F.eng.name] || 'Diagnostic', client: ef[F.eng.client] || '', type: selName(ef[F.eng.type]) },
      questionnaire: { id: qnr.id, name: qf[F.qnr.name] || '' },
      groups,
      roster: roster.filter(x => x.name),
      me,
      totalQuestions: picked.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
