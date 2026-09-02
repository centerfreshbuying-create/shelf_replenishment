const STORAGE_KEY = 'supermarket-replenishment-state';

const defaultInventory = [
  { sku: 'milk', upc: '000123456789', itemNumber: 'M-101', department: 'Dairy', location: 'Aisle 1', caseQuantity: 12, on_hand: 4, safety_stock: 6, reorder_point: 10, reorder_quantity: 8 },
  { sku: 'bread', upc: '000987654321', itemNumber: 'B-222', department: 'Bakery', location: 'Aisle 2', caseQuantity: 8, on_hand: 12, safety_stock: 5, reorder_point: 10, reorder_quantity: 6 },
  { sku: 'eggs', upc: '000456789123', itemNumber: 'E-303', department: 'Dairy', location: 'Aisle 3', caseQuantity: 15, on_hand: 15, safety_stock: 4, reorder_point: 10, reorder_quantity: 7 },
  { sku: 'juice', upc: '000654321987', itemNumber: 'J-404', department: 'Beverages', location: 'Aisle 5', caseQuantity: 10, on_hand: 3, safety_stock: 5, reorder_point: 8, reorder_quantity: 12 },
];

const defaultUsers = [
  { name: 'Maria Gomez', role: 'Store Worker', email: 'maria@store.com' },
  { name: 'Jamal Lee', role: 'Warehouse Picker', email: 'jamal@warehouse.com' },
  { name: 'Anita Brooks', role: 'Manager', email: 'anita@manager.com' },
];

const state = loadState();

const scanInput = document.getElementById('scan-input');
const scanBtn = document.getElementById('scan-btn');
const refillForm = document.getElementById('refill-form');
const createOrderBtn = document.getElementById('create-order-btn');
const lowStockList = document.getElementById('low-stock-list');
const notificationList = document.getElementById('notification-list');
const outOfStockList = document.getElementById('out-of-stock-list');
const ordersList = document.getElementById('orders-list');
const warehouseOrders = document.getElementById('warehouse-orders');
const deliveryList = document.getElementById('delivery-list');
const usersList = document.getElementById('users-list');
const userForm = document.getElementById('user-form');

const itemFields = {
  name: document.getElementById('item-name'),
  upc: document.getElementById('item-upc'),
  number: document.getElementById('item-number'),
  department: document.getElementById('item-department'),
  location: document.getElementById('item-location'),
  caseQty: document.getElementById('item-case-qty'),
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch (error) {
    console.warn('Unable to load saved state', error);
  }

  return {
    inventory: defaultInventory,
    users: defaultUsers,
    refillList: [
      { sku: 'milk', name: 'Milk', quantity: 2, department: 'Dairy', location: 'Aisle 1', employee: 'Maria Gomez' },
      { sku: 'juice', name: 'Juice', quantity: 3, department: 'Beverages', location: 'Aisle 5', employee: 'Maria Gomez' },
    ],
    orders: [
      {
        id: 'ORD-1001',
        employee: 'Maria Gomez',
        location: 'Downtown Store',
        createdAt: '2026-09-02 08:30',
        status: 'Submitted',
        department: 'Dairy',
        items: [
          { sku: 'milk', name: 'Milk', requested: 2, picked: 2, unavailable: 0, reason: '', substitute: '' },
        ],
      },
    ],
    alerts: [
      { item: 'Juice', upc: '000654321987', requested: 6, fulfilled: 0, store: 'Downtown Store', warehouse: 'North Warehouse', date: '2026-09-02', processedBy: 'Jamal Lee', reason: 'No inventory available' },
    ],
    notifications: [
      'New refill order submitted for Downtown Store',
      'Warehouse accepted refill order ORD-1001',
      'Milk order is ready for delivery',
    ],
    activeTab: 'dashboard',
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findInventoryItemByBarcode(value) {
  const query = value.trim().toLowerCase();
  return state.inventory.find((item) => item.upc === query || item.sku.toLowerCase() === query || item.itemNumber.toLowerCase() === query);
}

function updateItemDetails(item) {
  if (!item) {
    itemFields.name.textContent = '-';
    itemFields.upc.textContent = '-';
    itemFields.number.textContent = '-';
    itemFields.department.textContent = '-';
    itemFields.location.textContent = '-';
    itemFields.caseQty.textContent = '-';
    return;
  }

  itemFields.name.textContent = item.sku;
  itemFields.upc.textContent = item.upc;
  itemFields.number.textContent = item.itemNumber;
  itemFields.department.textContent = item.department;
  itemFields.location.textContent = item.location;
  itemFields.caseQty.textContent = item.caseQuantity;
}

function renderRefillList() {
  const list = document.getElementById('refill-list');
  if (!state.refillList.length) {
    list.innerHTML = '<div class="list-item empty">No items on the refill list.</div>';
    return;
  }

  list.innerHTML = state.refillList.map((item, index) => `
    <div class="list-item">
      <div class="order-meta">
        <strong>${item.name}</strong>
        <button class="danger" data-remove-item="${index}" type="button">Remove</button>
      </div>
      <div>Qty: ${item.quantity} · Dept: ${item.department} · Location: ${item.location}</div>
    </div>
  `).join('');

  list.querySelectorAll('[data-remove-item]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.removeItem);
      state.refillList.splice(index, 1);
      saveState();
      renderRefillList();
      renderDashboard();
    });
  });
}

