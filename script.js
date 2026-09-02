const inventoryList = document.getElementById('inventory-list');
const addItemBtn = document.getElementById('add-item-btn');
const calculateBtn = document.getElementById('calculate-btn');
const createOrderBtn = document.getElementById('create-order-btn');
const results = document.getElementById('results');
const usersList = document.getElementById('users-list');
const lowStockList = document.getElementById('low-stock-list');
const template = document.getElementById('inventory-row-template');
const userForm = document.getElementById('user-form');

const state = {
  inventory: [
    { sku: 'milk', on_hand: 4, safety_stock: 6, reorder_point: 10, reorder_quantity: 8 },
    { sku: 'bread', on_hand: 12, safety_stock: 5, reorder_point: 10, reorder_quantity: 6 },
    { sku: 'eggs', on_hand: 15, safety_stock: 4, reorder_point: 10, reorder_quantity: 7 },
  ],
  users: [
    { name: 'Ava Patel', role: 'Buyer', email: 'ava@company.com' },
    { name: 'Liam Chen', role: 'Supervisor', email: 'liam@company.com' },
  ],
  plan: [],
};

function createRow(values = {}) {
  const row = template.content.firstElementChild.cloneNode(true);
  const inputs = row.querySelectorAll('input');

  inputs[0].value = values.sku || '';
  inputs[1].value = values.on_hand ?? 0;
  inputs[2].value = values.safety_stock ?? 0;
  inputs[3].value = values.reorder_point ?? 0;
  inputs[4].value = values.reorder_quantity ?? 1;

  row.querySelector('.remove-btn').addEventListener('click', () => {
    row.remove();
  });

  return row;
}

function syncInventoryRows() {
  const rows = Array.from(inventoryList.querySelectorAll('.inventory-row'));

  rows.forEach((row) => {
    const inputs = row.querySelectorAll('input');
    const sku = inputs[0].value.trim();
    if (!sku) return;

    const existing = state.inventory.find((item) => item.sku.toLowerCase() === sku.toLowerCase());
    if (existing) {
      inputs[1].value = existing.on_hand;
      inputs[2].value = existing.safety_stock;
      inputs[3].value = existing.reorder_point;
      inputs[4].value = existing.reorder_quantity;
    }
  });
}

function getInventoryItems() {
  return Array.from(inventoryList.querySelectorAll('.inventory-row')).map((row) => {
    const inputs = row.querySelectorAll('input');
    const sku = inputs[0].value.trim();

    if (!sku) {
      return null;
    }

    return {
      sku,
      on_hand: Number(inputs[1].value) || 0,
      safety_stock: Number(inputs[2].value) || 0,
      reorder_point: Number(inputs[3].value) || 0,
      reorder_quantity: Number(inputs[4].value) || 1,
    };
  }).filter(Boolean);
}

function calculatePlan(items) {
  return items
    .filter((item) => item.on_hand + item.safety_stock <= item.reorder_point)
    .map((item) => ({
      sku: item.sku,
      reorder_quantity: item.reorder_quantity,
      reason: 'below reorder point',
    }));
}

function renderResults(plan) {
  state.plan = plan;

  if (!plan.length) {
    results.textContent = 'No replenishment required.';
    results.className = 'results empty';
    return;
  }

  results.className = 'results';
  results.innerHTML = plan
    .map(
      (item) =>
        `<div class="result-item">${item.sku}: reorder ${item.reorder_quantity} units (${item.reason})</div>`
    )
    .join('');
}

function renderLowStock() {
  const lowStock = state.inventory.filter((item) => item.on_hand + item.safety_stock <= item.reorder_point);

  if (!lowStock.length) {
    lowStockList.innerHTML = '<div class="low-stock-item empty">No critical stock alerts.</div>';
    return;
  }

  lowStockList.innerHTML = lowStock
    .map(
      (item) =>
        `<div class="low-stock-item"><strong>${item.sku}</strong><br />Qty: ${item.on_hand} · Safety: ${item.safety_stock} · Reorder point: ${item.reorder_point}</div>`
    )
    .join('');
}

function renderUsers() {
  if (!state.users.length) {
    usersList.innerHTML = '<div class="user-item empty">No active users.</div>';
    return;
  }

  usersList.innerHTML = state.users
    .map(
      (user) =>
        `<div class="user-item"><div class="user-meta"><strong>${user.name}</strong><span>${user.role}</span><small>${user.email}</small></div><span class="badge">Active</span></div>`
    )
    .join('');
}

function renderStats() {
  const total = state.inventory.length;
  const lowStock = state.inventory.filter((item) => item.on_hand + item.safety_stock <= item.reorder_point).length;
  const activeUsers = state.users.length;

  document.getElementById('total-skus').textContent = total;
  document.getElementById('low-stock-count').textContent = lowStock;
  document.getElementById('active-users').textContent = activeUsers;
}

function renderInventoryFromState() {
  inventoryList.innerHTML = '';
  state.inventory.forEach((item) => {
    inventoryList.appendChild(createRow(item));
  });
}

function setActiveTab(tabId) {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === tabId);
  });
}

addItemBtn.addEventListener('click', () => {
  inventoryList.appendChild(
    createRow({
      sku: '',
      on_hand: 0,
      safety_stock: 0,
      reorder_point: 0,
      reorder_quantity: 1,
    })
  );
});

calculateBtn.addEventListener('click', () => {
  const items = getInventoryItems();
  if (!items.length) {
    renderResults([]);
    return;
  }

  renderResults(calculatePlan(items));
  state.inventory = items;
  renderStats();
  renderLowStock();
});

createOrderBtn.addEventListener('click', () => {
  if (!state.plan.length) {
    renderResults(calculatePlan(state.inventory.length ? state.inventory : getInventoryItems()));
  }

  results.innerHTML = `
    <div class="result-item">Purchase order created for ${state.plan.length || calculatePlan(getInventoryItems()).length} item(s).</div>
  `;
});

userForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const name = document.getElementById('user-name').value.trim();
  const role = document.getElementById('user-role').value.trim();
  const email = document.getElementById('user-email').value.trim();

  if (!name || !role || !email) return;

  state.users.push({ name, role, email });
  userForm.reset();
  renderUsers();
  renderStats();
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => setActiveTab(tab.dataset.tab));
});

renderInventoryFromState();
renderUsers();
renderLowStock();
renderStats();
renderResults(calculatePlan(state.inventory));
