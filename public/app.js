const API_BASE=(window.SONORA_API_BASE||"").replace(/\/$/,"");
const form=document.getElementById("form"),input=document.getElementById("url"),btn=document.getElementById("submit"),statusEl=document.getElementById("status"),results=document.getElementById("results");
const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v??"—";};
function duration(v){
 if(v==null||!Number.isFinite(Number(v)))return "—";
 let n=Math.round(Number(v)),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
 return h?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;
}
async function api(url,opts){
 const r=await fetch(`${API_BASE}${url}`,opts),d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.error||`Request gagal (${r.status})`);
 return d;
}
const cleanKey=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,"");
function findDeep(root,aliases){
 const wanted=new Set(aliases.map(cleanKey)),seen=new Set();
 function walk(node,depth){
  if(!node||typeof node!=="object"||depth>12||seen.has(node))return null;
  seen.add(node);
  if(Array.isArray(node)){for(const v of node){const x=walk(v,depth+1);if(x!==null&&x!==undefined&&x!=="")return x;}return null;}
  for(const [k,v] of Object.entries(node)){
   if(wanted.has(cleanKey(k))&&v!==null&&v!==undefined&&v!=="")return v;
  }
  for(const v of Object.values(node)){const x=walk(v,depth+1);if(x!==null&&x!==undefined&&x!=="")return x;}
  return null;
 }
 return walk(root,0);
}
function scalar(v,keys=[]){
 if(v===null||v===undefined||v==="")return null;
 if(typeof v==="string"||typeof v==="number")return v;
 if(Array.isArray(v))return v.length?scalar(v[0],keys):null;
 if(typeof v==="object"){
  for(const k of keys){if(v[k]!==undefined&&v[k]!==null&&v[k]!=="")return scalar(v[k],keys);}
 }
 return null;
}
function numberValue(v){
 const x=scalar(v,["value","bpm","tempo","estimate","estimated","mean","median","result","average"]);
 const n=typeof x==="number"?x:Number(String(x??"").match(/\d+(?:\.\d+)?/)?.[0]);
 return Number.isFinite(n)&&n>=30&&n<=300?Math.round(n*10)/10:null;
}
function normalizeKey(v){
 if(v==null)return null;
 let s=String(v).trim().replace(/♯/g,"#").replace(/♭/g,"b").replace(/_/g," ").replace(/\s+/g," ");
 // Common API formats: E major, E:maj, E:min, E Major, E
 const m=s.match(/(?:^|[\s:(])([A-Ga-g])([#b]?)(?:\s*[:_-]?\s*(major|maj|min|minor|m|minor\s+key|major\s+key))?/i);
 if(!m)return s;
 const note=m[1].toUpperCase()+m[2];
 const suffix=(m[3]||"").toLowerCase();
 const mode=/^(min|minor|m)$/.test(suffix)?"minor":/^(maj|major)$/.test(suffix)?"major":null;
 return note+(mode?" "+mode:"");
}
function keyFromValue(v){
 if(v==null)return null;
 if(typeof v==="object"){
  const tonic=scalar(v,["tonic","root","note","pitch","pitch_class","key_name","name"]);
  const mode=scalar(v,["mode","scale","quality","type"]);
  if(tonic==null)return null;
  return normalizeKey(String(tonic)+(mode?" "+mode:""));
 }
 return normalizeKey(v);
}
function camelotFromKey(key){
 if(!key)return null;
 const m=String(key).match(/^([A-G][#b]?)\s+(major|minor)$/i);if(!m)return null;
 let n=m[1].toUpperCase(),mode=m[2].toLowerCase();
 const enh={"DB":"C#","EB":"D#","GB":"F#","AB":"G#","BB":"A#","CB":"B","E#":"F","B#":"C","FB":"E"};
 n=enh[n]||n;
 const major={"B":"1B","F#":"2B","C#":"3B","G#":"4B","D#":"5B","A#":"6B","F":"7B","C":"8B","G":"9B","D":"10B","A":"11B","E":"12B"};
 const minor={"G#":"1A","D#":"2A","A#":"3A","F":"4A","C":"5A","G":"6A","D":"7A","A":"8A","E":"9A","B":"10A","F#":"11A","C#":"12A"};
 return (mode==="major"?major:minor)[n]||null;
}
function meterFromValue(v,root){
 if(v&&typeof v==="object"){
  const n=scalar(v,["numerator","beats","beats_per_bar","top","num","count"]);
  const d=scalar(v,["denominator","bottom","den","beat_unit"]);
  if(n&&d)return `${n}/${d}`;
  const label=scalar(v,["value","label","name","time_signature","signature","meter"]);
  if(label!==null)return meterFromValue(label,root);
 }
 if(typeof v==="string"){
  const m=v.match(/(?:^|\D)(\d{1,2})\s*\/\s*(\d{1,2})(?:\D|$)/);
  if(m&&Number(m[1])>0&&Number(m[1])<=16&&[2,4,8,16].includes(Number(m[2])))return `${m[1]}/${m[2]}`;
 }
 if(typeof v==="number"&&Number.isInteger(v)&&v>0&&v<=16){
  const d=findDeep(root,["time_signature_denominator","beat_unit","meter_denominator"]);
  if(d&&[2,4,8,16].includes(Number(d)))return `${v}/${d}`;
 }
 return null;
}
function render(payload,meta){
 // Providers may wrap the analysis in result, data, analysis or payload.
 const root=payload?.result??payload?.data??payload?.analysis??payload?.payload??payload;
 const track=root?.track??root?.metadata??root?.song??root;
 const bpm=numberValue(findDeep(root,["bpm","tempo_bpm","tempo","estimated_bpm","estimated_tempo","bpm_estimate","tempo_estimate","beats_per_minute"]));
 const rawKey=findDeep(root,["key_name","musical_key","detected_key","estimated_key","tonal_key","key","key_signature"]);
 const key=keyFromValue(rawKey);
 const rawMeter=findDeep(root,["time_signature","timesignature","meter","metre","measure_signature","beats_per_bar","bar_signature"]);
 const meter=meterFromValue(rawMeter,root);
 let chord=findDeep(root,["chord_progression","progression","chords"]);
 if(!Array.isArray(chord))chord=scalar(chord,["progression","text","sequence","chords","names"])??chord;
 if(Array.isArray(chord))chord=chord.map(x=>typeof x==="string"?x:(x?.chord||x?.name||x?.symbol||"")).filter(Boolean).join(" → ");
 const artist=scalar(track?.artist??track?.artists??track?.artist_name??track?.author)||meta.artist;
 set("title",scalar(track?.title??track?.name??track?.track_title)||meta.title);
 set("artist",artist);set("artist2",artist);
 set("bpm",bpm===null?"—":`${bpm} BPM`);
 set("key",key||"—");
 set("camelot",camelotFromKey(key)||"—");
 const dur=findDeep(root,["duration_seconds","duration_s","duration"])??meta.durationSeconds;
 set("duration",duration(dur));
 set("meter",meter||"—");
 set("chords",typeof chord==="string"&&chord?chord:"—");
 const missing=[];if(bpm===null)missing.push("BPM");if(!meter)missing.push("birama");if(!key)missing.push("nada dasar");
 let note=missing.length
  ?`Hasil analisis belum menyediakan ${missing.join(", ")}. SONORA tidak mengisi angka perkiraan tanpa dasar audio.`
  :"BPM, birama, dan nada dasar ditampilkan dari hasil analisis audio.";
 if(key&&!/\s+(major|minor)$/i.test(key))note+=" Mode mayor/minor tidak disediakan, sehingga Camelot belum dapat ditentukan dengan aman.";
 set("note",note);
 results.classList.remove("hidden");results.scrollIntoView({behavior:"smooth"});
}
form.addEventListener("submit",async e=>{
 e.preventDefault();results.classList.add("hidden");btn.disabled=true;btn.querySelector("span").textContent="Analyzing track";
 try{
  statusEl.textContent="Mengambil metadata YouTube...";
  const metaResponse=await api("/api/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:input.value.trim()})});
  const m=metaResponse.metadata;
  set("title",m.title);set("artist",m.artist);set("artist2",m.artist);set("duration",duration(m.durationSeconds));
  if(m.thumbnail)document.getElementById("cover").src=m.thumbnail;
  document.getElementById("watch").href=m.watchUrl;
  statusEl.textContent="Mengirim link ke mesin analisis audio...";
  const job=await api("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:input.value.trim()})});
  let done=false;
  for(let i=0;i<90;i++){
   await new Promise(r=>setTimeout(r,2000));
   statusEl.textContent=`Menganalisis audio... (${i+1}/90)`;
   const poll=await api(`/api/jobs/${encodeURIComponent(job.jobId)}`);
   if(poll.status==="completed"){render(poll.result,m);statusEl.textContent="Analisis selesai.";done=true;break;}
   if(["failed","error","cancelled","canceled"].includes(poll.status))throw Error(poll.error||"Analisis gagal.");
  }
  if(!done)throw Error("Analisis belum selesai setelah 3 menit. Coba lagi nanti.");
 }catch(err){
  statusEl.textContent=err.message;
  try{
   const x=await api("/api/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:input.value.trim()})}),m=x.metadata;
   set("title",m.title);set("artist",m.artist);set("artist2",m.artist);set("duration",duration(m.durationSeconds));
   if(m.thumbnail)document.getElementById("cover").src=m.thumbnail;
   document.getElementById("watch").href=m.watchUrl;
   ["bpm","key","camelot","meter","chords"].forEach(id=>set(id,"—"));
   set("note","Metadata ditemukan, tetapi layanan analisis audio gagal atau belum tersedia: "+err.message);
   results.classList.remove("hidden");
  }catch{}
 }finally{btn.disabled=false;btn.querySelector("span").textContent="Analyze track";}
});
