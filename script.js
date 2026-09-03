const STORAGE_KEY = 'supermarket-replenishment-state';

const defaultInventory = [
  { sku: 'milk', upc: '000123456789', itemNumber: 'M-101', department: 'Dairy', location: 'Aisle 1', caseQuantity: 12, on_hand: 4, safety_stock: 6, reorder_point: 10, reorder_quantity: 8 },
  { sku: 'bread', upc: '000987654321', itemNumber: 'B-222', department: 'Bakery', location: 'Aisle 2', caseQuantity: 8, on_hand: 12, safety_stock: 5, reorder_point: 10, reorder_quantity: 6 },
  { sku: 'eggs', upc: '000456789123', itemNumber: 'E-303', department: 'Dairy', location: 'Aisle 3', caseQuantity: 15, on_hand: 15, safety_stock: 4, reorder_point: 10, reorder_quantity: 7 },
  { sku: 'juice', upc: '000654321987', itemNumber: 'J-404', department: 'Beverages', location: 'Aisle 5', caseQuantity: 10, on_hand: 3, safety_stock: 5, reorder_point: 8, reorder_quantity: 12 },
];

const defaultUsers = [
  { name: 'maria', password: 'worker123', role: 'employee', aisle: 'Aisle 1' },
  { name: 'jamal', password: 'warehouse123', role: 'warehouse', aisle: 'Receiving' },
  { name: 'anita', password: 'manager123', role: 'manager', aisle: 'All aisles' },
];

const state = loadState();

const scanInput = document.getElementById('scan-input');
const scanBtn = document.getElementById('scan-btn');
const manualLookupBtn = document.getElementById('manual-lookup-btn');
const createOrderBtn = document.getElementById('create-order-btn');
const lowStockList = document.getElementById('low-stock-list');
const notificationList = document.getElementById('notification-list');
const outOfStockList = document.getElementById('out-of-stock-list');
const ordersList = document.getElementById('orders-list');
const warehouseOrders = document.getElementById('warehouse-orders');
const usersList = document.getElementById('users-list');
const userForm = document.getElementById('user-form');
const cameraModal = document.getElementById('camera-modal');
const cameraVideo = document.getElementById('camera-video');
const cameraStatus = document.getElementById('camera-status');
const quantityModal = document.getElementById('quantity-modal');
const quantityItemName = document.getElementById('quantity-item-name');
const quantityInput = document.getElementById('quantity-input');
let cameraStream;
let pendingScannedItem;
const inventoryUploadInput = document.getElementById('inventory-upload');
const importInventoryBtn = document.getElementById('import-inventory-btn');
const downloadTemplateBtn = document.getElementById('download-template-btn');
const importStatus = document.getElementById('import-status');

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
    if (saved) {
      saved.users = (saved.users || []).map((user) => ({
        name: user.name,
        password: user.password || '',
        role: user.role === 'Store Worker' ? 'employee' : user.role === 'Warehouse Picker' ? 'warehouse' : (user.role || 'employee').toLowerCase(),
        aisle: user.aisle || 'Not assigned',
      }));
      return saved;
    }
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
      <div>Requested by: ${order.employee}</div>
      <div>Created: ${order.createdAt}</div>
      <div>Items: ${order.items.map((item) => `${item.name} (${item.requested})`).join(', ')}</div>
    </div>
  `).join('');

  ordersList.innerHTML = orderCards || '<div class="list-item empty">No submitted orders yet.</div>';
}

function renderWarehouseOrders() {
  const cards = state.orders.filter((order) => !['Done', 'Out of Stock'].includes(order.status)).map((order) => `
    <div class="order-card">
      <div class="order-meta">
        <strong>${order.id}</strong>
        <span class="status-badge ${getStatusClass(order.status)}">${order.status}</span>
      </div>
      <div class="order-total">Complete order · ${order.items.length} items</div>
      <div>Enter the cases picked for every item, then accept once.</div>
      <ul>
        ${order.items.map((item, index) => `<li>${item.name}: requested ${item.requested} cases <input class="picked-input" data-order-id="${order.id}" data-item-index="${index}" type="number" min="0" value="${item.picked || 0}" /></li>`).join('')}
      </ul>
      <div class="button-row">
        <button class="primary" data-accept-order="${order.id}" type="button">Accept complete order</button>
        ${order.status === 'Accepted by Warehouse' ? `<button data-done-order="${order.id}" type="button">Done</button>` : ''}
      </div>
    </div>
  `).join('');

  warehouseOrders.innerHTML = cards || '<div class="list-item empty">No warehouse actions pending.</div>';

  warehouseOrders.querySelectorAll('.picked-input').forEach((input) => {
    input.addEventListener('change', () => {
      const order = state.orders.find((entry) => entry.id === input.dataset.orderId);
      if (order) order.items[Number(input.dataset.itemIndex)].picked = Math.max(0, Number(input.value) || 0);
      saveState();
    });
  });

  warehouseOrders.querySelectorAll('[data-accept-order]').forEach((button) => {
    button.addEventListener('click', () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.acceptOrder);
      if (order) {
        const hasZero = order.items.some((item) => Number(item.picked) === 0);
        order.status = hasZero ? 'Out of Stock' : 'Accepted by Warehouse';
        if (hasZero) {
          order.items.filter((item) => Number(item.picked) === 0).forEach((item) => {
            state.alerts.push({ item: item.name, upc: item.sku, requested: item.requested, fulfilled: 0, store: 'Store replenishment', warehouse: 'North Warehouse', date: new Date().toISOString().slice(0, 10), processedBy: 'Warehouse', reason: 'No cases available' });
          });
        }
        addNotification(`Warehouse accepted ${order.id}`);
        saveState();
        renderWarehouseOrders();
        renderOrders();
        renderDashboard();
      }
    });
  });

  warehouseOrders.querySelectorAll('[data-done-order]').forEach((button) => {
    button.addEventListener('click', () => {
      const order = state.orders.find((entry) => entry.id === button.dataset.doneOrder);
      if (order) {
        order.status = 'Done';
        addNotification(`${order.id} completed`);
        saveState();
        renderWarehouseOrders();
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
        <small>Aisle: ${user.aisle || 'Not assigned'}</small>
      </div>
      <div class="user-actions"><span class="status-badge success">${user.role}</span><button data-edit-user="${user.name}" type="button">Edit</button><button class="danger" data-delete-user="${user.name}" type="button">Delete</button></div>
    </div>
  `).join('');

  usersList.querySelectorAll('[data-edit-user]').forEach((button) => {
    button.addEventListener('click', () => {
      const user = state.users.find((entry) => entry.name === button.dataset.editUser);
      if (!user) return;
      const name = prompt('Username', user.name)?.trim();
      const aisle = prompt('Aisle', user.aisle || '')?.trim();
      if (name && aisle) {
        user.name = name;
        user.aisle = aisle;
        saveState();
        renderUsers();
      }
    });
  });

  usersList.querySelectorAll('[data-delete-user]').forEach((button) => {
    button.addEventListener('click', () => {
      state.users = state.users.filter((user) => user.name !== button.dataset.deleteUser);
      saveState();
      renderUsers();
      renderDashboard();
    });
  });
}