function renderOrders() {
  const orderCards = state.orders.map((order) => `
    <div class="order-card">
      <div class="order-meta">
        <strong>${order.id}</strong>
        <span class="status-badge ${getStatusClass(order.status)}">${order.status}</span>
      </div>
      <div>Employee: ${order.employee}</div>
      <div>Store: ${order.location}</div>
      <div>Created: ${order.createdAt}</div>
      <div>Items: ${order.items.map((item) => `${item.name} (${item.requested})`).join(', ')}</div>
    </div>
  `).join('');

  ordersList.innerHTML = orderCards || '<div class="list-item empty">No submitted orders yet.</div>';
}

function renderWarehouseOrders() {
  const cards = state.orders.map((order) => `
    <div class="order-card">
      <div class="order-meta">
        <strong>${order.id}</strong>
        <button data-accept-order="${order.id}" type="button">Accept order</button>
      </div>
      <div>Warehouse status: ${order.status}</div>
      <div>Items to pick:</div>
      <ul>
        ${order.items.map((item) => `<li>${item.name}: requested ${item.requested}, picked ${item.picked}, unavailable ${item.unavailable}</li>`).join('')}
      </ul>
      <div class="button-row">
        <button data-status-order="${order.id}" data-status="Partially Fulfilled" type="button">Partially fulfil</button>
        <button data-status-order="${order.id}" data-status="Fully Fulfilled" type="button">Fully fulfil</button>
        <button data-status-order="${order.id}" data-status="Out of Stock" type="button">Out of stock</button>
      </div>
    </div>
  `).join('');

  warehouseOrders.innerHTML = cards || '<div class="list-item empty">No warehouse actions pending.</div>';

  warehouseOrders.querySelectorAll('[data-accept-order]').forEach((button) => {
    button.addEventListener('click', () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.acceptOrder);
      if (order) {
        order.status = 'Accepted by Warehouse';
        addNotification(`Warehouse accepted ${order.id}`);
        saveState();
        renderWarehouseOrders();
        renderOrders();
        renderDashboard();
      }
    });
  });

  warehouseOrders.querySelectorAll('[data-status-order]').forEach((button) => {
    button.addEventListener('click', () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.statusOrder);
      if (order) {
        order.status = button.dataset.status;
        addNotification(`${order.id} marked as ${button.dataset.status}`);
        saveState();
        renderWarehouseOrders();
        renderOrders();
        renderDashboard();
      }
    });
  });
}

function renderDelivery() {
  const ready = state.orders.filter((order) => ['Ready for Delivery', 'In Transit', 'Delivered to Store', 'Stocked on Shelf'].includes(order.status));

  deliveryList.innerHTML = ready.length
    ? ready.map((order) => `
      <div class="order-card">
        <div class="order-meta">
          <strong>${order.id}</strong>
          <span class="status-badge ${getStatusClass(order.status)}">${order.status}</span>
        </div>
        <div>Order sent to store: ${order.location}</div>
        <div class="button-row">
          <button data-delivery-status="${order.id}" data-status="Ready for Delivery" type="button">Ready</button>
          <button data-delivery-status="${order.id}" data-status="In Transit" type="button">In transit</button>
          <button data-delivery-status="${order.id}" data-status="Delivered to Store" type="button">Delivered</button>
          <button data-delivery-status="${order.id}" data-status="Stocked on Shelf" type="button">Stocked</button>
        </div>
      </div>
    `).join('')
    : '<div class="list-item empty">No delivery activity.</div>';

  deliveryList.querySelectorAll('[data-delivery-status]').forEach((button) => {
    button.addEventListener('click', () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.deliveryStatus);
      if (order) {
        order.status = button.dataset.status;
        addNotification(`${order.id} moved to ${button.dataset.status}`);
        saveState();
        renderDelivery();
        renderOrders();
        renderDashboard();
      }
    });
  });
}

function renderAlerts() {
  const items = state.alerts;
  outOfStockList.innerHTML = items.length
    ? items.map((alert) => `
      <div class="alert-item">
        <div><strong>${alert.item}</strong> · ${alert.upc}</div>
        <div>Requested: ${alert.requested} · Fulfilled: ${alert.fulfilled}</div>
        <div>Store: ${alert.store} · Warehouse: ${alert.warehouse}</div>
        <div>Reason: ${alert.reason}</div>
      </div>
    `).join('')
    : '<div class="list-item empty">No stock alerts.</div>';
}

