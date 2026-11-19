const DEFAULT_BASE = "https://magic-chords.dev/api/v1";
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json; charset=utf-8", ...CORS}});
function getVideoId(input){
  try { const u=new URL(input); if(u.hostname==="youtu.be") return u.pathname.slice(1).split("/")[0]||null;
    if(!/(^|\.)youtube\.com$/.test(u.hostname)) return null; if(u.pathname==="/watch") return u.searchParams.get("v");
    const p=u.pathname.split("/").filter(Boolean); if(["embed","shorts","live"].includes(p[0])) return p[1]||null; return null;
  } catch { return null; }
}
function parseDuration(iso){const m=String(iso||"").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):null;}
async function bodyJson(r){return await r.json().catch(()=>({}));}
async function handleApi(request, env, url){
 if(request.method==="OPTIONS") return new Response(null,{status:204,headers:CORS});
 if(url.pathname==="/api/health"&&request.method==="GET") return json({ok:true,service:"SONORA Cloudflare Worker"});
 if(url.pathname==="/api/lookup"&&request.method==="POST"){
  const body=await bodyJson(request), id=getVideoId(body.url||"");
  if(!id||!/^[\w-]{11}$/.test(id)) return json({error:"Masukkan URL YouTube atau YouTube Music yang valid."},400);
  try { const endpoint=`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
   const r=await fetch(endpoint); if(!r.ok) throw new Error("Video tidak ditemukan atau tidak publik."); const oe=await r.json(); let durationSeconds=null;
   if(env.YOUTUBE_API_KEY){const u=new URL("https://www.googleapis.com/youtube/v3/videos");u.search=new URLSearchParams({part:"contentDetails",id,key:env.YOUTUBE_API_KEY});const dr=await fetch(u);if(dr.ok){const d=await dr.json();durationSeconds=parseDuration(d.items?.[0]?.contentDetails?.duration);}}
   return json({success:true,metadata:{title:oe.title,artist:oe.author_name,thumbnail:oe.thumbnail_url,durationSeconds,videoId:id,watchUrl:`https://www.youtube.com/watch?v=${id}`}});
  } catch(e){return json({error:e.message||"Gagal mengambil metadata YouTube."},502);}
 }
 if(url.pathname==="/api/analyze"&&request.method==="POST"){
  const body=await bodyJson(request), id=getVideoId(body.url||""); if(!id||!/^[\w-]{11}$/.test(id))return json({error:"URL YouTube tidak valid."},400);
  try {const base=(env.MAGIC_CHORDS_BASE||DEFAULT_BASE).replace(/\/$/,"");const r=await fetch(`${base}/analyze/url`,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({url:`https://www.youtube.com/watch?v=${id}`})});const d=await bodyJson(r);if(!r.ok)return json({error:d.detail||d.error||`Provider error ${r.status}`},r.status);if(!d.job_id)return json({error:"Provider tidak mengembalikan job_id."},502);return json({success:true,jobId:d.job_id,status:d.status||"processing"});}
  catch{return json({error:"Layanan analisis audio tidak dapat dihubungi."},502);}
 }
 const jobMatch=url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]{6,100})$/);
 if(jobMatch&&request.method==="GET"){
  const id=jobMatch[1];try{const base=(env.MAGIC_CHORDS_BASE||DEFAULT_BASE).replace(/\/$/,"");const r=await fetch(`${base}/jobs/${encodeURIComponent(id)}`,{headers:{Accept:"application/json"}});const d=await bodyJson(r);if(!r.ok)return json({error:d.detail||d.error||"Gagal memeriksa status."},r.status);const status=String(d.status||"processing").toLowerCase();
   if(["completed","complete","done","succeeded","success"].includes(status)){const rr=await fetch(`${base}/jobs/${encodeURIComponent(id)}/result`,{headers:{Accept:"application/json"}});const result=await bodyJson(rr);if(!rr.ok)return json({error:result.detail||result.error||"Gagal mengambil hasil."},rr.status);return json({success:true,status:"completed",result});}
   if(["failed","error","cancelled","canceled"].includes(status))return json({success:false,status,error:d.error||d.message||"Analisis gagal."});return json({success:true,status,message:d.message||"Analisis sedang berjalan."});
  }catch{return json({error:"Gagal menghubungi layanan analisis."},502);}
 }
 if(url.pathname==="/api/explain"&&request.method==="POST"){
  if(!env.OPENAI_API_KEY)return json({error:"OPENAI_API_KEY belum diatur."},503);const body=await bodyJson(request);if(!body.features||typeof body.features!=="object")return json({error:"Fitur audio terukur diperlukan."},400);
  try{const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-5.5",instructions:"Jelaskan data musik yang diberikan dalam bahasa Indonesia. Jangan mengarang nilai yang tidak tersedia.",input:JSON.stringify(body.features)})});const d=await bodyJson(r);if(!r.ok)return json({error:d.error?.message||"Gagal meminta penjelasan AI."},r.status);const explanation=(d.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");return json({success:true,explanation});}
  catch{return json({error:"Gagal meminta penjelasan AI."},502);}
 }
 return json({error:"API route tidak ditemukan."},404);
}
export default { async fetch(request, env){const url=new URL(request.url);if(url.pathname.startsWith("/api/"))return handleApi(request,env,url);return env.ASSETS.fetch(request);} };
