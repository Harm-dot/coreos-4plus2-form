// POST /api/submit
// Body: {
//   engagementId: "rec...",
//   respondentId: "rec..."   (optional — when the person picked their name from the roster)
//   name: "Full Name",        (used when respondentId is absent — "I'm not listed")
//   role: "COO",
//   items: [ { questionId:"rec...", type:"Open text"|"Rating", answer:"...", rating:4 } ]
// }
// Creates a Respondent if needed, then one Responses record per answered item.

const { T, F, getRecord, createRecords } = require('../lib/airtable');

module.exports = async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { engagementId, respondentId, name, role, items } = body;

    if (!/^rec[A-Za-z0-9]{14}$/.test(engagementId || '')) return res.status(400).json({ error: 'Missing engagement id.' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'No answers submitted.' });

    // Resolve the respondent record.
    let respId = respondentId;
    let respName = name || '';
    if (respId) {
      // Trust the roster id and read the record. If the role chosen for THIS
      // submission differs from the record's stored role, the same person is
      // answering as a second role — split it into its own respondent so the
      // two roles don't collapse onto one record (and one get dropped from analysis).
      try {
        const rec = await getRecord(T.RESPONDENTS, respId);
        respName = rec.fields[F.resp.name] || respName;
        const storedRole = (rec.fields[F.resp.role] || '').toString().trim();
        const submittedRole = (role || '').toString().trim();
        if (submittedRole && submittedRole !== storedRole) {
          const split = await createRecords(T.RESPONDENTS, [{
            fields: {
              [F.resp.name]: respName,
              [F.resp.role]: submittedRole,
              [F.resp.engagement]: [engagementId],
            },
          }]);
          respId = split[0].id;
        }
      } catch (_) {}
    } else {
      if (!respName.trim()) return res.status(400).json({ error: 'A name is required.' });
      const created = await createRecords(T.RESPONDENTS, [{
        fields: {
          [F.resp.name]: respName.trim(),
          [F.resp.role]: role || '',
          [F.resp.engagement]: [engagementId],
        },
      }]);
      respId = created[0].id;
    }

    // Build one Responses record per answered item.
    const records = [];
    for (const it of items) {
      if (!/^rec[A-Za-z0-9]{14}$/.test(it.questionId || '')) continue;
      const isRating = (it.type === 'Rating');
      const answer = (it.answer || '').toString().trim();
      const rating = Number(it.rating);
      const hasRating = isRating && rating >= 1 && rating <= 5;
      if (!answer && !hasRating) continue; // skip blanks
      const fields = {
        [F.ans.ref]: `${respName} · ${(answer || `rating ${rating}`).slice(0, 40)}`,
        [F.ans.respondent]: [respId],
        [F.ans.question]: [it.questionId],
      };
      if (answer) fields[F.ans.answer] = answer;
      if (hasRating) fields[F.ans.rating] = rating;
      records.push({ fields });
    }

    if (!records.length) return res.status(400).json({ error: 'All answers were blank.' });
    const created = await createRecords(T.RESPONSES, records);

    res.status(200).json({ ok: true, respondentId: respId, recorded: created.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
