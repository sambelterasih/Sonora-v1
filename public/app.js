const API_BASE=(window.SONORA_API_BASE||"").replace(/\/$/,"");
const form=document.getElementById("form"),input=document.getElementById("url"),btn=document.getElementById("submit"),statusEl=document.getElementById("status"),results=document.getElementById("results");
const set=(id,v)=>document.getElementById(id).textContent=v??"—";
function duration(v){if(v==null||!Number.isFinite(Number(v)))return "—";let n=Math.round(Number(v)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;}
function pick(o,paths){for(const p of paths){let v=p.split(".").reduce((x,k)=>x?.[k],o);if(v!==undefined&&v!==null&&v!=="")return v;}return null;}
async function api(url,opts){const r=await fetch(`${API_BASE}${url}`,opts),d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||`Request gagal (${r.status})`);return d;}
function render(r,m){
 const t=r.track||r.metadata||r,h=pick(r,["harmony.key_name","harmony.key","tonal.key","key","musical_key"]),bpm=pick(r,["rhythm.bpm","rhythm.tempo","tempo.bpm","bpm"]);
 let chord=pick(r,["chords.progression","chords.text","chord_progression","progression"]);
 if(Array.isArray(chord))chord=chord.map(x=>typeof x==="string"?x:(x.chord||x.name||"")).filter(Boolean).join(" → ");
 const artist=pick(t,["artist","artists","artist_name","author"])||m.artist;
 set("title",pick(t,["title","name","track_title"])||m.title);set("artist",artist);set("artist2",artist);
 set("bpm",bpm==null?"—":`${bpm} BPM`);set("key",h||"—");set("camelot",pick(r,["harmony.camelot","camelot","key.camelot"])||"—");
 set("duration",duration(pick(r,["track.duration_s","track.duration_seconds","duration_seconds","duration"])??m.durationSeconds));
 set("meter",pick(r,["rhythm.time_signature","time_signature","meter"])||"—");set("chords",chord||"—");
 set("note","Hasil merupakan estimasi mesin analisis pihak ketiga. Field yang tidak tersedia tidak ditampilkan sebagai tebakan.");
 results.classList.remove("hidden");results.scrollIntoView({behavior:"smooth"});
}
form.addEventListener("submit",async e=>{
 e.preventDefault();results.classList.add("hidden");btn.disabled=true;btn.querySelector("span").textContent="Analyzing...";
 try{
  statusEl.textContent="Mengambil metadata YouTube...";
  const meta=await api("/api/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:input.value.trim()})}),m=meta.metadata;
  set("title",m.title);set("artist",m.artist);set("artist2",m.artist);set("duration",duration(m.durationSeconds));
  if(m.thumbnail)document.getElementById("cover").src=m.thumbnail;document.getElementById("watch").href=m.watchUrl;
  statusEl.textContent="Mengirim link ke mesin analisis audio...";
  const job=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:input.value.trim()})});
  let done=false;
  for(let i=0;i<90;i++){await new Promise(r=>setTimeout(r,2000));statusEl.textContent=`Menganalisis audio... (${i+1}/90)`;
   const p=await api(`/api/jobs/${encodeURIComponent(job.jobId)}`);
   if(p.status==="completed"){render(p.result,m);statusEl.textContent="Analisis selesai.";done=true;break;}
   if(["failed","error","cancelled","canceled"].includes(p.status))throw Error(p.error||"Analisis gagal.");
  }
  if(!done)throw Error("Analisis belum selesai setelah 3 menit. Coba lagi nanti.");
 }catch(err){
  statusEl.textContent=err.message;
  try{const x=await api("/api/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:input.value.trim()})}),m=x.metadata;
   set("title",m.title);set("artist",m.artist);set("artist2",m.artist);set("duration",duration(m.durationSeconds));
   if(m.thumbnail)document.getElementById("cover").src=m.thumbnail;document.getElementById("watch").href=m.watchUrl;
   ["bpm","key","camelot","meter","chords"].forEach(id=>set(id,"—"));set("note","Metadata ditemukan, tetapi layanan analisis audio gagal atau sedang tidak tersedia: "+err.message);results.classList.remove("hidden");
  }catch{}
 }finally{btn.disabled=false;btn.querySelector("span").textContent="Analyze track";}
});
