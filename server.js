require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");
const app = express();
app.use(express.json({limit:"32kb"}));
app.use(express.static("public"));

const BASE=(process.env.MAGIC_CHORDS_BASE||"https://magic-chords.dev/api/v1").replace(/\/$/,"");
function getVideoId(input){
  try{
    const u=new URL(input);
    if(u.hostname==="youtu.be") return u.pathname.slice(1).split("/")[0]||null;
    if(!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
    if(u.pathname==="/watch") return u.searchParams.get("v");
    const p=u.pathname.split("/").filter(Boolean);
    if(["embed","shorts","live"].includes(p[0])) return p[1]||null;
    return null;
  }catch{return null;}
}
function parseDuration(iso){
 const m=String(iso||"").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
 return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):null;
}
app.post("/api/lookup",async(req,res)=>{
 const id=getVideoId(req.body?.url||"");
 if(!id||!/^[\w-]{11}$/.test(id)) return res.status(400).json({error:"Masukkan URL YouTube atau YouTube Music yang valid."});
 try{
  const url=`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
  const r=await fetch(url);if(!r.ok)throw Error("Video tidak ditemukan atau tidak publik.");
  const oe=await r.json();let durationSeconds=null;
  if(process.env.YOUTUBE_API_KEY){
   const u=new URL("https://www.googleapis.com/youtube/v3/videos");
   u.search=new URLSearchParams({part:"contentDetails",id,key:process.env.YOUTUBE_API_KEY});
   const dr=await fetch(u);if(dr.ok){const d=await dr.json();durationSeconds=parseDuration(d.items?.[0]?.contentDetails?.duration);}
  }
  res.json({success:true,metadata:{title:oe.title,artist:oe.author_name,thumbnail:oe.thumbnail_url,durationSeconds,videoId:id,watchUrl:`https://www.youtube.com/watch?v=${id}`}});
 }catch(e){res.status(502).json({error:e.message||"Gagal mengambil metadata YouTube."});}
});
app.post("/api/analyze",async(req,res)=>{
 const id=getVideoId(req.body?.url||"");
 if(!id||!/^[\w-]{11}$/.test(id))return res.status(400).json({error:"URL YouTube tidak valid."});
 try{
  const r=await fetch(`${BASE}/analyze/url`,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({url:`https://www.youtube.com/watch?v=${id}`})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return res.status(r.status).json({error:d.detail||d.error||`Provider error ${r.status}`});
  if(!d.job_id)return res.status(502).json({error:"Provider tidak mengembalikan job_id."});
  res.json({success:true,jobId:d.job_id,status:d.status||"processing"});
 }catch(e){console.error(e);res.status(502).json({error:"Layanan analisis audio tidak dapat dihubungi."});}
});
app.get("/api/jobs/:jobId",async(req,res)=>{
 const id=req.params.jobId;
 if(!/^[A-Za-z0-9_-]{6,100}$/.test(id))return res.status(400).json({error:"Job ID tidak valid."});
 try{
  const r=await fetch(`${BASE}/jobs/${encodeURIComponent(id)}`,{headers:{Accept:"application/json"}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)return res.status(r.status).json({error:d.detail||d.error||"Gagal memeriksa status."});
  const s=String(d.status||"processing").toLowerCase();
  if(["completed","complete","done","succeeded","success"].includes(s)){
   const rr=await fetch(`${BASE}/jobs/${encodeURIComponent(id)}/result`,{headers:{Accept:"application/json"}});
   const result=await rr.json().catch(()=>({}));
   if(!rr.ok)return res.status(rr.status).json({error:result.detail||result.error||"Gagal mengambil hasil."});
   return res.json({success:true,status:"completed",result});
  }
  if(["failed","error","cancelled","canceled"].includes(s))return res.json({success:false,status:s,error:d.error||d.message||"Analisis gagal."});
  res.json({success:true,status:s,message:d.message||"Analisis sedang berjalan."});
 }catch(e){console.error(e);res.status(502).json({error:"Gagal menghubungi layanan analisis."});}
});
app.post("/api/explain",async(req,res)=>{
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"OPENAI_API_KEY belum diatur."});
 if(!req.body?.features||typeof req.body.features!=="object")return res.status(400).json({error:"Fitur audio terukur diperlukan."});
 try{
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const out=await client.responses.create({model:process.env.OPENAI_MODEL||"gpt-5.5",
   instructions:"Jelaskan data musik yang diberikan dalam bahasa Indonesia. Jangan mengarang nilai yang tidak tersedia.",
   input:JSON.stringify(req.body.features)});
  res.json({success:true,explanation:out.output_text});
 }catch(e){console.error(e);res.status(500).json({error:"Gagal meminta penjelasan AI."});}
});
app.get("/api/health",(_,res)=>res.json({ok:true}));
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`SONORA berjalan di http://localhost:${port}`));