function setImportStatus(message, isError = false) {
  importStatus.textContent = message;
  importStatus.classList.toggle('empty', !isError);
  importStatus.style.color = isError ? '#b53d3d' : '#5d6980';
}

function normalizeInventoryRow(row) {
  const textValue = (value) => typeof value === 'string' ? value.trim() : (value ?? '').toString().trim();
  const normalizedKeys = Object.keys(row).reduce((keys, key) => {
    keys[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[key];
    return keys;
  }, {});
  const valueFor = (...names) => names.map((name) => normalizedKeys[name.toLowerCase().replace(/[^a-z0-9]/g, '')]).find((value) => value !== undefined && value !== '');
  const numberFor = (fallback, ...names) => {
    const value = Number(valueFor(...names));
    return Number.isFinite(value) ? value : fallback;
  };

  const sku = textValue(valueFor('sku', 'item', 'itemname', 'product', 'productname', 'description', 'name'));
  const itemNumber = textValue(valueFor('itemnumber', 'itemno', 'itemnumber', 'itemid', 'productid', 'number') || '');
  const upc = textValue(valueFor('upc', 'barcode', 'ean', 'gtin') || '');
  const department = textValue(valueFor('department', 'category', 'section', 'division') || 'General');
  const location = textValue(valueFor('location', 'aisle', 'shelf', 'shelfaddress', 'bin') || 'Main Floor');
  const caseQuantity = numberFor(1, 'casequantity', 'caseqty', 'casepack', 'packsize', 'unitspercase');
  const onHand = numberFor(0, 'onhand', 'quantity', 'qty', 'stock', 'currentstock', 'available');
  const safetyStock = numberFor(0, 'safetystock', 'safety', 'minimumstock', 'minstock');
  const reorderPoint = numberFor(0, 'reorderpoint', 'reorder', 'reorderlevel', 'parlevel', 'targetstock');
  const reorderQuantity = numberFor(1, 'reorderquantity', 'reorderqty', 'orderquantity', 'orderqty', 'suggestedorder');

  if (!sku && !upc && !itemNumber) return null;

  const normalizedSku = sku || `ITEM-${(upc || itemNumber || 'new').replace(/\s+/g, '-')}`;

  const item = {
    sku: normalizedSku,
    upc: upc || `${normalizedSku}-upc`,
    itemNumber: itemNumber || normalizedSku,
    department,
    location,
    caseQuantity: caseQuantity > 0 ? caseQuantity : 1,
    on_hand: onHand >= 0 ? onHand : 0,
    safety_stock: safetyStock >= 0 ? safetyStock : 0,
    reorder_point: reorderPoint >= 0 ? reorderPoint : 0,
    reorder_quantity: reorderQuantity > 0 ? reorderQuantity : 1,
  };

  Object.entries(row).forEach(([key, value]) => {
    if (!(key in item) && value !== '') item[key] = value;
  });
  return item;
}

function mergeInventory(existing, imported) {
  const next = [...existing];
  imported.forEach((item) => {
    const matchIndex = next.findIndex((current) => current.sku === item.sku || current.upc === item.upc || current.itemNumber === item.itemNumber);
    if (matchIndex >= 0) {
      next[matchIndex] = { ...next[matchIndex], ...item };
    } else {
      next.push(item);
    }
  });
  return next;
}

function importInventoryFromFile(file) {
  if (!file) {
    setImportStatus('Please select an Excel file first.', true);
    return;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(extension || '')) {
    setImportStatus('Please upload a .xlsx, .xls, or .csv file.', true);
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      if (typeof XLSX === 'undefined') throw new Error('Excel parser bundle is unavailable');
      const arrayBuffer = event.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });

      const importedItems = rows
        .map(normalizeInventoryRow)
        .filter(Boolean);

      if (!importedItems.length) {
        setImportStatus('The uploaded sheet could not be read. Please check the headers and column names.', true);
        return;
      }

      state.inventory = mergeInventory(state.inventory, importedItems);
      state.notifications.unshift(`Inventory imported from ${file.name} (${importedItems.length} items)`);
      state.notifications = state.notifications.slice(0, 8);
      saveState();
      renderDashboard();
      renderRefillList();
      setImportStatus(`Imported ${importedItems.length} items from ${file.name}.`);
      inventoryUploadInput.value = '';
    } catch (error) {
      console.error('Unable to import inventory file', error);
      setImportStatus('There was a problem reading the file. Please verify the Excel sheet format.', true);
    }
  };

  reader.readAsArrayBuffer(file);
}

