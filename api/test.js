import {createClient} from '@supabase/supabase-js';
const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);
const LV=['Na trójkę','Na piątkę','Na szóstkę'];
const LD=['podstawy, proste przypomnienie faktów','rozumienie i łączenie faktów','zadania wymagające myślenia, w stylu egzaminu ósmoklasisty'];
const DAILY=Number(process.env.DAILY_LIMIT||30);
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
async function ask(prompt){
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:process.env.MODEL||'claude-haiku-5-5',max_tokens:4000,messages:[{role:'user',content:prompt}]})});
  const j=await r.json(); if(!r.ok) throw new Error(j.error?.message||'api');
  const t=j.content.map(x=>x.text||'').join('');
  return JSON.parse(t.slice(t.indexOf('['),t.lastIndexOf(']')+1));
}
async function gen(s,n,avoid,v){
  const cand=await ask(`Nauczyciel w polskiej szkole podstawowej. Napisz ${n} pytań testowych dla klasy ${s.k}. Przedmiot: ${s.p}. Dział lub lektura: ${s.d}. Poziom „${LV[s.l]}”: ${LD[s.l]}. Zgodnie z podstawą programową. Każde pytanie: 4 różne odpowiedzi, dokładnie jedna poprawna, bez dwuznaczności. Wyjaśnienie: 1–2 krótkie zdania prostym językiem. Różne podtematy (wariant ${v}). Nie powtarzaj: ${JSON.stringify(avoid)}. Tylko JSON: [{"q":"","o":["","","",""],"c":0,"e":""}], c to indeks poprawnej odpowiedzi.`);
  const ok=cand.filter(x=>x&&x.q&&Array.isArray(x.o)&&x.o.length===4&&new Set(x.o).size===4&&x.c>=0&&x.c<4&&x.e);
  if(!ok.length) return [];
  // druga weryfikacja: model rozwiązuje pytania bez klucza, zostają tylko zgodne
  const ans=await ask('Rozwiąż każde pytanie samodzielnie. Zwróć tylko JSON: tablicę indeksów (0-3) poprawnych odpowiedzi, w tej samej kolejności.\n'+JSON.stringify(ok.map(x=>({q:x.q,o:x.o}))));
  return ok.filter((x,i)=>ans[i]===x.c).map(x=>{const g=x.o[x.c];const o=shuffle([...x.o]);return {...x,o,c:o.indexOf(g)}});
}
async function unseen(uid,s){
  const {data}=await sb.from('questions').select('id,q,o,c,e').match({k:s.k,p:s.p,d:s.d,l:s.l}).lt('reports',3);
  const all=data||[]; if(!all.length) return {all,pool:[]};
  const {data:sn}=await sb.from('seen').select('question_id').eq('user_id',uid).in('question_id',all.map(x=>x.id));
  const seen=new Set((sn||[]).map(x=>x.question_id));
  return {all,pool:all.filter(x=>!seen.has(x.id))};
}
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end();
  const tok=(req.headers.authorization||'').replace('Bearer ','');
  const {data:{user}}=await sb.auth.getUser(tok);
  if(!user) return res.status(401).json({error:'login'});
  const b=req.body||{};
  try{
    if(b.action==='report'){
      await sb.from('reports').upsert({question_id:b.qid,user_id:user.id},{onConflict:'question_id,user_id',ignoreDuplicates:true});
      const {count}=await sb.from('reports').select('*',{count:'exact',head:true}).eq('question_id',b.qid);
      await sb.from('questions').update({reports:count||0}).eq('id',b.qid);
      return res.json({ok:true});
    }
    const s={k:String(b.k),p:String(b.p||'').slice(0,40),d:String(b.d||'').trim().toLowerCase().slice(0,80),l:Number(b.l)};
    if(!['4','5','6','7','8'].includes(s.k)||![0,1,2].includes(s.l)||!s.p||!s.d) return res.status(400).json({error:'dane'});
    let {all,pool}=await unseen(user.id,s);
    for(let round=0;pool.length<15&&round<4;round++){
      const day=new Date().toISOString().slice(0,10);
      const {data:u}=await sb.from('usage').select('n').eq('user_id',user.id).eq('day',day).maybeSingle();
      if((u?.n||0)>=DAILY) return res.status(429).json({error:'limit'});
      await sb.from('usage').upsert({user_id:user.id,day,n:(u?.n||0)+1});
      const jobs=Math.ceil((15-pool.length+3)/5), avoid=all.slice(-40).map(x=>x.q);
      const out=await Promise.all(Array.from({length:jobs},(_,i)=>gen(s,5,avoid,i+1).catch(()=>[])));
      const rows=out.flat().map(x=>({...s,q:x.q,o:x.o,c:x.c,e:x.e}));
      if(rows.length) await sb.from('questions').upsert(rows,{onConflict:'k,p,d,l,q',ignoreDuplicates:true});
      ({all,pool}=await unseen(user.id,s));
    }
    if(pool.length<15) return res.status(503).json({error:'gen'});
    const pick=shuffle(pool).slice(0,15);
    await sb.from('seen').upsert(pick.map(x=>({user_id:user.id,question_id:x.id})));
    res.json({questions:pick});
  }catch(e){res.status(500).json({error:'gen'})}
}
