const INSTRUMENTS = [
  "QL C band",
  "O band",
  "E band",
  "Ti:sapphire",
  "Toptica 1050",
  "1064 放大器",
  "Santec C band",
  "Santec TSL-570-1 C band",
  "Santec TSL-570-2 C band",
  "Sacher1100-1190",
  "Sacher 790 ~840",
  "EPOPO 1950",
  "Toptica 950",
  "HCP - 2 um amplifier"
];

const STORAGE_KEY = "lab-instrument-bookings-v1";
const USER_KEY = "lab-instrument-username";
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function parseISO(s) {
  const parts = s.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function fmtHeader(iso) {
  const d = parseISO(iso);
  return (d.getMonth() + 1) + "/" + d.getDate() + "（" + WEEKDAYS[d.getDay()] + "）";
}

function loadBookings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveBookings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bookings));
}

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hues = [168, 198, 221, 32, 262, 142, 12, 285];
  const h = hues[Math.abs(hash) % hues.length];
  return "hsl(" + h + " 42% 36%)";
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(function () { el.classList.remove("show"); }, 2600);
}

function weekDates() {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(state.weekStart);
    d.setDate(d.getDate() + i);
    out.push(toISODate(d));
  }
  return out;
}

function overlaps(a, b) {
  return a.instrument === b.instrument && a.date === b.date && a.start < b.end && b.start < a.end;
}

