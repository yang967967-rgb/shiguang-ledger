const STORAGE_KEY = "shiguang-ledger-transactions-v1";

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

let transactions = loadTransactions();

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

entryDialog.addEventListener("click", (event) => {
  if (event.target === entryDialog) entryDialog.close();
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

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("service-worker.js");
}
