const STORAGE_KEY = "shiguang-ledger-transactions-v1";
const APP_VERSION = "1.2.0";
const BACKUP_FORMAT = "shiguang-ledger-backup";
const MAX_BACKUP_SIZE = 5 * 1024 * 1024;
const LATEST_RELEASE_URL = "https://api.github.com/repos/yang967967-rgb/shiguang-ledger/releases/latest";

const categories = {
  expense: [
    ["餐饮", "🍜"],
    ["交通", "🚌"],
    ["购物", "🛍️"],
    ["居住", "🏠"],
    ["学习", "📚"],
    ["娱乐", "🎬"],
    ["医疗", "💊"],
    ["其他", "•••"],
  ],
  income: [
    ["工资", "💼"],
    ["兼职", "🧑‍💻"],
    ["奖学金", "🎓"],
    ["红包", "🧧"],
    ["理财", "📈"],
    ["其他", "＋"],
  ],
};

const dateInput = document.querySelector("#selectedDate");
const weekdayLabel = document.querySelector("#dateWeekday");
const entryDialog = document.querySelector("#entryDialog");
const entryForm = document.querySelector("#entryForm");
const entryDate = document.querySelector("#entryDate");
const categorySelect = document.querySelector("#category");
const transactionList = document.querySelector("#transactionList");
const emptyState = document.querySelector("#emptyState");
const formError = document.querySelector("#formError");
const importDialog = document.querySelector("#importDialog");
const importForm = document.querySelector("#importForm");
const backupFile = document.querySelector("#backupFile");
const backupText = document.querySelector("#backupText");
const importError = document.querySelector("#importError");
const toast = document.querySelector("#toast");
const updateButton = document.querySelector("#checkUpdate");
const updateStatus = document.querySelector("#updateStatus");

let transactions = loadTransactions();
let toastTimer;
let availableUpdate = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromString(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function money(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
  }).format(value);
}

function loadTransactions() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function normalizedVersion(value) {
  return String(value || "")
    .replace(/^v/i, "")
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(candidate, current) {
  const next = normalizedVersion(candidate);
  const installed = normalizedVersion(current);
  for (let index = 0; index < 3; index += 1) {
    if (next[index] !== installed[index]) return next[index] > installed[index];
  }
  return false;
}

async function checkForUpdate(silent = false) {
  updateButton.disabled = true;
  if (!silent) updateStatus.textContent = "正在检查新版本…";

  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`检查更新失败（${response.status}）`);

    const release = await response.json();
    const apk = release.assets?.find((asset) => asset.name?.toLowerCase().endsWith(".apk"));
    const version = String(release.tag_name || "").replace(/^v/i, "");

    if (apk && isNewerVersion(version, APP_VERSION)) {
      availableUpdate = { version, url: apk.browser_download_url };
      updateStatus.textContent = `发现新版本 v${version}，可直接下载安装。`;
      updateButton.textContent = `下载 v${version}`;
      showToast(`发现拾光账本 v${version}。`);
    } else {
      availableUpdate = null;
      updateStatus.textContent = `当前已是最新版本 v${APP_VERSION}。`;
      updateButton.textContent = "重新检查";
      if (!silent) showToast("当前已是最新版本。 ");
    }
  } catch (error) {
    availableUpdate = null;
    updateStatus.textContent = "暂时无法检查更新，请确认网络连接后重试。";
    updateButton.textContent = "重新检查";
    if (!silent) showToast(error.message || "检查更新失败。 ");
  } finally {
    updateButton.disabled = false;
  }
}

async function downloadUpdate() {
  if (!availableUpdate) {
    await checkForUpdate(false);
    return;
  }

  updateButton.disabled = true;
  updateButton.textContent = "正在下载…";
  updateStatus.textContent = "正在安全下载更新，完成后会打开安卓安装确认页。";

  try {
    const updater = globalThis.Capacitor?.Plugins?.AppUpdater;
    if (isNativeApp && updater?.downloadAndInstall) {
      await updater.downloadAndInstall({ url: availableUpdate.url });
      updateStatus.textContent = "更新已下载，请在安卓系统界面确认安装。";
    } else {
      window.open(availableUpdate.url, "_blank", "noopener");
      updateStatus.textContent = "已打开 APK 下载页面。";
    }
  } catch (error) {
    const needsPermission = error?.code === "INSTALL_PERMISSION_REQUIRED";
    updateStatus.textContent = needsPermission
      ? "请允许拾光账本安装未知应用，返回后再次点击下载。"
      : "更新失败，请稍后重试。";
    showToast(error?.message || "更新失败，请稍后重试。 ");
  } finally {
    updateButton.disabled = false;
    updateButton.textContent = availableUpdate ? `下载 v${availableUpdate.version}` : "检查更新";
  }
}

function createBackup() {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      formatVersion: 1,
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      transactionCount: transactions.length,
      transactions,
    },
    null,
    2,
  );
}