function findConflict(candidate, ignoreId) {
  return state.bookings.find(function (b) {
    return b.id !== ignoreId && overlaps(candidate, b);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;")
    .replace(/'/g, "\u0026#39;");
}

function render() {
  const dates = weekDates();
  const today = toISODate(new Date());
  document.getElementById("weekLabel").textContent = fmtHeader(dates[0]) + " – " + fmtHeader(dates[5]);

  const table = document.getElementById("grid");
  let html = "<thead><tr><th class='inst'>儀器</th>";
  dates.forEach(function (iso) {
    html += "<th>" + fmtHeader(iso) + (iso === today ? " · 今天" : "") + "</th>";
  });
  html += "</tr></thead><tbody>";

  INSTRUMENTS.forEach(function (inst) {
    html += "<tr><td class=\"inst\">" + inst + "</td>";
    dates.forEach(function (iso) {
      const items = state.bookings
        .filter(function (b) { return b.instrument === inst && b.date === iso; })
        .sort(function (a, b) { return a.start.localeCompare(b.start); });
      html += "<td class=\"cell" + (iso === today ? " today" : "") + "\"><div class=\"cell-list\">";
      if (!items.length) html += "<div class=\"empty\">尚未預約</div>";
      items.forEach(function (b) {
        html += "<div class=\"booking\" data-id=\"" + b.id + "\" style=\"background:" + colorFor(b.name) + "\">" +
          "<div class=\"who\">" + escapeHtml(b.name) + "</div>" +
          "<div class=\"meta\">" + b.start + "–" + b.end + "</div>" +
          (b.note ? "<div>" + escapeHtml(b.note) + "</div>" : "") +
          "</div>";
      });
      html += "<div class=\"add\" data-inst=\"" + encodeURIComponent(inst) + "\" data-date=\"" + iso + "\">＋ 預約此時段</div>";
      html += "</div></td>";
    });
    html += "</tr>";
  });
  html += "</tbody>";
  table.innerHTML = html;

  table.querySelectorAll(".booking").forEach(function (el) {
    el.addEventListener("click", function () { openEdit(el.dataset.id); });
  });
  table.querySelectorAll(".add").forEach(function (el) {
    el.addEventListener("click", function () {
      openCreate(decodeURIComponent(el.dataset.inst), el.dataset.date);
    });
  });
}

function fillInstOptions(selected) {
  const sel = document.getElementById("fInst");
  sel.innerHTML = INSTRUMENTS.map(function (n) {
    return "<option value=\"" + escapeHtml(n) + "\"" + (n === selected ? " selected" : "") + ">" + escapeHtml(n) + "</option>";
  }).join("");
}

function openCreate(inst, date) {
  const name = document.getElementById("userName").value.trim();
  state.editingId = null;
  document.getElementById("modalTitle").textContent = "新增預約";
  document.getElementById("deleteBtn").style.display = "none";
  document.getElementById("fName").value = name;
  fillInstOptions(inst || INSTRUMENTS[0]);
  document.getElementById("fDate").value = date || toISODate(new Date());
  document.getElementById("fStart").value = "09:00";
  document.getElementById("fEnd").value = "18:00";
  document.getElementById("fNote").value = "";
  hideAlert();
  document.getElementById("modalBg").classList.add("show");
  if (!name) document.getElementById("fName").focus();
}

function openEdit(id) {
  const b = state.bookings.find(function (x) { return x.id === id; });
  if (!b) return;
  state.editingId = id;
  document.getElementById("modalTitle").textContent = "預約詳情";
  document.getElementById("deleteBtn").style.display = "inline-block";
  document.getElementById("fName").value = b.name;
  fillInstOptions(b.instrument);
  document.getElementById("fDate").value = b.date;
  document.getElementById("fStart").value = b.start;
  document.getElementById("fEnd").value = b.end;
  document.getElementById("fNote").value = b.note || "";
  hideAlert();
  document.getElementById("modalBg").classList.add("show");
}

function hideAlert() {
  const el = document.getElementById("formAlert");
  el.classList.remove("show");
  el.textContent = "";
}

function showAlert(msg) {
  const el = document.getElementById("formAlert");
  el.textContent = msg;
  el.classList.add("show");
}

function readForm() {
  return {
    name: document.getElementById("fName").value.trim(),
    instrument: document.getElementById("fInst").value,
    date: document.getElementById("fDate").value,
    start: document.getElementById("fStart").value,
    end: document.getElementById("fEnd").value,
    note: document.getElementById("fNote").value.trim()
  };
}

function uid() {
  return "b_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function saveForm() {
  const data = readForm();
  if (!data.name) return showAlert("請填寫使用者名稱。");
  if (!data.instrument) return showAlert("請選擇儀器。");
  if (!data.date) return showAlert("請選擇預約日期。");
  if (!data.start || !data.end) return showAlert("請填寫開始與結束時間。");
  if (data.end <= data.start) return showAlert("結束時間必須晚於開始時間。");

  const candidate = {
    name: data.name,
    instrument: data.instrument,
    date: data.date,
    start: data.start,
    end: data.end,
    note: data.note,
    id: state.editingId || uid()
  };
  const conflict = findConflict(candidate, state.editingId);
  if (conflict) {
    return showAlert("時段衝突：" + conflict.date + " " + conflict.start + "–" + conflict.end + " 已由「" + conflict.name + "」預約" + (conflict.note ? "（" + conflict.note + "）" : "") + "。");
  }

  if (state.editingId) {
    state.bookings = state.bookings.map(function (b) {
      return b.id === state.editingId ? Object.assign({}, b, data) : b;
    });
    toast("已更新預約");
  } else {
    candidate.createdAt = new Date().toISOString();
    state.bookings.push(candidate);
    toast("預約成功");
  }
  document.getElementById("userName").value = data.name;
  localStorage.setItem(USER_KEY, data.name);
  saveBookings();
  closeModal();
  render();
}

function deleteCurrent() {
  if (!state.editingId) return;
  const b = state.bookings.find(function (x) { return x.id === state.editingId; });
  if (!confirm("確定取消「" + b.name + "」在 " + b.instrument + " / " + b.date + " " + b.start + "–" + b.end + " 的預約？")) return;
  state.bookings = state.bookings.filter(function (x) { return x.id !== state.editingId; });
  saveBookings();
  closeModal();
  render();
  toast("已取消預約");
}

function closeModal() {
  document.getElementById("modalBg").classList.remove("show");
  state.editingId = null;
}

function sampleBookings() {
  const rows = [
    ["QL C band", "2026-09-17", "16:00", "22:00", "WG mixer1", "SC26482-01 16點使用"],
    ["QL C band", "2026-09-18", "15:30", "22:00", "OPA LT", "下午3:30之後使用（可協調）"],
    ["O band", "2026-09-17", "09:00", "18:00", "WG mixer1", "SC26231-02"],
    ["O band", "2026-09-18", "09:00", "18:00", "WG mixer1", "SC26421-01-D2-01 / PMC26016-02"],
    ["O band", "2026-09-21", "16:00", "22:00", "WG mixer1", "SC26231-02 16點使用"],
    ["O band", "2026-09-22", "16:00", "22:00", "WG mixer1", "PMCNew-26001 16點使用"],
    ["O band", "2026-09-23", "16:00", "22:00", "WG mixer1", "PMCNew-26001 16點使用"],
    ["Toptica 1050", "2026-09-17", "09:00", "18:00", "WG OT1", ""],
    ["Toptica 1050", "2026-09-18", "09:00", "18:00", "WG OT1", ""],
    ["Toptica 1050", "2026-09-24", "09:00", "18:00", "WG OT1", ""],
    ["1064 放大器", "2026-09-17", "09:00", "18:00", "WG LT", "SC26474-01"],
    ["1064 放大器", "2026-09-18", "09:00", "12:00", "C.H", "9點 SC26451-01"],
    ["1064 放大器", "2026-09-18", "12:00", "18:00", "WG LT", "SC26474-02"],
    ["1064 放大器", "2026-09-21", "09:00", "18:00", "WG LT", "SC26474-02"],
    ["1064 放大器", "2026-09-22", "09:00", "18:00", "WG LT", "SC26474-02"],
    ["1064 放大器", "2026-09-23", "09:00", "18:00", "WG LT", "SC26474-02"],
    ["1064 放大器", "2026-09-24", "09:00", "18:00", "WG LT", "SC26474-02"],
    ["Santec C band", "2026-09-17", "09:00", "18:00", "WG OT1", ""],
    ["Santec C band", "2026-09-18", "09:00", "18:00", "WG OT1", ""],
    ["Santec C band", "2026-09-21", "09:00", "18:00", "WG mixer1", "SC26476-03"],
    ["Santec C band", "2026-09-22", "09:00", "18:00", "WG OT1", ""],
    ["Santec TSL-570-1 C band", "2026-09-17", "09:00", "18:00", "WG mixer1", "SC26231-02"],
    ["Santec TSL-570-1 C band", "2026-09-18", "09:00", "18:00", "WG mixer3", "SC26588-02 / SC26415-01"],
    ["Santec TSL-570-1 C band", "2026-09-22", "09:00", "18:00", "WG OT2", "SC26555-01"],
    ["Santec TSL-570-2 C band", "2026-09-17", "09:00", "18:00", "WG OT2", "SC26442-01"],
    ["Santec TSL-570-2 C band", "2026-09-18", "09:00", "18:00", "SPA", ""],
    ["Santec TSL-570-2 C band", "2026-09-21", "09:00", "18:00", "SPA", ""],
    ["Santec TSL-570-2 C band", "2026-09-22", "09:00", "18:00", "SPA", ""],
    ["Santec TSL-570-2 C band", "2026-09-23", "09:00", "18:00", "SPA", ""],
    ["Santec TSL-570-2 C band", "2026-09-24", "09:00", "18:00", "SPA", ""],
    ["Sacher1100-1190", "2026-09-17", "09:00", "18:00", "WG mixer1", "SC26231-02"],
    ["Sacher1100-1190", "2026-09-18", "09:00", "18:00", "WG mixer2", "PMC26016-05"],
    ["Sacher1100-1190", "2026-09-22", "09:00", "18:00", "WG mixer2", "PMC26016-05"],
    ["Sacher1100-1190", "2026-09-23", "09:00", "18:00", "WG OT1", ""],
    ["Sacher 790 ~840", "2026-09-18", "09:00", "18:00", "CL/ackLairs", ""],
    ["Toptica 950", "2026-09-17", "09:00", "18:00", "WG mixer3", "SC26423-04"],
    ["Toptica 950", "2026-09-22", "09:00", "18:00", "WG mixer3", "SC26423-04"],
    ["Toptica 950", "2026-09-23", "09:00", "18:00", "WG OT2", "SC26519-01"],
    ["HCP - 2 um amplifier", "2026-09-17", "09:00", "18:00", "WG mixer1", "SC26231-02"],
    ["HCP - 2 um amplifier", "2026-09-18", "09:00", "18:00", "WG mixer1", "PMC26016-02"],
    ["HCP - 2 um amplifier", "2026-09-21", "16:00", "22:00", "WG mixer1", "SC26231-02 16點使用"]
  ];
  return rows.map(function (row) {
    return {
      id: uid(),
      instrument: row[0],
      date: row[1],
      start: row[2],
      end: row[3],
      name: row[4],
      note: row[5],
      createdAt: new Date().toISOString()
    };
  });
}

const state = {
  weekStart: startOfWeek(new Date("2026-09-17T00:00:00")),
  bookings: loadBookings(),
  editingId: null
};

document.getElementById("userName").value = localStorage.getItem(USER_KEY) || "";
document.getElementById("userName").addEventListener("change", function (e) {
  localStorage.setItem(USER_KEY, e.target.value.trim());
});
document.getElementById("prevWeek").onclick = function () {
  state.weekStart.setDate(state.weekStart.getDate() - 7);
  render();
};
document.getElementById("nextWeek").onclick = function () {
  state.weekStart.setDate(state.weekStart.getDate() + 7);
  render();
};
document.getElementById("thisWeek").onclick = function () {
  state.weekStart = startOfWeek(new Date());
  render();
};
document.getElementById("newBooking").onclick = function () { openCreate(); };
document.getElementById("cancelBtn").onclick = closeModal;
document.getElementById("modalBg").addEventListener("click", function (e) {
  if (e.target.id === "modalBg") closeModal();
});
document.getElementById("saveBtn").onclick = saveForm;
document.getElementById("deleteBtn").onclick = deleteCurrent;
document.getElementById("loadSample").onclick = function () {
  if (state.bookings.length && !confirm("將以範例週表覆蓋目前資料，確定嗎？")) return;
  state.bookings = sampleBookings();
  saveBookings();
  state.weekStart = startOfWeek(new Date("2026-09-17T00:00:00"));
  render();
  toast("已載入圖表中的範例預約");
};
document.getElementById("exportData").onclick = function () {
  const blob = new Blob([JSON.stringify(state.bookings, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "instrument-bookings.json";
  a.click();
};
document.getElementById("importBtn").onclick = function () {
  document.getElementById("importFile").click();
};
document.getElementById("importFile").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("格式需為陣列");
      state.bookings = data;
      saveBookings();
      render();
      toast("匯入完成");
    } catch (err) {
      alert("匯入失敗：" + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

if (!state.bookings.length) {
  state.bookings = sampleBookings();
  saveBookings();
}
render();
