import {createClient} from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL;
const admin=createClient(url,process.env.SUPABASE_SERVICE_KEY);
const anon=createClient(url,process.env.SUPABASE_ANON_KEY);
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).end();
  const b=req.body||{};
  try{
    if(b.action==='login'){
      const {data:p}=await admin.from('profiles').select('id').eq('login',String(b.login||'').trim().toLowerCase()).maybeSingle();
      if(!p) return res.status(401).json({error:'bad'});
      const {data:u}=await admin.auth.admin.getUserById(p.id);
      const {data,error}=await anon.auth.signInWithPassword({email:u.user.email,password:String(b.password||'')});
      if(error||!data.session) return res.status(401).json({error:'bad'});
      return res.json({session:data.session});
    }
    if(b.action==='remind'){
      const email=String(b.email||'').trim().toLowerCase();
      await anon.auth.resetPasswordForEmail(email,{redirectTo:process.env.SITE_URL});
      const {data:login}=await admin.rpc('login_by_email',{e:email});
      if(login&&process.env.RESEND_API_KEY){
        await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+process.env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:process.env.MAIL_FROM,to:email,subject:'Twój login w KlikTest',text:'Twój login w KlikTest: '+login})});
      }
      return res.json({ok:true}); // zawsze ta sama odpowiedź
    }
    res.status(400).json({error:'akcja'});
  }catch(e){res.status(500).json({error:'blad'})}
}