function downloadInventoryTemplate() {
  const columns = ['sku', 'upc', 'itemNumber', 'department', 'location', 'caseQuantity', 'on_hand', 'safety_stock', 'reorder_point', 'reorder_quantity'];
  const example = ['example-item', '000000000000', 'ITEM-001', 'Grocery', 'Aisle 1', 12, 4, 6, 10, 8];
  if (typeof XLSX === 'undefined') {
    const csv = `${columns.join(',')}\n${example.join(',')}\n`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'inventory-import-template.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    setImportStatus('CSV inventory template downloaded.');
    return;
  }
  const worksheet = XLSX.utils.aoa_to_sheet([columns, example]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
  XLSX.writeFile(workbook, 'inventory-import-template.xlsx');
  setImportStatus('Inventory template downloaded.');
}

function renderNotifications() {
  notificationList.innerHTML = state.notifications.slice(0, 5).map((message) => `<div class="list-item">${message}</div>`).join('');
}

function renderDashboard() {
  const lowStock = state.inventory.filter((item) => item.on_hand + item.safety_stock <= item.reorder_point).length;
  const outOfStock = state.alerts.length;
  const openOrders = state.orders.filter((order) => !['Done', 'Out of Stock', 'Cancelled'].includes(order.status)).length;

  document.getElementById('low-stock-count').textContent = lowStock;
  document.getElementById('out-of-stock-count').textContent = outOfStock;
  document.getElementById('open-orders').textContent = openOrders;
  document.getElementById('active-users').textContent = state.users.length;
  document.getElementById('inventory-item-count').textContent = `${state.inventory.length} items`;
  document.getElementById('replenishment-task-count').textContent = `${lowStock} tasks`;

  const urgent = state.inventory.filter((item) => item.on_hand + item.safety_stock <= item.reorder_point);
  lowStockList.innerHTML = urgent.length
    ? urgent.map((item) => `<div class="list-item"><strong>${item.sku}</strong> · ${item.department} · reorder qty ${item.reorder_quantity}</div>`).join('')
    : '<div class="list-item empty">No urgent stock issues.</div>';

  renderNotifications();
  renderAlerts();
  renderUsers();
  renderOrders();
  renderWarehouseOrders();
}

function addNotification(message) {
  state.notifications.unshift(message);
  state.notifications = state.notifications.slice(0, 8);
  saveState();
  renderNotifications();
}

function getStatusClass(status) {
  if (['Submitted', 'Accepted by Warehouse'].includes(status)) return 'warning';
  if (['Done'].includes(status)) return 'success';
  if (['Out of Stock', 'Cancelled'].includes(status)) return 'danger';
  return '';
}

function showQuantityModal(item) {
  pendingScannedItem = item;
  quantityItemName.textContent = `${item.sku} · ${item.department}`;
  quantityInput.value = '1';
  quantityModal.hidden = false;
  quantityInput.focus();
}

function addScannedItem(item, quantity) {
  state.refillList.push({
    sku: item.sku,
    name: item.sku,
    quantity,
    department: item.department,
    location: item.location,
    employee: 'Current employee',
  });

  saveState();
  renderRefillList();
  addNotification(`${item.sku} added to shelf refill list`);
  quantityModal.hidden = true;
}

function lookupTypedBarcode() {
  const item = findInventoryItemByBarcode(scanInput.value);
  updateItemDetails(item);
  if (item) showQuantityModal(item);
  else alert('No item found for that barcode.');
}

async function openCameraScanner() {
  cameraModal.hidden = false;
  cameraStatus.textContent = 'Point the camera at the barcode. Scanning automatically...';
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStatus.textContent = 'Camera access is not available. Enter the barcode below instead.';
    return;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    cameraVideo.srcObject = cameraStream;
    requestAnimationFrame(scanCameraBarcode);
  } catch (error) {
    cameraStatus.textContent = 'Camera access was blocked. Enter the barcode below instead.';
  }
}

