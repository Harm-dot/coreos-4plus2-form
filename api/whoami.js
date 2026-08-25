   module.exports = async (req, res) => {
     const t = process.env.AIRTABLE_TOKEN || "";
     const H = { headers: { Authorization: "Bearer " + t } };
     const hit = async (u) => { try { const r = await fetch(u, H); return { status: r.status, body: (await r.text()).slice(0, 70) }; } catch (e) { return String(e); } };
     const base = "https://api.airtable.com/v0/appfMP8uezWpG5Z2d/tblzgiNyJkGusKhvZ/recZtQRx6JDpYD3dS";
     const list = "https://api.airtable.com/v0/appfMP8uezWpG5Z2d/tblzgiNyJkGusKhvZ";
     res.status(200).json({
       bare: await hit(base),
       withParam: await hit(base + "?returnFieldsByFieldId=true"),
       listWithParam: await hit(list + "?maxRecords=1&returnFieldsByFieldId=true")
     });
   };
