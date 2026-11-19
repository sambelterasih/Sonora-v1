const DEFAULT_BASE = "https://magic-chords.dev/api/v1";
const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"};
const json = (data, status=200) => new Response(JSON.stringify(data), {status, headers:{"Content-Type":"application/json; charset=utf-8", ...CORS}});
function getVideoId(input){try{const u=new URL(input);if(u.hostname==="youtu.be")return u.pathname.slice(1).split("/")[0]||null;if(!/(^|\.)youtube\.com$/.test(u.hostname))return null;if(u.pathname==="/watch")return u.searchParams.get("v");const p=u.pathname.split("/").filter(Boolean);if(["embed","shorts","live"].includes(p[0]))return p[1]||null;return null;}catch{return null;}}
function getSpotifyTrack(input){try{const u=new URL(input);if(u.protocol!=="https:"||u.hostname!=="open.spotify.com")return null;const parts=u.pathname.split("/").filter(Boolean);const i=parts.findIndex(x=>x==="track");if(i<0||!parts[i+1])return null;const id=parts[i+1].split("?")[0];return /^[A-Za-z0-9]{22}$/.test(id)?id:null;}catch{return null;}}
function parseDuration(iso){const m=String(iso||"").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):null;}
async function bodyJson(r){return await r.json().catch(()=>({}));}
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
function titleMatch(a,b){const x=norm(a),y=norm(b);if(!x||!y)return 0;if(x===y)return 1;if(x.includes(y)||y.includes(x))return Math.min(x.length,y.length)/Math.max(x.length,y.length);return 0;}
function keyFromText(v){if(!v)return null;let s=String(v).trim().replace(/♯/g,"#").replace(/♭/g,"b");const m=s.match(/^([A-Ga-g])([#b]?)(?:\s*(major|maj|minor|min|m))?$/i);if(!m)return null;const mode=/^(minor|min|m)$/i.test(m[3]||"")?"Minor":/^(major|maj)$/i.test(m[3]||"")?"Major":"";return m[1].toUpperCase()+m[2]+(mode?" "+mode:"");}
function getArtists(row){if(Array.isArray(row?.artists))return row.artists.map(a=>typeof a==="string"?a:a?.name).filter(Boolean).join(", ");if(Array.isArray(row?.artist))return row.artist.map(a=>typeof a==="string"?a:a?.name).filter(Boolean).join(", ");return row?.artist?.name||row?.artist_name||row?.artist||null;}
async function musicDatabaseLookup(env,title,artist){
 const sources=[],candidates=[];const cleanTitle=String(title||"").trim(),cleanArtist=String(artist||"").trim();
 if(!cleanTitle)return {data:{},sources,errors:["Judul lagu tidak tersedia untuk pencarian database."]};
 if(env.SONOVAULT_API_KEY&&cleanArtist){
  try{const q=new URLSearchParams({title:cleanTitle,artist:cleanArtist,limit:"5"});const r=await fetch(`https://api.sonovault.now/v1/tracks/search?${q}`,{headers:{"x-api-key":env.SONOVAULT_API_KEY,Accept:"application/json"}});const d=await bodyJson(r);if(r.ok){const rows=Array.isArray(d.results)?d.results:[];const ranked=rows.map(x=>({x,score:cleanArtist?titleMatch(x.title,cleanTitle)*0.65+titleMatch(getArtists(x),cleanArtist)*0.35:titleMatch(x.title,cleanTitle)})).sort((a,b)=>b.score-a.score);const best=ranked[0];if(best&&best.score>=0.78){const x=best.x;candidates.push({source:"Sonovault",score:best.score,bpm:Number(x.bpm)||null,key:keyFromText(x.key_musical||x.key||x.key_name),durationSeconds:Number(x.duration_seconds||x.duration)||null,title:x.title,artist:getArtists(x),isrc:x.isrc||null});sources.push("Sonovault");}}else sources.push(`Sonovault: HTTP ${r.status}`);}catch{sources.push("Sonovault: tidak dapat dihubungi");}
 }
 if(env.GETSONGBPM_API_KEY){
  try{const lookup=cleanArtist?`song:${cleanTitle} artist:${cleanArtist}`:`song:${cleanTitle}`;const q=new URLSearchParams({api_key:env.GETSONGBPM_API_KEY,type:"song",lookup,limit:"8"});const r=await fetch(`https://api.getsong.co/search/?${q}`,{headers:{Accept:"application/json"}});const d=await bodyJson(r);if(r.ok&&Array.isArray(d.search)){const ranked=d.search.map(x=>({x,score:cleanArtist?titleMatch(x.title,cleanTitle)*0.65+titleMatch(getArtists(x),cleanArtist)*0.35:titleMatch(x.title,cleanTitle)})).sort((a,b)=>b.score-a.score);const best=ranked[0];if(best&&best.score>=(cleanArtist?0.78:0.9)){let x=best.x;const detailUrl=new URL("https://api.getsong.co/song/");detailUrl.search=new URLSearchParams({api_key:env.GETSONGBPM_API_KEY,id:x.id});const dr=await fetch(detailUrl,{headers:{Accept:"application/json"}});const dd=await bodyJson(dr);if(dr.ok&&dd.song)x=dd.song;candidates.push({source:"GetSongBPM",score:best.score,bpm:Number(x.tempo)||Number(x.bpm)||null,key:keyFromText(x.key_of||x.key),timeSignature:x.time_sig||null,durationSeconds:Number(x.duration)||null,title:x.title||x.song_title,artist:getArtists(x)||getArtists(best.x)});sources.push("GetSongBPM");}}else sources.push(`GetSongBPM: HTTP ${r.status}`);}catch{sources.push("GetSongBPM: tidak dapat dihubungi");}
 }
 const data={title:cleanTitle,artist:cleanArtist||null,bpm:null,key:null,timeSignature:null,durationSeconds:null,chords:null,fieldSources:{}};
 for(const field of ["bpm","key","timeSignature","durationSeconds"]){const found=candidates.find(c=>c[field]!==null&&c[field]!==undefined&&c[field]!=="");if(found){data[field]=found[field];data.fieldSources[field]=found.source;}}
 // Only publish a candidate's artist/title when its match passed the confidence threshold.
 const best=candidates.slice().sort((a,b)=>b.score-a.score)[0];if(best){data.title=best.title||data.title;data.artist=best.artist||data.artist;}
 return {data,sources:[...new Set(sources)],errors:[]};
}

async function acrCloudIdentify(env,audioBase64,mimeType){
 const access=env.ACRCLOUD_ACCESS_KEY,secret=env.ACRCLOUD_ACCESS_SECRET;
 if(!access||!secret)throw new Error("ACRCLOUD_ACCESS_KEY dan ACRCLOUD_ACCESS_SECRET belum diatur di Cloudflare Worker Secrets.");
 if(!env.ACRCLOUD_HOST)throw new Error("ACRCLOUD_HOST belum diatur. Isi hostname region dari dashboard ACRCloud.");
 if(typeof audioBase64!=="string"||audioBase64.length<1000||audioBase64.length>1800000)throw new Error("Cuplikan audio tidak valid atau terlalu besar.");
 const binary=atob(audioBase64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const host=env.ACRCLOUD_HOST.replace(/^https?:\/\//,"").replace(/\/$/,"");
 const path="/v1/identify",timestamp=String(Math.floor(Date.now()/1000));
 const signText=["POST",path,access,"audio","1",timestamp].join("\n");
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
 const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(signText));
 const signature=btoa(String.fromCharCode(...new Uint8Array(sig)));
 const form=new FormData();form.set("access_key",access);form.set("data_type","audio");form.set("sample_bytes",String(bytes.length));form.set("signature_version","1");form.set("signature",signature);form.set("timestamp",timestamp);form.set("sample",new Blob([bytes],{type:mimeType||"audio/wav"}),"internal-audio.wav");
 const response=await fetch(`https://${host}${path}`,{method:"POST",body:form});const data=await bodyJson(response);
 if(!response.ok||Number(data.status?.code)!==0)throw new Error(data.status?.msg||`Layanan pengenal lagu gagal (HTTP ${response.status}).`);
 const song=data.metadata?.music?.[0];if(!song)throw new Error("Tidak ditemukan kecocokan lagu pada cuplikan audio.");
 const artists=(song.artists||[]).map(x=>x.name).filter(Boolean).join(", ");
 return {title:song.title||null,artist:artists||null,album:song.album?.name||null,externalUrl:song.external_metadata?.spotify?.track?.id?`https://open.spotify.com/track/${song.external_metadata.spotify.track.id}`:song.external_metadata?.youtube?.vid?`https://www.youtube.com/watch?v=${song.external_metadata.youtube.vid}`:null,thumbnail:song.external_metadata?.spotify?.track?.images?.[0]?.url||null,isrc:song.external_ids?.isrc||null};
}


async function geminiMusicSearch(env, input){
 const apiKey=env.GEMINI_API_KEY;
 if(!apiKey)throw new Error("GEMINI_API_KEY belum diatur di Cloudflare Worker Secrets.");
 const query=String(input||"").trim().slice(0,700);
 if(!query)throw new Error("Masukkan judul-artis atau link YouTube/Spotify.");
 const prompt=`Kamu adalah mesin pencari metadata musik. Identifikasi rekaman yang tepat dari input berikut: ${query}\n\nGunakan Google Search untuk memeriksa beberapa sumber tepercaya. Kembalikan data sebagai JSON sesuai skema. Aturan: cocokkan judul dan artis; jika input berupa URL, identifikasi lagu dari metadata publik dan hasil pencarian. Durasi adalah durasi rekaman lagu, bukan video dengan intro/outro panjang. BPM harus tempo lagu. Key harus nada dasar beserta mayor/minor bila sumber mendukung (contoh C Minor). Birama contoh 4/4. Jangan menebak. Jika tidak ditemukan atau sumber bertentangan, isi null dan jelaskan singkat di notes. Jangan menyamakan channel YouTube dengan artis kecuali jelas. Cantumkan URL sumber yang benar-benar mendukung data.`;
 const schema={type:"object",properties:{title:{type:["string","null"]},artist:{type:["string","null"]},duration_seconds:{type:["number","null"]},bpm:{type:["number","null"]},key:{type:["string","null"]},time_signature:{type:["string","null"]},confidence:{type:"string",enum:["high","medium","low"]},notes:{type:"string"},sources:{type:"array",items:{type:"object",properties:{title:{type:"string"},url:{type:"string"}},required:["title","url"]}}},required:["title","artist","duration_seconds","bpm","key","time_signature","confidence","notes","sources"]};
 const endpoint="https://generativelanguage.googleapis.com/v1beta/interactions";
 const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey,"Api-Revision":"2026-05-20"},body:JSON.stringify({model:env.GEMINI_MODEL||"gemini-3.8-flash",input:prompt,tools:[{type:"google_search"}],generation_config:{temperature:0.1},response_format:{type:"text",mime_type:"application/json",schema}})});
 const data=await bodyJson(response);
 if(!response.ok){
  const message=data.error?.message||data.message||`Gemini Interactions API gagal (HTTP ${response.status}).`;
  if(/google.?search|grounding|not available|free tier|billing/i.test(message))throw new Error(`Gemini 3.8 Flash menolak Google Search: ${message} Periksa kelayakan/billing Google Search grounding pada project API kamu.`);
  throw new Error(message);
 }
 const text=(data.steps||[]).filter(x=>x.type==="model_output").flatMap(x=>x.content||[]).filter(x=>x.type==="text").map(x=>x.text||"").join("\n") || data.output_text || "";
 if(!text)throw new Error(data.status&&data.status!=="completed"?`Interaksi Gemini belum selesai (status: ${data.status}).` : "Gemini tidak mengembalikan hasil. Coba lagi.");
 let parsed;try{parsed=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,""));}catch{const m=text.match(/\{[\s\S]*\}/);if(!m)throw new Error("Format hasil Gemini tidak valid.");parsed=JSON.parse(m[0]);}
 const num=v=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):null;
 const sources=Array.isArray(parsed.sources)?parsed.sources.filter(x=>x&&typeof x.url==="string"&&/^https?:\/\//.test(x.url)).slice(0,8):[];
 return {success:true,data:{title:parsed.title||null,artist:parsed.artist||null,durationSeconds:num(parsed.duration_seconds),bpm:num(parsed.bpm),key:keyFromText(parsed.key),timeSignature:parsed.time_signature||null,confidence:parsed.confidence||"low",notes:parsed.notes||"",sources}};
}