async function exportBackup() {
  const content = createBackup();
  const filename = `shiguang-ledger-backup-${localDateString()}.json`;
  const file = new File([content], filename, { type: "application/json" });

  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "拾光账本数据备份",
        text: "请妥善保存此备份文件，其中包含完整账目。",
        files: [file],
      });
      showToast("备份已交给系统分享，请选择安全位置保存。 ");
      return;
    }
  } catch (error) {
    if (error.name === "AbortError") return;
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  try {
    await navigator.clipboard?.writeText(content);
    showToast("已尝试下载备份，并复制备份文本；若没有文件，请粘贴文本保存。 ");
  } catch {
    showToast("已尝试下载备份；请检查系统的下载文件夹。 ");
  }
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateFromString(value);
  return !Number.isNaN(date.getTime()) && localDateString(date) === value;
}

function normalizeImportedTransaction(item, index) {
  if (!item || typeof item !== "object") throw new Error(`第 ${index + 1} 条记录不是有效对象。`);

  const type = item.type;
  const amount = Number(item.amount);
  const date = String(item.date || "");
  const category = String(item.category || "").trim();
  const note = String(item.note || "").trim();
  const createdAt = Number(item.createdAt);

  if (!['expense', 'income'].includes(type)) throw new Error(`第 ${index + 1} 条记录的收支类型无效。`);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new Error(`第 ${index + 1} 条记录的金额无效。`);
  if (!isValidDate(date)) throw new Error(`第 ${index + 1} 条记录的日期无效。`);
  if (!category || category.length > 20) throw new Error(`第 ${index + 1} 条记录的分类无效。`);
  if (note.length > 100) throw new Error(`第 ${index + 1} 条记录的备注过长。`);

  return {
    id: typeof item.id === "string" && item.id.length <= 120 ? item.id : `import-${date}-${type}-${amount}-${index}`,
    type,
    amount: Math.round(amount * 100) / 100,
    date,
    category,
    note,
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now() + index,
  };
}

function parseBackup(content) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("无法读取备份，请确认内容是完整的 JSON 文件。 ");
  }

  const items = Array.isArray(parsed) ? parsed : parsed?.transactions;
  if (!Array.isArray(items)) throw new Error("这不是拾光账本支持的备份格式。 ");
  if (items.length > 100000) throw new Error("备份记录过多，暂时无法导入。 ");
  return items.map(normalizeImportedTransaction);
}

async function importBackup(event) {
  event.preventDefault();
  importError.textContent = "";

  try {
    const file = backupFile.files[0];
    if (file && file.size > MAX_BACKUP_SIZE) throw new Error("备份文件不能超过 5 MB。 ");
    const content = file ? await file.text() : backupText.value.trim();
    if (!content) throw new Error("请选择备份文件，或粘贴备份文本。 ");

    const imported = parseBackup(content);
    const existingIds = new Set(transactions.map((item) => item.id));
    const newItems = imported.filter((item) => !existingIds.has(item.id));
    const duplicateCount = imported.length - newItems.length;

    if (newItems.length === 0) {
      importDialog.close();
      showToast(`没有新增记录，已跳过 ${duplicateCount} 条重复数据。`);
      return;
    }

    const confirmed = window.confirm(`将新增 ${newItems.length} 条记录${duplicateCount ? `，跳过 ${duplicateCount} 条重复记录` : ""}。确定导入吗？`);
    if (!confirmed) return;

    transactions = [...transactions, ...newItems];
    saveTransactions();
    importDialog.close();
    updateDateDisplay();
    showToast(`成功导入 ${newItems.length} 条记录。`);
  } catch (error) {
    importError.textContent = error.message || "导入失败，请检查备份文件。 ";
  }
}

function getCategoryIcon(type, name) {
  return categories[type]?.find(([category]) => category === name)?.[1] ?? "•";
}