function closeCameraScanner() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  cameraVideo.srcObject = null;
  cameraModal.hidden = true;
}

async function scanCameraBarcode() {
  if (!('BarcodeDetector' in window)) {
    cameraStatus.textContent = 'Automatic barcode reading is not supported in this browser. Enter the barcode below.';
    return;
  }
  const detector = new BarcodeDetector();
  const codes = await detector.detect(cameraVideo);
  if (!codes.length) {
    if (!cameraModal.hidden) requestAnimationFrame(scanCameraBarcode);
    return;
  }
  scanInput.value = codes[0].rawValue;
  const item = findInventoryItemByBarcode(codes[0].rawValue);
  closeCameraScanner();
  if (item) {
    updateItemDetails(item);
    showQuantityModal(item);
  } else alert('Barcode scanned, but no matching item is in inventory.');
}

createOrderBtn.addEventListener('click', () => {
  if (!state.refillList.length) {
    alert('Add at least one item to the refill list before creating the order.');
    return;
  }

  const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const order = {
    id: orderId,
    employee: 'Current employee',
    location: 'Store replenishment',
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
  state.notifications.unshift(`New refill order ${orderId} submitted by Current employee`);
  saveState();
  renderRefillList();
  renderOrders();
  renderWarehouseOrders();
  renderDashboard();
  alert(`Order ${orderId} sent as one complete order.`);
});

userForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.getElementById('user-name').value.trim();
  const aisle = document.getElementById('user-aisle').value.trim();
  const role = document.getElementById('user-role').value.trim();
  const password = document.getElementById('user-password').value;

  if (!name || !aisle || !role || !password) return;

  state.users.push({ name, role, password, aisle });
  saveState();
  userForm.reset();
  renderUsers();
  renderDashboard();
});

importInventoryBtn.addEventListener('click', () => {
  const file = inventoryUploadInput.files[0];
  importInventoryFromFile(file);
});

inventoryUploadInput.addEventListener('change', () => {
  const file = inventoryUploadInput.files[0];
  if (file) {
    setImportStatus(`Selected file: ${file.name}`);
  }
});

downloadTemplateBtn.addEventListener('click', downloadInventoryTemplate);

scanBtn.addEventListener('click', openCameraScanner);
manualLookupBtn.addEventListener('click', lookupTypedBarcode);
document.getElementById('close-camera-btn').addEventListener('click', closeCameraScanner);
document.getElementById('cancel-quantity-btn').addEventListener('click', () => { quantityModal.hidden = true; });
document.getElementById('confirm-quantity-btn').addEventListener('click', () => {
  if (pendingScannedItem) addScannedItem(pendingScannedItem, Math.max(1, Number(quantityInput.value) || 1));
});

document.querySelectorAll('[data-tab]').forEach((tab) => {
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
renderUsers();
updateItemDetails(findInventoryItemByBarcode('000123456789'));
