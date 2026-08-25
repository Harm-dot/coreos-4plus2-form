   module.exports = async (req, res) => {
     const t = process.env.AIRTABLE_TOKEN || "";
     const H = { headers: { Authorization: "Bearer " + t } };
     const out = { tokenPrefix: t.slice(0, 17), length: t.length };
     try { const r = await fetch("https://api.airtable.com/v0/appfMP8uezWpG5Z2d/tblzgiNyJkGusKhvZ/recZtQRx6JDpYD3dS", H); out.getRecord = { status: r.status, body: (await r.text()).slice(0, 120) }; } catch (e) { out.getRecord = String(e); }
     try { const w = await fetch("https://api.airtable.com/v0/meta/whoami", H); out.whoami = { status: w.status, body: (await w.text()).slice(0, 250) }; } catch (e) { out.whoami = String(e); }
     res.status(200).json(out);
   };
