const INSTRUMENTS = ["QL C band","O band","E band","Ti:sapphire","Toptica 1050","1064 放大器","Santec C band","Santec TSL-570-1 C band","Santec TSL-570-2 C band","Sacher1100-1190","Sacher 790 ~840","EPOPO 1950","Toptica 950","HCP - 2 um amplifier"];
const STORAGE_KEY = "lab-instrument-bookings-v1";
const USER_KEY = "lab-instrument-username";
const WEEKDAYS = ["日","一","二","三","四","五","六"];
const NAS_HINT = "\\\\nas\\Temp\\ChesterHsu";
const NAS_FILE = "instrument-bookings.json";
const IDB_NAME = "lab-booking-nas-v1";

function startOfWeek(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
function toISODate(d) {
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function parseISO(s) { const p = s.split("-").map(Number); return new Date(p[0], p[1]-1, p[2]); }
function fmtHeader(iso) { const d = parseISO(iso); return (d.getMonth()+1) + "/" + d.getDate() + "（" + WEEKDAYS[d.getDay()] + "）"; }
function loadBookings() { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch(e){ return []; } }

const state = { weekStart: startOfWeek(new Date("2026-09-17T00:00:00")), bookings: loadBookings(), editingId: null, nasDir: null, nasFileMtime: 0, nasReady: false };

function saveBookingsLocal(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bookings)); }
function saveBookings(){ saveBookingsLocal(); writeNasFile().catch(function(err){ setNasStatus("尚未寫入 NAS："+err.message, false); }); }
function colorFor(name){ let h=0; for(let i=0;i<name.length;i++) h=name.charCodeAt(i)+((h<<5)-h); return "hsl("+[168,198,221,32,262,142,12,285][Math.abs(h)%8]+" 42% 36%)"; }
function toast(msg){ const el=document.getElementById("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(function(){ el.classList.remove("show"); },2600); }
function setNasStatus(text, ok){ const el=document.getElementById("nasStatus"); if(!el) return; el.textContent=text; el.style.color = ok ? "#027a48" : "#b45309"; }
function weekDates(){ const out=[]; for(let i=0;i<6;i++){ const d=new Date(state.weekStart); d.setDate(d.getDate()+i); out.push(toISODate(d)); } return out; }
function overlaps(a,b){ return a.instrument===b.instrument && a.date===b.date && a.start<b.end && b.start<a.end; }
function findConflict(c, ignoreId){ return state.bookings.find(function(b){ return b.id!==ignoreId && overlaps(c,b); }); }
function escapeHtml(s){ return String(s).replace(/&/g,"\u0026amp;").replace(/</g,"\u0026lt;").replace(/>/g,"\u0026gt;").replace(/"/g,"\u0026quot;").replace(/'/g,"\u0026#39;"); }
function uid(){ return "b_"+Math.random().toString(36).slice(2,10)+Date.now().toString(36); }

function render(){
  const dates=weekDates(), today=toISODate(new Date());
  document.getElementById("weekLabel").textContent = fmtHeader(dates[0]) + " – " + fmtHeader(dates[5]);
  let html="<thead><tr><th class='inst'>儀器</th>";
  dates.forEach(function(iso){ html += "<th>"+fmtHeader(iso)+(iso===today?" · 今天":"")+"</th>"; });
  html += "</tr></thead><tbody>";
  INSTRUMENTS.forEach(function(inst){
    html += "<tr><td class=\"inst\">"+inst+"</td>";
    dates.forEach(function(iso){
      const items=state.bookings.filter(function(b){return b.instrument===inst && b.date===iso;}).sort(function(a,b){return a.start.localeCompare(b.start);});
      html += "<td class=\"cell"+(iso===today?" today":"")+"\"><div class=\"cell-list\">";
      if(!items.length) html += "<div class=\"empty\">尚未預約</div>";
      items.forEach(function(b){ html += "<div class=\"booking\" data-id=\""+b.id+"\" style=\"background:"+colorFor(b.name)+"\"><div class=\"who\">"+escapeHtml(b.name)+"</div><div class=\"meta\">"+b.start+"–"+b.end+"</div>"+(b.note?"<div>"+escapeHtml(b.note)+"</div>":"")+"</div>"; });
      html += "<div class=\"add\" data-inst=\""+encodeURIComponent(inst)+"\" data-date=\""+iso+"\">＋ 預約此時段</div></div></td>";
    });
    html += "</tr>";
  });
  html += "</tbody>";
  const table=document.getElementById("grid"); table.innerHTML=html;
  table.querySelectorAll(".booking").forEach(function(el){ el.addEventListener("click", function(){ openEdit(el.dataset.id); }); });
  table.querySelectorAll(".add").forEach(function(el){ el.addEventListener("click", function(){ openCreate(decodeURIComponent(el.dataset.inst), el.dataset.date); }); });
}

function fillInstOptions(selected){ document.getElementById("fInst").innerHTML = INSTRUMENTS.map(function(n){ return "<option value=\""+escapeHtml(n)+"\""+(n===selected?" selected":"")+">"+escapeHtml(n)+"</option>"; }).join(""); }
function hideAlert(){ const el=document.getElementById("formAlert"); el.classList.remove("show"); el.textContent=""; }
function showAlert(msg){ const el=document.getElementById("formAlert"); el.textContent=msg; el.classList.add("show"); }
function closeModal(){ document.getElementById("modalBg").classList.remove("show"); state.editingId=null; }
function readForm(){ return { name:document.getElementById("fName").value.trim(), instrument:document.getElementById("fInst").value, date:document.getElementById("fDate").value, start:document.getElementById("fStart").value, end:document.getElementById("fEnd").value, note:document.getElementById("fNote").value.trim() }; }

function openCreate(inst, date){
  const name=document.getElementById("userName").value.trim();
  state.editingId=null;
  document.getElementById("modalTitle").textContent="新增預約";
  document.getElementById("deleteBtn").style.display="none";
  document.getElementById("fName").value=name;
  fillInstOptions(inst||INSTRUMENTS[0]);
  document.getElementById("fDate").value=date||toISODate(new Date());
  document.getElementById("fStart").value="09:00"; document.getElementById("fEnd").value="18:00"; document.getElementById("fNote").value="";
  hideAlert(); document.getElementById("modalBg").classList.add("show"); if(!name) document.getElementById("fName").focus();
}
function openEdit(id){
  const b=state.bookings.find(function(x){return x.id===id;}); if(!b) return;
  state.editingId=id;
  document.getElementById("modalTitle").textContent="預約詳情";
  document.getElementById("deleteBtn").style.display="inline-block";
  document.getElementById("fName").value=b.name; fillInstOptions(b.instrument);
  document.getElementById("fDate").value=b.date; document.getElementById("fStart").value=b.start; document.getElementById("fEnd").value=b.end; document.getElementById("fNote").value=b.note||"";
  hideAlert(); document.getElementById("modalBg").classList.add("show");
}
function saveForm(){
  const data=readForm();
  if(!data.name) return showAlert("請填寫使用者名稱。");
  if(!data.instrument) return showAlert("請選擇儀器。");
  if(!data.date) return showAlert("請選擇預約日期。");
  if(!data.start||!data.end) return showAlert("請填寫開始與結束時間。");
  if(data.end<=data.start) return showAlert("結束時間必須晚於開始時間。");
  const candidate=Object.assign({}, data, { id: state.editingId || uid() });
  const conflict=findConflict(candidate, state.editingId);
  if(conflict) return showAlert("時段衝突："+conflict.date+" "+conflict.start+"–"+conflict.end+" 已由「"+conflict.name+"」預約"+(conflict.note?"（"+conflict.note+"）":"")+"。");
  if(state.editingId){ state.bookings=state.bookings.map(function(b){ return b.id===state.editingId ? Object.assign({},b,data) : b; }); toast("已更新預約"); }
  else { candidate.createdAt=new Date().toISOString(); state.bookings.push(candidate); toast("預約成功，正在存到 NAS"); }
  document.getElementById("userName").value=data.name; localStorage.setItem(USER_KEY, data.name);
  saveBookings(); closeModal(); render();
}
function deleteCurrent(){
  if(!state.editingId) return;
  const b=state.bookings.find(function(x){return x.id===state.editingId;});
  if(!confirm("確定取消「"+b.name+"」在 "+b.instrument+" / "+b.date+" "+b.start+"–"+b.end+" 的預約？")) return;
  state.bookings=state.bookings.filter(function(x){return x.id!==state.editingId;});
  saveBookings(); closeModal(); render(); toast("已取消預約");
}

function openIdb(){ return new Promise(function(resolve,reject){ const req=indexedDB.open(IDB_NAME,1); req.onupgradeneeded=function(){ req.result.createObjectStore("handles"); }; req.onsuccess=function(){ resolve(req.result); }; req.onerror=function(){ reject(req.error); }; }); }
function idbPut(handle){ return openIdb().then(function(db){ return new Promise(function(resolve,reject){ const tx=db.transaction("handles","readwrite"); tx.objectStore("handles").put(handle,"dir"); tx.oncomplete=function(){ resolve(); }; tx.onerror=function(){ reject(tx.error); }; }); }); }
function idbGet(){ return openIdb().then(function(db){ return new Promise(function(resolve,reject){ const req=db.transaction("handles","readonly").objectStore("handles").get("dir"); req.onsuccess=function(){ resolve(req.result||null); }; req.onerror=function(){ reject(req.error); }; }); }); }
async function ensurePerm(handle){ if(!handle||!handle.queryPermission) return false; const opts={mode:"readwrite"}; if(await handle.queryPermission(opts)==="granted") return true; return (await handle.requestPermission(opts))==="granted"; }
async function getNasFileHandle(create){ if(!state.nasDir) throw new Error("尚未連接 NAS 資料夾"); return state.nasDir.getFileHandle(NAS_FILE,{create:!!create}); }
async function readNasFile(){ const fh=await getNasFileHandle(false); const file=await fh.getFile(); state.nasFileMtime=file.lastModified; const data=JSON.parse(await file.text()); if(!Array.isArray(data)) throw new Error("NAS 檔案格式需為陣列"); return data; }
async function writeNasFile(){ if(!state.nasReady||!state.nasDir) return; const fh=await getNasFileHandle(true); const w=await fh.createWritable(); await w.write(JSON.stringify(state.bookings,null,2)); await w.close(); try{ state.nasFileMtime=(await fh.getFile()).lastModified; }catch(e){} setNasStatus("已存到 "+NAS_HINT+"\\"+NAS_FILE, true); }
async function importFromNas(silent){ try{ const data=await readNasFile(); state.bookings=data; saveBookingsLocal(); render(); setNasStatus("已從 NAS 匯入 "+data.length+" 筆", true); if(!silent) toast("已從共用資料夾匯入預約"); } catch(err){ if(err && (err.name==="NotFoundError" || String(err).indexOf("NotFound")!==-1)){ await writeNasFile(); setNasStatus("NAS 尚無檔案，已建立 "+NAS_FILE, true); return; } if(!silent) setNasStatus("匯入失敗："+err.message, false); } }
async function connectNasFolder(){ if(!window.showDirectoryPicker){ alert("請用 Chrome 或 Edge 開啟，才能連接 NAS 資料夾。"); return; } try{ const dir=await window.showDirectoryPicker({id:"lab-nas-chesterhsu", mode:"readwrite"}); if(!(await ensurePerm(dir))){ setNasStatus("未取得資料夾寫入權限", false); return; } state.nasDir=dir; state.nasReady=true; await idbPut(dir); await importFromNas(false); toast("已連接共用資料夾，預約完成會自動存回 NAS"); } catch(err){ if(err && err.name==="AbortError") return; setNasStatus("連接失敗："+(err.message||err), false); } }
async function restoreNasFolder(){ if(!window.showDirectoryPicker){ setNasStatus("請用 Chrome / Edge 連接 "+NAS_HINT, false); return; } try{ const dir=await idbGet(); if(!dir){ setNasStatus("請按「連接 NAS 資料夾」選取 "+NAS_HINT, false); return; } if(!(await ensurePerm(dir))){ setNasStatus("權限已過期，請再按「連接 NAS 資料夾」", false); return; } state.nasDir=dir; state.nasReady=true; await importFromNas(true); } catch(err){ setNasStatus("請按「連接 NAS 資料夾」選取 "+NAS_HINT, false); } }
async function pollNas(){ if(!state.nasReady||!state.nasDir) return; try{ const file=await (await getNasFileHandle(false)).getFile(); if(file.lastModified && file.lastModified!==state.nasFileMtime){ await importFromNas(true); toast("偵測到共用檔更新，已重新匯入"); } } catch(e){} }

function sampleBookings(){ return [["QL C band","2026-09-17","16:00","22:00","WG mixer1","SC26482-01 16點使用"],["QL C band","2026-09-18","15:30","22:00","OPA LT","下午3:30之後使用（可協調）"],["O band","2026-09-17","09:00","18:00","WG mixer1","SC26231-02"],["Toptica 1050","2026-09-17","09:00","18:00","WG OT1",""],["1064 放大器","2026-09-17","09:00","18:00","WG LT","SC26474-01"]].map(function(r){ return {id:uid(), instrument:r[0], date:r[1], start:r[2], end:r[3], name:r[4], note:r[5], createdAt:new Date().toISOString()}; }); }

document.getElementById("userName").value = localStorage.getItem(USER_KEY) || "";
document.getElementById("userName").addEventListener("change", function(e){ localStorage.setItem(USER_KEY, e.target.value.trim()); });
document.getElementById("prevWeek").onclick=function(){ state.weekStart.setDate(state.weekStart.getDate()-7); render(); };
document.getElementById("nextWeek").onclick=function(){ state.weekStart.setDate(state.weekStart.getDate()+7); render(); };
document.getElementById("thisWeek").onclick=function(){ state.weekStart=startOfWeek(new Date()); render(); };
document.getElementById("newBooking").onclick=function(){ openCreate(); };
document.getElementById("cancelBtn").onclick=closeModal;
document.getElementById("modalBg").addEventListener("click", function(e){ if(e.target.id==="modalBg") closeModal(); });
document.getElementById("saveBtn").onclick=saveForm;
document.getElementById("deleteBtn").onclick=deleteCurrent;
document.getElementById("loadSample").onclick=function(){ if(state.bookings.length && !confirm("將以範例週表覆蓋目前資料，確定嗎？")) return; state.bookings=sampleBookings(); saveBookings(); state.weekStart=startOfWeek(new Date("2026-09-17T00:00:00")); render(); };
document.getElementById("exportData").onclick=function(){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([JSON.stringify(state.bookings,null,2)],{type:"application/json"})); a.download=NAS_FILE; a.click(); };
document.getElementById("importBtn").onclick=function(){ document.getElementById("importFile").click(); };
document.getElementById("importFile").addEventListener("change", function(e){ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=function(){ try{ const data=JSON.parse(reader.result); if(!Array.isArray(data)) throw new Error("格式需為陣列"); state.bookings=data; saveBookings(); render(); toast("匯入完成"); }catch(err){ alert("匯入失敗："+err.message); } }; reader.readAsText(file); e.target.value=""; });
var nasBtn=document.getElementById("connectNas"); if(nasBtn) nasBtn.onclick=connectNasFolder;
var nasImportBtn=document.getElementById("importNas"); if(nasImportBtn) nasImportBtn.onclick=function(){ importFromNas(false); };
if(!state.bookings.length){ state.bookings=sampleBookings(); saveBookingsLocal(); }
render();
restoreNasFolder();
setInterval(pollNas, 8000);