function renderUsers() {
  usersList.innerHTML = state.users.map((user) => `
    <div class="user-item">
      <div>
        <strong>${user.name}</strong><br />
        <span>${user.role}</span><br />
        <small>${user.email}</small>
      </div>
      <span class="status-badge success">Active</span>
    </div>
  `).join('');
}

function renderNotifications() {
  notificationList.innerHTML = state.notifications.slice(0, 5).map((message) => `<div class="list-item">${message}</div>`).join('');
}

function renderDashboard() {
  const lowStock = state.inventory.filter((item) => item.on_hand + item.safety_stock <= item.reorder_point).length;
  const outOfStock = state.alerts.length;
  const openOrders = state.orders.filter((order) => !['Fully Fulfilled', 'Delivered to Store', 'Stocked on Shelf', 'Cancelled'].includes(order.status)).length;

  document.getElementById('low-stock-count').textContent = lowStock;
  document.getElementById('out-of-stock-count').textContent = outOfStock;
  document.getElementById('open-orders').textContent = openOrders;
  document.getElementById('active-users').textContent = state.users.length;

  const urgent = state.inventory.filter((item) => item.on_hand + item.safety_stock <= item.reorder_point);
  lowStockList.innerHTML = urgent.length
    ? urgent.map((item) => `<div class="list-item"><strong>${item.sku}</strong> · ${item.department} · reorder qty ${item.reorder_quantity}</div>`).join('')
    : '<div class="list-item empty">No urgent stock issues.</div>';

  renderNotifications();
  renderAlerts();
  renderUsers();
  renderOrders();
  renderWarehouseOrders();
  renderDelivery();
}

function addNotification(message) {
  state.notifications.unshift(message);
  state.notifications = state.notifications.slice(0, 8);
  saveState();
  renderNotifications();
}

function getStatusClass(status) {
  if (['Partially Fulfilled', 'In Transit', 'Ready for Delivery', 'Submitted'].includes(status)) return 'warning';
  if (['Fully Fulfilled', 'Delivered to Store', 'Stocked on Shelf'].includes(status)) return 'success';
  if (['Out of Stock', 'Cancelled'].includes(status)) return 'danger';
  return '';
}

scanBtn.addEventListener('click', () => {
  const item = findInventoryItemByBarcode(scanInput.value);
  updateItemDetails(item);
});

refillForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const item = findInventoryItemByBarcode(scanInput.value);

  if (!item) {
    alert('Please scan a valid shelf barcode, UPC, SKU, or item number.');
    return;
  }

  const quantity = Number(document.getElementById('requested-qty').value) || 1;
  const employee = document.getElementById('employee-name').value.trim() || 'Maria Gomez';
  const storeLocation = document.getElementById('store-location').value.trim() || 'Downtown Store';

  state.refillList.push({
    sku: item.sku,
    name: item.sku,
    quantity,
    department: item.department,
    location: storeLocation,
    employee,
  });

  saveState();
  renderRefillList();
  addNotification(`${item.sku} added to shelf refill list`);
  refillForm.reset();
  document.getElementById('requested-qty').value = '1';
  document.getElementById('store-location').value = storeLocation;
  document.getElementById('employee-name').value = employee;
});

createOrderBtn.addEventListener('click', () => {
  const employee = document.getElementById('employee-name').value.trim() || 'Maria Gomez';
  const location = document.getElementById('store-location').value.trim() || 'Downtown Store';

  if (!state.refillList.length) {
    alert('Add at least one item to the refill list before creating the order.');
    return;
  }

  const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const order = {
    id: orderId,
    employee,
    location,
    createdAt: new Date().toLocaleString(),
    status: 'Submitted',
    department: state.refillList[0].department || 'General',
    items: state.refillList.map((entry) => ({
      sku: entry.sku,
      name: entry.name,
      requested: entry.quantity,
      picked: 0,
      unavailable: 0,
      substitute: '',
      reason: '',
    })),
  };

  state.orders.unshift(order);
  state.refillList = [];
  state.notifications.unshift(`New refill order ${orderId} submitted by ${employee}`);
  saveState();
  renderRefillList();
  renderOrders();
  renderWarehouseOrders();
  renderDashboard();
  alert(`Order ${orderId} sent to the warehouse.`);
});

userForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.getElementById('user-name').value.trim();
  const role = document.getElementById('user-role').value.trim();
  const email = document.getElementById('user-email').value.trim();

  if (!name || !role || !email) return;

  state.users.push({ name, role, email });
  saveState();
  userForm.reset();
  renderUsers();
  renderDashboard();
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const tabId = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tabId));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === tabId));
    state.activeTab = tabId;
    saveState();
  });
});

renderRefillList();
renderDashboard();
renderOrders();
renderWarehouseOrders();
renderDelivery();
renderUsers();
updateItemDetails(findInventoryItemByBarcode('000123456789'));