async function handleApi(request,env,url){
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
 if(url.pathname==="/api/health"&&request.method==="GET")return json({ok:true,service:"CHORD SASY AI Music Finder",version:"2.9.0",geminiConfigured:Boolean(env.GEMINI_API_KEY)});
 if(url.pathname==="/api/ai/music-search"&&request.method==="POST"){const body=await bodyJson(request);try{return json(await geminiMusicSearch(env,body.input));}catch(e){return json({error:e.message||"Pencarian AI gagal."},502);}}
 if(url.pathname==="/api/lookup"&&request.method==="POST"){
  const body=await bodyJson(request),id=getVideoId(body.url||"");if(!id||!/^[\w-]{11}$/.test(id))return json({error:"Masukkan URL YouTube atau YouTube Music yang valid."},400);
  try{const endpoint=`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;const r=await fetch(endpoint);if(!r.ok)throw new Error("Video tidak ditemukan atau tidak publik.");const oe=await r.json();let durationSeconds=null;if(env.YOUTUBE_API_KEY){const u=new URL("https://www.googleapis.com/youtube/v3/videos");u.search=new URLSearchParams({part:"contentDetails",id,key:env.YOUTUBE_API_KEY});const dr=await fetch(u);if(dr.ok){const d=await dr.json();durationSeconds=parseDuration(d.items?.[0]?.contentDetails?.duration);}}return json({success:true,metadata:{title:oe.title,artist:oe.author_name,thumbnail:oe.thumbnail_url,durationSeconds,videoId:id,watchUrl:`https://www.youtube.com/watch?v=${id}`}});}catch(e){return json({error:e.message||"Gagal mengambil metadata YouTube."},502);}
 }
 if(url.pathname==="/api/spotify/lookup"&&request.method==="POST"){
  const body=await bodyJson(request),id=getSpotifyTrack(body.url||"");if(!id)return json({error:"Masukkan link lagu Spotify yang valid (open.spotify.com/track/...)."},400);
  try{const trackUrl=`https://open.spotify.com/track/${id}`;const r=await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`,{headers:{Accept:"application/json"}});if(!r.ok)throw new Error("Spotify tidak dapat memberikan metadata untuk link ini.");const oe=await r.json();let artist=null,durationSeconds=null;
   // Spotify oEmbed intentionally exposes limited metadata. Read only public page metadata when present; never access or extract audio.
   try{const page=await fetch(trackUrl,{headers:{Accept:"text/html"}});if(page.ok){const html=await page.text();const desc=html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i)?.[1]||html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)?.[1]||"";const decoded=desc.replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&#x27;/g,"'");const am=decoded.match(/(?:Listen to|Stream)\s+.+?\s+by\s+(.+?)\s+on Spotify/i);if(am)artist=am[1].split(/[,.]/)[0].trim();}}
   catch{}
   return json({success:true,metadata:{title:oe.title||"Spotify track",artist,thumbnail:oe.thumbnail_url||null,durationSeconds,trackId:id,watchUrl:trackUrl,embedUrl:`https://open.spotify.com/embed/track/${id}`}});
  }catch(e){return json({error:e.message||"Gagal mengambil metadata Spotify."},502);}
 }

 if(url.pathname==="/api/audio/identify"&&request.method==="POST"){
  const body=await bodyJson(request);try{const metadata=await acrCloudIdentify(env,body.audioBase64,body.mimeType);const database=await musicDatabaseLookup(env,metadata.title,metadata.artist||"");return json({success:true,metadata,database,message:"Lagu berhasil dikenali melalui audio internal. Parameter musik diambil dari database yang cocok; nilai yang tidak tersedia tetap kosong."});}catch(e){return json({error:e.message||"Gagal mengenali audio internal."},502);}
 }
 if(url.pathname==="/api/music-data/lookup"&&request.method==="POST"){
  const body=await bodyJson(request);const title=String(body.title||"").slice(0,240),artist=String(body.artist||"").slice(0,240);if(!title)return json({error:"Judul lagu diperlukan."},400);const result=await musicDatabaseLookup(env,title,artist);return json({success:true,...result,configured:{sonovault:Boolean(env.SONOVAULT_API_KEY),getSongBPM:Boolean(env.GETSONGBPM_API_KEY)}});
 }
 if(url.pathname==="/api/analyze"&&request.method==="POST"){
  const body=await bodyJson(request),id=getVideoId(body.url||"");if(!id||!/^[\w-]{11}$/.test(id))return json({error:"URL YouTube tidak valid."},400);
  try{const base=(env.MAGIC_CHORDS_BASE||DEFAULT_BASE).replace(/\/$/,"");const r=await fetch(`${base}/analyze/url`,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({url:`https://www.youtube.com/watch?v=${id}`})});const d=await bodyJson(r);if(!r.ok)return json({error:d.detail||d.error||`Provider error ${r.status}`},r.status);if(!d.job_id)return json({error:"Provider tidak mengembalikan job_id."},502);return json({success:true,jobId:d.job_id,status:d.status||"processing"});}catch{return json({error:"Layanan analisis audio tidak dapat dihubungi."},502);}
 }
 const jobMatch=url.pathname.match(/^\/api\/jobs\/([A-Za-z0-9_-]{6,100})$/);
 if(jobMatch&&request.method==="GET"){
  const id=jobMatch[1];try{const base=(env.MAGIC_CHORDS_BASE||DEFAULT_BASE).replace(/\/$/,"");const r=await fetch(`${base}/jobs/${encodeURIComponent(id)}`,{headers:{Accept:"application/json"}});const d=await bodyJson(r);if(!r.ok)return json({error:d.detail||d.error||"Gagal memeriksa status."},r.status);const status=String(d.status||"processing").toLowerCase();if(["completed","complete","done","succeeded","success"].includes(status)){const rr=await fetch(`${base}/jobs/${encodeURIComponent(id)}/result`,{headers:{Accept:"application/json"}});const result=await bodyJson(rr);if(!rr.ok)return json({error:result.detail||result.error||"Gagal mengambil hasil."},rr.status);return json({success:true,status:"completed",result});}if(["failed","error","cancelled","canceled"].includes(status))return json({success:false,status,error:d.error||d.message||"Analisis gagal."});return json({success:true,status,message:d.message||"Analisis sedang berjalan."});}catch{return json({error:"Gagal menghubungi layanan analisis."},502);}
 }
 if(url.pathname==="/api/explain"&&request.method==="POST"){
  if(!env.OPENAI_API_KEY)return json({error:"OPENAI_API_KEY belum diatur."},503);const body=await bodyJson(request);if(!body.features||typeof body.features!=="object")return json({error:"Fitur audio terukur diperlukan."},400);
  try{const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Authorization":`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:env.OPENAI_MODEL||"gpt-5.5",instructions:"Jelaskan data musik yang diberikan dalam bahasa Indonesia. Jangan mengarang nilai yang tidak tersedia.",input:JSON.stringify(body.features)})});const d=await bodyJson(r);if(!r.ok)return json({error:d.error?.message||"Gagal meminta penjelasan AI."},r.status);const explanation=(d.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n");return json({success:true,explanation});}catch{return json({error:"Gagal meminta penjelasan AI."},502);}
 }
 return json({error:"API route tidak ditemukan."},404);
}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith("/api/"))return handleApi(request,env,url);return env.ASSETS.fetch(request);}};
