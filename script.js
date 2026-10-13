const STORAGE_KEY = "expenseflow_transactions";

const $ = (id) => document.getElementById(id);

const form = $("expenseForm");
const titleInput = $("title");
const amountInput = $("amount");
const categoryInput = $("category");
const dateInput = $("date");
const expenseIdInput = $("expenseId");
const expenseList = $("expenseList");

let expenses = loadExpenses();

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

dateInput.value = today();

function loadExpenses() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (!Array.isArray(data)) return [];

    return data.filter(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.title === "string" &&
      Number.isFinite(Number(item.amount)) &&
      Number(item.amount) > 0 &&
      typeof item.category === "string" &&
      typeof item.date === "string"
    );
  } catch {
    return [];
  }
}

function saveExpenses() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    return true;
  } catch (error) {
    showMessage("Unable to save data. Check browser storage settings.", true);
    return false;
  }
}

function currency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-IN",
    { day: "2-digit", month: "short", year: "numeric" }
  );
}

function showMessage(message, error = false) {
  $("message").textContent = message;
  $("message").classList.toggle("error", error);
}

function resetForm() {
  form.reset();
  expenseIdInput.value = "";
  dateInput.value = today();

  $("formHeading").textContent = "Add an Expense";
  $("saveBtn").textContent = "＋ Save Expense";
  $("cancelBtn").classList.add("hidden");
}

function renderSummary() {
  const total = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount), 0
  );

  const currentMonth = today().slice(0, 7);

  const monthlyTotal = expenses
    .filter(expense => expense.date.startsWith(currentMonth))
    .reduce((sum, expense) => sum + Number(expense.amount), 0);

  $("totalAmount").textContent = currency(total);
  $("monthAmount").textContent = currency(monthlyTotal);
  $("transactionCount").textContent = expenses.length;
}

function getFilteredExpenses() {
  const search = $("search").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const from = $("fromDate").value;
  const to = $("toDate").value;
  const sort = $("sortBy").value;

  const filtered = expenses.filter(expense => {
    const matchesSearch =
      expense.title.toLowerCase().includes(search) ||
      expense.category.toLowerCase().includes(search);

    return matchesSearch &&
      (!category || expense.category === category) &&
      (!from || expense.date >= from) &&
      (!to || expense.date <= to);
  });

  const sorting = {
    newest: (a, b) => b.date.localeCompare(a.date) ||
      (b.createdAt || 0) - (a.createdAt || 0),
    oldest: (a, b) => a.date.localeCompare(b.date) ||
      (a.createdAt || 0) - (b.createdAt || 0),
    high: (a, b) => Number(b.amount) - Number(a.amount),
    low: (a, b) => Number(a.amount) - Number(b.amount),
    title: (a, b) => a.title.localeCompare(b.title)
  };

  return filtered.sort(sorting[sort] || sorting.newest);
}

function renderExpenses() {
  const visible = getFilteredExpenses();

  expenseList.innerHTML = visible.map(expense => `
    <tr>
      <td>
        <div class="expense-name">
          <span class="avatar">
            ${escapeHTML(expense.category.charAt(0))}
          </span>
          <span class="expense-title">
            ${escapeHTML(expense.title)}
          </span>
        </div>
      </td>

      <td>
        <span class="category-pill">
          ${escapeHTML(expense.category)}
        </span>
      </td>

      <td>${escapeHTML(formatDate(expense.date))}</td>

      <td class="amount right">
        ${currency(Number(expense.amount))}
      </td>

      <td>
        <div class="actions">
          <button class="action-btn"
            data-action="edit"
            data-id="${escapeHTML(expense.id)}">
            Edit
          </button>

          <button class="action-btn delete"
            data-action="delete"
            data-id="${escapeHTML(expense.id)}">
            Delete
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  $("emptyState").style.display = visible.length ? "none" : "block";

  $("resultCount").textContent =
    `Showing ${visible.length} of ${expenses.length} transactions`;
}

function render() {
  renderSummary();
  renderExpenses();
}

// Add or update an expense
form.addEventListener("submit", event => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const amount = Number(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value;

  if (!title || title.length > 70) {
    return showMessage("Enter a title between 1 and 70 characters.", true);
  }

  if (!Number.isFinite(amount) || amount <= 0 ||
      amount > 100000000) {
    return showMessage("Enter a valid amount greater than zero.", true);
  }

  if (!date || date > today()) {
    return showMessage("Please select a valid date no later than today.", true);
  }

  const existingId = expenseIdInput.value;

  if (existingId) {
    const index = expenses.findIndex(item => item.id === existingId);

    if (index !== -1) {
      expenses[index] = {
        ...expenses[index],
        title,
        amount: Math.round(amount * 100) / 100,
        category,
        date
      };
    }
  } else {
    expenses.push({
      id: crypto.randomUUID(),
      title,
      amount: Math.round(amount * 100) / 100,
      category,
      date,
      createdAt: Date.now()
    });
  }

  if (saveExpenses()) {
    showMessage(existingId
      ? "Expense updated successfully!"
      : "Expense added successfully!");

    resetForm();
    render();
  }
});

// Edit and delete actions
expenseList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const expense = expenses.find(
    item => item.id === button.dataset.id
  );

  if (!expense) return;

  if (button.dataset.action === "edit") {
    expenseIdInput.value = expense.id;
    titleInput.value = expense.title;
    amountInput.value = expense.amount;
    categoryInput.value = expense.category;
    dateInput.value = expense.date;

    $("formHeading").textContent = "Edit Expense";
    $("saveBtn").textContent = "Save Changes";
    $("cancelBtn").classList.remove("hidden");

    showMessage("Update the expense details and save your changes.");

    $("expenseSection").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    titleInput.focus();
  }

  if (button.dataset.action === "delete") {
    const confirmed = confirm(
      `Are you sure you want to delete "${expense.title}"?`
    );

    if (!confirmed) return;

    expenses = expenses.filter(item => item.id !== expense.id);

    if (saveExpenses()) {
      if (expenseIdInput.value === expense.id) {
        resetForm();
      }

      showMessage("Expense deleted successfully!");
      render();
    }
  }
});

// Cancel editing
$("cancelBtn").addEventListener("click", () => {
  resetForm();
  showMessage("");
});

// Add expense shortcut
$("addExpenseBtn").addEventListener("click", () => {
  resetForm();

  $("expenseSection").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  titleInput.focus();
});

// Search, filtering and sorting
["search", "categoryFilter", "fromDate", "toDate", "sortBy"]
  .forEach(id => {
    $(id).addEventListener("input", renderExpenses);
  });

// Clear all filters
$("clearFilters").addEventListener("click", () => {
  $("search").value = "";
  $("categoryFilter").value = "";
  $("fromDate").value = "";
  $("toDate").value = "";
  $("sortBy").value = "newest";

  renderExpenses();
});

// Export currently filtered records as CSV
$("exportBtn").addEventListener("click", () => {
  const records = getFilteredExpenses();

  const rows = [
    ["Expense Title", "Amount (INR)", "Category", "Date"],
    ...records.map(expense => [
      expense.title,
      Number(expense.amount).toFixed(2),
      expense.category,
      expense.date
    ])
  ];

  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value).replace(/"/g, '""')}"`
    ).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "expenseflow-transactions.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

render();