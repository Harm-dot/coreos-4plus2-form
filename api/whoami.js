module.exports = async (req, res) => {
  const t = process.env.AIRTABLE_TOKEN || "";
  const A = { Authorization: "Bearer " + t };
  const AC = { Authorization: "Bearer " + t, "Content-Type": "application/json" };
  const g = async (u, h) => { try { const r = await fetch("https://api.airtable.com/v0/appfMP8uezWpG5Z2d/" + u, { headers: h }); return r.status; } catch (e) { return String(e); } };
  res.status(200).json({
    engNoHeader: await g("tblzgiNyJkGusKhvZ/recZtQRx6JDpYD3dS?returnFieldsByFieldId=true", A),
    engWithContentType: await g("tblzgiNyJkGusKhvZ/recZtQRx6JDpYD3dS?returnFieldsByFieldId=true", AC),
    questionnaire: await g("tblDgbA7bPp2rK7Tz/recuC6FUB3pPt6CoZ?returnFieldsByFieldId=true", AC),
    respondent: await g("tblqute2FxoAzU1Uz/reccy4O3JCJMUlYxI?returnFieldsByFieldId=true", AC)
  });
   };
