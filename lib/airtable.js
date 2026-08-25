// Shared Airtable helpers + the field/table map for the Core 4+2 base.
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appfMP8uezWpG5Z2d';
const TOKEN = process.env.AIRTABLE_TOKEN;
const API = 'https://api.airtable.com/v0';

const T = {
  ENGAGEMENTS:    'tblzgiNyJkGusKhvZ',
  RESPONDENTS:    'tblqute2FxoAzU1Uz',
  RESPONSES:      'tblRKnbmiQisNPM4j',
  QUESTIONS:      'tblrrLZdrMmQjMIkt',
  QUESTIONNAIRES: 'tblDgbA7bPp2rK7Tz',
};
const F = {
  eng:   { name:'fldztU0WEy0PIeKyq', client:'fldNRh99ghmp7aaek', type:'fldvhHff6k8BgaTkY',
           status:'fldxAzdpKvOfWFlLl', questionnaire:'fld0nwclrpyKoWtWo', respondents:'fldNn1u6rsWdi0lk7' },
  qnr:   { name:'fldfdXNygrFAxDYZQ', questions:'fldjfJ4ti5LKp4UpU', status:'fld3LUnFByg373pGi' },
  q:     { text:'fldOJDPlvyE4AuQzK', subtheme:'fld1hDED3iwnxFTeq', order:'fldoyGFH5qZFResyt',
           type:'fldcXwo62r0FYiv7L', driver:'fldXpppMQyyhBTb3L' },
  resp:  { name:'fldoARUcMLiZIIULL', role:'fldKboMWbq5U6qN8S', engagement:'fldmLF0ltlfZqQgqS' },
  ans:   { ref:'fldFPhy3VLKER92dW', answer:'fldvIaCY4ZCpDgVRb', rating:'fldAtGseUa7AJB7zP',
           respondent:'fld8OtADLkDPEpuoN', question:'fldID0muxAl4Z2e8n' },
};
const DRIVER_ORDER = ['Culture','Strategy','Structure','Execution','Innovation','Leadership'];
const linkId  = x => (x && typeof x === 'object' ? x.id : x);
const selName = v => ((v && typeof v === 'object' ? v.name : v) || '');
const DRIVER_BY_ID = {
  recTNRFgAJLt80Bsh:'Culture', recnIZyrICBHaZw9B:'Strategy', recnNWlcqD9InQ22p:'Structure',
  rec7hn71vADFJFGcn:'Execution', recJcIM6i3CDfQEui:'Innovation', recASBOypstgCKQeW:'Leadership',
};

function assertToken(){
  if(!TOKEN) throw new Error('AIRTABLE_TOKEN is not set.');
}
async function at(path, opts={}){
  assertToken();
  const res = await fetch(`${API}/${BASE_ID}/${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type':'application/json', ...(opts.headers||{}) },
  });
  if(!res.ok){
    const body = await res.text();
    throw new Error(`Airtable ${res.status} on ${path.split('?')[0]}: ${body.slice(0,200)}`);
  }
  return res.json();
}
async function getRecord(table, id){
  return at(`${table}/${id}?returnFieldsByFieldId=true`);
}
async function listAll(table, extra=''){
  let out=[], offset='';
  do{
    const q = `${table}?returnFieldsByFieldId=true&pageSize=100${extra}${offset?`&offset=${encodeURIComponent(offset)}`:''}`;
    const data = await at(q);
    out = out.concat(data.records||[]);
    offset = data.offset||'';
  } while(offset);
  return out;
}
async function createRecords(table, records){
  const created=[];
  for(let i=0;i<records.length;i+=10){
    const batch = records.slice(i,i+10);
    const data = await at(table, { method:'POST', body: JSON.stringify({ records: batch, typecast:true }) });
    created.push(...(data.records||[]));
  }
  return created;
}

let _qCache=null, _qCacheAt=0;
async function getQuestionMap(){
  const now = Date.now();
  if(_qCache && (now-_qCacheAt) < 60000) return _qCache;
  const recs = await listAll(T.QUESTIONS);
  const map = {};
  for(const r of recs){
    const c = r.fields;
    const drvLink = Array.isArray(c[F.q.driver]) ? c[F.q.driver][0] : null;
    map[r.id] = {
      id: r.id,
      text: c[F.q.text] || '',
      subtheme: c[F.q.subtheme] || '',
      order: (typeof c[F.q.order]==='number') ? c[F.q.order] : 999,
      type: selName(c[F.q.type]) || 'Open text',
      driver: drvLink ? (DRIVER_BY_ID[linkId(drvLink)] || null) : null,
    };
  }
  _qCache=map; _qCacheAt=now;
  return map;
}

module.exports = { BASE_ID, T, F, DRIVER_ORDER, linkId, selName, at, getRecord, listAll, createRecords, getQuestionMap };