function updateCategoryOptions(type) {
  categorySelect.innerHTML = "";
  categories[type].forEach(([name, icon]) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${icon} ${name}`;
    categorySelect.append(option);
  });
}

function totalFor(predicate) {
  return transactions
    .filter(predicate)
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
}

function updateSummary() {
  const selected = dateInput.value;
  const selectedYear = selected.slice(0, 4);
  const selectedMonth = selected.slice(0, 7);

  const dailyExpense = totalFor((item) => item.date === selected && item.type === "expense");
  const dailyIncome = totalFor((item) => item.date === selected && item.type === "income");
  const monthlyExpense = totalFor((item) => item.date.startsWith(selectedMonth) && item.type === "expense");
  const yearlyExpense = totalFor((item) => item.date.startsWith(selectedYear) && item.type === "expense");

  document.querySelector("#dailyExpense").textContent = money(dailyExpense);
  document.querySelector("#dailyIncome").textContent = money(dailyIncome);
  document.querySelector("#monthlyExpense").textContent = money(monthlyExpense);
  document.querySelector("#yearlyExpense").textContent = money(yearlyExpense);
  document.querySelector("#monthlyLabel").textContent = `${Number(selected.slice(5, 7))}月支出`;
  document.querySelector("#yearlyLabel").textContent = `${selectedYear}年支出`;
}

function renderTransactions() {
  const dailyItems = transactions
    .filter((item) => item.date === dateInput.value)
    .sort((a, b) => b.createdAt - a.createdAt);

  transactionList.innerHTML = "";
  emptyState.hidden = dailyItems.length > 0;
  document.querySelector("#recordCount").textContent = `${dailyItems.length} 笔`;

  dailyItems.forEach((item) => {
    const fragment = document.querySelector("#transactionTemplate").content.cloneNode(true);
    const article = fragment.querySelector(".transaction-item");
    const amount = fragment.querySelector(".transaction-amount");

    article.classList.add(item.type);
    fragment.querySelector(".category-icon").textContent = getCategoryIcon(item.type, item.category);
    fragment.querySelector(".transaction-category").textContent = item.category;
    fragment.querySelector(".transaction-note").textContent = item.note || (item.type === "expense" ? "日常支出" : "日常收入");
    amount.classList.add(item.type);
    amount.textContent = `${item.type === "expense" ? "−" : "+"}${money(item.amount)}`;
    fragment.querySelector(".transaction-time").textContent = new Date(item.createdAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    fragment.querySelector(".delete-button").addEventListener("click", () => deleteTransaction(item.id));
    transactionList.append(fragment);
  });
}

function updateDateDisplay() {
  const date = dateFromString(dateInput.value);
  weekdayLabel.textContent = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
  entryDate.value = dateInput.value;
  updateSummary();
  renderTransactions();
}

function changeDay(days) {
  const date = dateFromString(dateInput.value);
  date.setDate(date.getDate() + days);
  dateInput.value = localDateString(date);
  updateDateDisplay();
}

function deleteTransaction(id) {
  const item = transactions.find((transaction) => transaction.id === id);
  if (!item || !window.confirm(`确定删除这笔${item.type === "expense" ? "支出" : "收入"}吗？`)) return;
  transactions = transactions.filter((transaction) => transaction.id !== id);
  saveTransactions();
  updateDateDisplay();
}

function openDialog() {
  entryForm.reset();
  entryForm.querySelector('input[value="expense"]').checked = true;
  entryDate.value = dateInput.value;
  updateCategoryOptions("expense");
  formError.textContent = "";
  entryDialog.showModal();
  setTimeout(() => document.querySelector("#amount").focus(), 50);
}

document.querySelector("#previousDay").addEventListener("click", () => changeDay(-1));
document.querySelector("#nextDay").addEventListener("click", () => changeDay(1));
document.querySelector("#todayButton").addEventListener("click", () => {
  dateInput.value = localDateString();
  updateDateDisplay();
});
dateInput.addEventListener("change", updateDateDisplay);
document.querySelector("#openEntryDialog").addEventListener("click", openDialog);
document.querySelector("#closeEntryDialog").addEventListener("click", () => entryDialog.close());
document.querySelector("#exportBackup").addEventListener("click", exportBackup);
updateButton.addEventListener("click", downloadUpdate);
document.querySelector("#openImportDialog").addEventListener("click", () => {
  importForm.reset();
  importError.textContent = "";
  importDialog.showModal();
});
document.querySelector("#closeImportDialog").addEventListener("click", () => importDialog.close());
importForm.addEventListener("submit", importBackup);

entryDialog.addEventListener("click", (event) => {
  if (event.target === entryDialog) entryDialog.close();
});

importDialog.addEventListener("click", (event) => {
  if (event.target === importDialog) importDialog.close();
});

entryForm.querySelectorAll('input[name="type"]').forEach((input) => {
  input.addEventListener("change", () => updateCategoryOptions(input.value));
});

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(entryForm);
  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) {
    formError.textContent = "请输入大于 0 的有效金额。";
    return;
  }

  const transaction = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    type: formData.get("type"),
    amount: Math.round(amount * 100) / 100,
    date: formData.get("date"),
    category: formData.get("category"),
    note: String(formData.get("note") || "").trim(),
    createdAt: Date.now(),
  };

  transactions.push(transaction);
  saveTransactions();
  dateInput.value = transaction.date;
  entryDialog.close();
  updateDateDisplay();
});

dateInput.value = localDateString();
updateCategoryOptions("expense");
updateDateDisplay();

const isNativeApp = Boolean(globalThis.Capacitor?.isNativePlatform?.());

if (isNativeApp) setTimeout(() => checkForUpdate(true), 1500);

if ("serviceWorker" in navigator && location.protocol !== "file:" && !isNativeApp) {
  navigator.serviceWorker.register("service-worker.js");
}
