const STORAGE_KEY = 'replenish-state';
const STATUSES = ['Draft', 'Submitted', 'Accepted by Warehouse', 'Picking in Progress', 'Partially Fulfilled', 'Fully Fulfilled', 'Out of Stock', 'Cancelled'];
const ROLE_LABELS = { employee: 'Employee', manager: 'Manager', warehouse: 'Warehouse', admin: 'Admin' };
const defaultInventory = [
  { description: 'Milk', upc: '000123456789', brand: 'Farm Fresh', size: '1 gal', location: 'Aisle 1', on_hand: 4, safety_stock: 6 },
  { description: 'Bread', upc: '000987654321', brand: 'Daily Bake', size: '20 oz', location: 'Aisle 2', on_hand: 12, safety_stock: 5 },
  { description: 'Eggs', upc: '000456789123', brand: 'Golden Hen', size: '12 ct', location: 'Aisle 3', on_hand: 15, safety_stock: 4 },
  { description: 'Juice', upc: '000654321987', brand: 'Orchard', size: '64 oz', location: 'Aisle 5', on_hand: 3, safety_stock: 5 },
];
const defaultUsers = [
  { name: 'maria', password: 'worker123', role: 'employee', aisle: 'Aisle 1' },
  { name: 'jamal', password: 'warehouse123', role: 'warehouse', aisle: 'Receiving' },
  { name: 'anita', password: 'manager123', role: 'manager', aisle: 'All aisles' },
  { name: 'admin', password: 'admin123', role: 'admin', aisle: 'All aisles' },
];
const state = loadState();
let currentView = state.view || 'home';
let currentUser = state.currentUser?.name ? state.users.find((user) => user.name === state.currentUser.name) || null : null;
let cameraStream, barcodeReader;
const $ = (id) => document.getElementById(id);

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}-${Date.now().toString().slice(-6)}`; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      const users = (saved.users?.length ? saved.users : [...defaultUsers]).map((user) => ({
        name: String(user.name || '').trim().toLowerCase(),
        password: String(user.password || ''),
        role: String(user.role || 'employee').trim().toLowerCase(),
        aisle: String(user.aisle || 'Not assigned'),
      })).filter((user) => user.name);
      const defaultAdmin = defaultUsers.find((user) => user.role === 'admin');
      const admin = users.find((user) => user.name === defaultAdmin.name);
      if (!admin) users.push({ ...defaultAdmin });
      else if (!admin.password) Object.assign(admin, defaultAdmin);
      return { ...saved, inventory: saved.inventory?.length ? saved.inventory : defaultInventory, users, orders: saved.orders || [], alerts: saved.alerts || [], activity: saved.activity || [] };
    }
  } catch (error) { console.warn('Saved state could not be loaded', error); }
  return { inventory: defaultInventory, users: defaultUsers, orders: [], alerts: [], activity: ['Replenish is ready.'], view: 'home', currentUser: defaultUsers[0] };
}

function save() { state.view = currentView; state.currentUser = currentUser; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function ensureAdminAccount() { const defaultAdmin = defaultUsers.find((user) => user.role === 'admin'); let admin = state.users.find((user) => String(user.name).toLowerCase() === defaultAdmin.name); if (!admin) { admin = { ...defaultAdmin }; state.users.push(admin); } else { admin.name = defaultAdmin.name; admin.password = defaultAdmin.password; admin.role = defaultAdmin.role; admin.aisle = defaultAdmin.aisle; } return admin; }
function notify(message) { state.activity.unshift(`${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${message}`); state.activity = state.activity.slice(0, 30); save(); }
function addEvent(order, label) { order.timeline ||= {}; order.timeline[label] = now(); }
function setView(view) { currentView = view; document.querySelectorAll('.view').forEach((element) => element.classList.toggle('active', element.id === `${view}-view`)); document.querySelectorAll('.nav-tab').forEach((button) => button.classList.toggle('active', button.dataset.view === view)); save(); render(); }
function itemByUpc(value) { const upc = String(value || '').trim(); return state.inventory.find((item) => String(item.upc) === upc); }
function lowStock(item) { return Number(item.on_hand) <= Number(item.safety_stock); }
function statusClass(status) { return status === 'Fully Fulfilled' ? 'success' : ['Out of Stock', 'Cancelled'].includes(status) ? 'danger' : status === 'Partially Fulfilled' ? 'warning' : ''; }

const permissions = { employee: ['home', 'scan'], warehouse: ['home', 'warehouse'], manager: ['home', 'manager'], admin: ['home', 'scan', 'warehouse', 'manager', 'admin'] };
function canAccess(view) { return currentUser && permissions[currentUser.role]?.includes(view); }
function showAuthenticatedApp() { const loginScreen = $('login-screen'); const appShell = document.querySelector('.app-shell'); if (loginScreen) loginScreen.hidden = Boolean(currentUser); if (appShell) appShell.hidden = !currentUser; }

function render() {
  showAuthenticatedApp();
  if (!currentUser) return;
  renderHome(); renderScan(); renderWarehouse(); renderManager(); renderUsers();
  $('current-user').textContent = `${currentUser.name} · ${ROLE_LABELS[currentUser.role] || currentUser.role}`;
  document.querySelectorAll('.nav-tab').forEach((button) => { button.hidden = !canAccess(button.dataset.view); });
  if (!canAccess(currentView)) setView('home');
}

function renderHome() {
  const drafts = state.refillList?.length || 0;
  const submitted = state.orders.filter((order) => order.status === 'Submitted').length;
  const done = state.orders.filter((order) => order.status === 'Fully Fulfilled').length;
  const outOfStock = state.alerts.length;
  $('stat-draft').textContent = drafts;
  $('stat-submitted').textContent = submitted;
  $('stat-done').textContent = done;
  $('stat-out').textContent = outOfStock;
  $('home-refill-count').textContent = `${drafts} items`;
  $('home-pick-count').textContent = `${submitted} waiting`;
  $('home-alert-count').textContent = `${outOfStock} alerts`;
}

function renderScan() {
  const list = state.refillList || (state.refillList = []);
  $('draft-count').textContent = `${list.length} items`;
  $('refill-list').innerHTML = list.map((item, index) => `<div class="list-row"><div><strong>${esc(item.description)}</strong><small>UPC ${esc(item.upc)} · ${item.quantity} cases${item.location ? ` · ${esc(item.location)}` : ''}</small></div><div class="button-row compact"><button data-minus-refill="${index}" type="button" aria-label="Remove one case">−</button><button class="primary" data-plus-refill="${index}" type="button" aria-label="Add one case">+</button><button class="danger" data-remove-refill="${index}" type="button">Remove</button></div></div>`).join('') || '<p class="helper">Scan an item to begin.</p>';
  document.querySelectorAll('[data-remove-refill]').forEach((button) => button.addEventListener('click', () => { list.splice(Number(button.dataset.removeRefill), 1); save(); render(); }));
  document.querySelectorAll('[data-plus-refill]').forEach((button) => button.addEventListener('click', () => { list[Number(button.dataset.plusRefill)].quantity += 1; save(); render(); }));
  document.querySelectorAll('[data-minus-refill]').forEach((button) => button.addEventListener('click', () => { const item = list[Number(button.dataset.minusRefill)]; if (item.quantity > 1) item.quantity -= 1; else list.splice(Number(button.dataset.minusRefill), 1); save(); render(); }));
}

function renderWarehouse() {
  const active = state.orders.filter((order) => !['Fully Fulfilled', 'Cancelled', 'Out of Stock'].includes(order.status));
  $('warehouse-orders').innerHTML = active.map((order) => `<article class="order-card"><div class="card-top"><div><strong>${esc(order.id)}</strong><small>${order.items.length} items · submitted ${new Date(order.createdAt).toLocaleString()}</small></div><span class="status ${statusClass(order.status)}">${esc(order.status)}</span></div><div class="pick-list">${order.items.map((item, index) => `<label><span><strong>${esc(item.description)}</strong><small>UPC ${esc(item.upc)} · ${esc(item.brand)} · ${esc(item.size)} · requested ${item.requested} cases</small></span><input class="picked-input" data-order="${order.id}" data-index="${index}" type="number" min="0" value="${item.picked || 0}" /></label>`).join('')}</div><div class="button-row"><button class="primary" data-accept-order="${order.id}" type="button">Accept complete order</button>${order.status === 'Accepted by Warehouse' ? `<button data-done-order="${order.id}" type="button">Done</button>` : ''}</div></article>`).join('') || '<p class="helper">No orders waiting.</p>';
  document.querySelectorAll('.picked-input').forEach((input) => input.addEventListener('change', () => { const order = state.orders.find((entry) => entry.id === input.dataset.order); if (order) order.items[Number(input.dataset.index)].picked = Math.max(0, Number(input.value) || 0); save(); }));
  document.querySelectorAll('[data-accept-order]').forEach((button) => button.addEventListener('click', () => acceptOrder(button.dataset.acceptOrder)));
  document.querySelectorAll('[data-done-order]').forEach((button) => button.addEventListener('click', () => finishOrder(button.dataset.doneOrder)));
}

function renderManager() {
  const query = ($('manager-search')?.value || '').toLowerCase();
  const complete = state.orders.filter((order) => ['Fully Fulfilled'].includes(order.status));
  $('manager-waiting').textContent = state.orders.filter((order) => order.status === 'Submitted').length;
  $('manager-fulfilled').textContent = complete.length;
  $('manager-inventory').innerHTML = state.inventory.filter((item) => JSON.stringify(item).toLowerCase().includes(query)).map((item) => `<div class="list-row"><div><strong>${esc(item.description)}</strong><small>UPC ${esc(item.upc)} · ${esc(item.brand)} · ${esc(item.size)}</small></div><span>${item.on_hand} on hand</span></div>`).join('') || '<p class="helper">No matching items.</p>';
  $('alerts-list').innerHTML = state.alerts.map((alert, index) => `<div class="alert-row"><strong>${esc(alert.description)}</strong><small>UPC ${esc(alert.upc)} · requested ${alert.requested} · fulfilled ${alert.fulfilled}</small><small>${esc(alert.reason)} · ${new Date(alert.createdAt).toLocaleString()}</small><button data-clear-alert="${index}" type="button">Clear</button></div>`).join('') || '<p class="helper">No active alerts.</p>';
  document.querySelectorAll('[data-clear-alert]').forEach((button) => button.addEventListener('click', () => { state.alerts.splice(Number(button.dataset.clearAlert), 1); notify('An alert was cleared'); render(); }));
}

function renderUsers() { $('users-list').innerHTML = state.users.map((user) => `<div class="list-row"><div><strong>${esc(user.name)}</strong><small>${ROLE_LABELS[user.role] || user.role} · ${esc(user.aisle)}</small></div><div class="button-row compact"><button data-edit-user="${esc(user.name)}" type="button">Edit</button><button class="danger" data-delete-user="${esc(user.name)}" type="button">Delete</button></div></div>`).join(''); document.querySelectorAll('[data-edit-user]').forEach((button) => button.addEventListener('click', () => editUser(button.dataset.editUser))); document.querySelectorAll('[data-delete-user]').forEach((button) => button.addEventListener('click', () => { state.users = state.users.filter((user) => user.name !== button.dataset.deleteUser); save(); render(); })); }

function autoAddItem(item) { state.refillList ||= []; const existing = state.refillList.find((entry) => entry.upc === item.upc); if (existing) existing.quantity += 1; else state.refillList.push({ upc: item.upc, description: item.description, quantity: 1, location: item.location || '' }); notify(`${item.description} added (1 case)`); render(); }
function handleBarcode(value) { const item = itemByUpc(value); $('scan-input').value = value; if (!item) { $('scan-status').textContent = `UPC ${value} not found.`; return; } $('item-details').innerHTML = `<strong>${esc(item.description)}</strong><span>UPC ${esc(item.upc)} · ${esc(item.brand)} · ${esc(item.size)}</span><span>${item.location ? `Location: ${esc(item.location)} · ` : ''}On hand: ${item.on_hand} · Safety: ${item.safety_stock}</span>`; autoAddItem(item); }

async function openCamera() { $('camera-modal').hidden = false; $('camera-status').textContent = 'Starting camera...'; try { const decoder = window.ZXingBrowser || window.ZXing; if (decoder?.BrowserMultiFormatReader) { barcodeReader = new decoder.BrowserMultiFormatReader(); barcodeReader.decodeFromVideoDevice(undefined, $('camera-video'), (result) => { if (result && !$('camera-modal').hidden) { closeCamera(); handleBarcode(result.text); } }); return; } if ('BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia) { cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); $('camera-video').srcObject = cameraStream; requestAnimationFrame(scanNativeBarcode); return; } throw new Error('No barcode decoder'); } catch (error) { console.error('Camera error', error); $('camera-status').textContent = 'Camera unavailable. Type UPC below.'; } }
async function scanNativeBarcode() { if ($('camera-modal').hidden) return; try { const detector = new BarcodeDetector(); const codes = await detector.detect($('camera-video')); if (codes.length) { closeCamera(); handleBarcode(codes[0].rawValue); return; } } catch (error) { /* Continue polling */ } requestAnimationFrame(scanNativeBarcode); }
function closeCamera() { barcodeReader?.reset(); barcodeReader = undefined; cameraStream?.getTracks().forEach((track) => track.stop()); cameraStream = undefined; $('camera-video').srcObject = null; $('camera-modal').hidden = true; }

function createOrder() { if (!state.refillList?.length) return alert('Add at least one scanned item first.'); const order = { id: id('ORD'), employee: currentUser.name, store: 'Main store', createdAt: now(), status: 'Submitted', items: state.refillList.map((item) => ({ ...item, requested: item.quantity, picked: 0, unavailable: 0 })), timeline: {} }; addEvent(order, 'requestCreated'); addEvent(order, 'submitted'); state.orders.unshift(order); state.refillList = []; notify(`${order.id} submitted by ${currentUser.name}`); render(); alert(`${order.id} sent to warehouse.`); }
function acceptOrder(orderId) { const order = state.orders.find((entry) => entry.id === orderId); if (!order) return; order.status = 'Accepted by Warehouse'; addEvent(order, 'accepted'); addEvent(order, 'pickStarted'); notify(`${order.id} accepted by warehouse`); render(); }
function finishOrder(orderId) { const order = state.orders.find((entry) => entry.id === orderId); if (!order) return; addEvent(order, 'pickCompleted'); const unavailable = order.items.filter((item) => Number(item.picked) === 0); order.items.forEach((item) => { item.unavailable = Math.max(0, item.requested - Number(item.picked || 0)); }); if (unavailable.length) { order.status = unavailable.length === order.items.length ? 'Out of Stock' : 'Partially Fulfilled'; unavailable.forEach((item) => state.alerts.push({ description: item.description, upc: item.upc, requested: item.requested, fulfilled: item.picked || 0, store: order.store, warehouse: 'North Warehouse', createdAt: now(), processedBy: currentUser.name, reason: 'No cases available' })); notify(`${order.id} generated ${unavailable.length} stock alert(s)`); } else { order.status = 'Fully Fulfilled'; notify(`${order.id} was fully fulfilled`); } save(); render(); }
function editUser(username) { const user = state.users.find((entry) => entry.name === username); if (!user) return; const name = prompt('Username', user.name); const password = prompt('Password', user.password); const role = prompt('Role: employee, warehouse, manager, or admin', user.role); const aisle = prompt('Aisle/Zone', user.aisle); if (name && password && aisle && ROLE_LABELS[role]) { Object.assign(user, { name: name.trim(), password, role, aisle: aisle.trim() }); save(); render(); } }

function normalizeRow(row) { const keys = Object.keys(row).reduce((all, key) => { all[key.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[key]; return all; }, {}); const value = (...names) => names.map((name) => keys[name.toLowerCase().replace(/[^a-z0-9]/g, '')]).find((entry) => entry !== undefined && entry !== ''); const description = String(value('desc', 'description', 'productdescription', 'itemdescription', 'name', 'productname') || '').trim(); let upc = String(value('code', 'upc', 'barcode', 'sku', 'itemnumber', 'itemcode') || '').replace(/\s+/g, '').trim(); if (/^\d+$/.test(upc) && upc.length < 12) upc = upc.padStart(12, '0'); if (!description || !upc) return null; return { description, upc, brand: String(value('brand', 'manufacturer') || '').trim(), size: String(value('size', 'uom', 'unitofmeasure') || '').trim(), location: String(value('location', 'aisle', 'bin') || '').trim(), on_hand: Number(value('onhand', 'quantityonhand', 'qtyonhand') || 0), safety_stock: Number(value('safetystock', 'minimumstock', 'minstock') || 0) }; }

function parseCsv(text) { const rows = []; let row = []; let value = ''; let quoted = false; for (let index = 0; index < text.length; index += 1) { const character = text[index]; const next = text[index + 1]; if (character === '"' && quoted && next === '"') { value += '"'; index += 1; } else if (character === '"') quoted = !quoted; else if (character === ',' && !quoted) { row.push(value); value = ''; } else if ((character === '\n' || character === '\r') && !quoted) { if (character === '\r' && next === '\n') index += 1; row.push(value); if (row.some((entry) => entry.trim())) rows.push(row); row = []; value = ''; } else value += character; } if (value || row.length) { row.push(value); rows.push(row); } const headers = rows.shift()?.map((header) => header.trim()) || []; return rows.map((values) => headers.reduce((record, header, index) => { record[header] = values[index] || ''; return record; }, {})); }

function rowsFromWorksheet(worksheet) { const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false }); const itemCodeHeaders = ['code', 'upc', 'barcode', 'sku', 'itemnumber', 'itemcode']; const descriptionHeaders = ['desc', 'description', 'productdescription', 'itemdescription', 'name', 'productname']; const headerIndex = matrix.findIndex((row) => row.some((cell) => itemCodeHeaders.includes(String(cell).toLowerCase().replace(/[^a-z0-9]/g, ''))) && row.some((cell) => descriptionHeaders.includes(String(cell).toLowerCase().replace(/[^a-z0-9]/g, '')))); if (headerIndex < 0) return []; const headers = matrix[headerIndex].map((header) => String(header).trim()); return matrix.slice(headerIndex + 1).filter((row) => row.some((cell) => String(cell).trim())).map((row) => headers.reduce((record, header, index) => { record[header] = row[index] ?? ''; return record; }, {})); }

function importInventory(file) { if (!file) { $('import-status').textContent = 'Choose an Excel or CSV file first.'; return; } const extension = file.name.split('.').pop().toLowerCase(); if (!['xlsx', 'xls', 'csv'].includes(extension)) { $('import-status').textContent = 'Choose Excel (.xlsx, .xls) or CSV.'; return; } const reader = new FileReader(); reader.onload = (event) => { try { let rows; if (extension === 'csv') { rows = parseCsv(event.target.result); } else { if (typeof XLSX === 'undefined') throw new Error('Excel parser unavailable'); const workbook = XLSX.read(event.target.result, { type: extension === 'xls' ? 'binary' : 'array', cellText: true, cellNF: false, WTF: false }); rows = workbook.SheetNames.flatMap((name) => rowsFromWorksheet(workbook.Sheets[name])); } const items = rows.map(normalizeRow).filter(Boolean); if (!items.length) throw new Error('No item rows found. Each item needs a description and code.'); state.inventory = [...state.inventory.filter((existing) => !items.some((item) => item.upc === existing.upc)), ...items]; notify(`${items.length} inventory items imported from ${file.name}`); $('import-status').textContent = `Imported ${items.length} items from ${file.name}.`; save(); render(); } catch (error) { console.error('Inventory import failed', error); $('import-status').textContent = `Import failed: ${error.message || 'Excel could not be read.'}`; } }; reader.onerror = () => { $('import-status').textContent = 'The selected file could not be opened.'; }; if (extension === 'csv') reader.readAsText(file, 'UTF-8'); else if (extension === 'xls') reader.readAsBinaryString(file); else reader.readAsArrayBuffer(file); }

function downloadTemplate() { const headers = ['Code', 'Desc', 'Brand', 'Size']; const example = ['000000000000', 'Example item', 'Example brand', 'Example size']; if (typeof XLSX === 'undefined') { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`${headers.join(',')}\n${example.join(',')}\n`], { type: 'text/csv' })); link.download = 'replenish-item-template.csv'; document.body.appendChild(link); link.click(); link.remove(); $('import-status').textContent = 'CSV template downloaded.'; return; } const sheet = XLSX.utils.aoa_to_sheet([headers, example]); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Items'); XLSX.writeFile(workbook, 'replenish-item-template.xlsx'); $('import-status').textContent = 'Excel template downloaded.'; }

document.querySelectorAll('[data-view]').forEach((element) => element.addEventListener('click', () => setView(element.dataset.view)));
function login() { ensureAdminAccount(); const username = $('login-username').value.trim().toLowerCase(); const password = $('login-password').value; const user = state.users.find((entry) => String(entry.name).trim().toLowerCase() === username && String(entry.password) === password); if (!user) { $('login-status').textContent = 'Username or password is incorrect.'; return; } currentUser = user; currentView = 'home'; save(); showAuthenticatedApp(); $('login-status').textContent = ''; try { render(); } catch (error) { console.error('Unable to render signed-in app', error); $('login-status').textContent = 'Signed in, but the dashboard could not load. Refresh the page.'; } }

$('login-form').addEventListener('submit', (event) => { event.preventDefault(); login(); });
$('logout-btn').addEventListener('click', () => { currentUser = null; currentView = 'home'; $('login-form').reset(); render(); });
$('scan-btn').addEventListener('click', openCamera);
$('manual-lookup-btn').addEventListener('click', () => handleBarcode($('scan-input').value));
$('close-camera-btn').addEventListener('click', closeCamera);
$('create-order-btn').addEventListener('click', createOrder);
$('manager-search').addEventListener('input', renderManager);
$('inventory-upload').addEventListener('change', (event) => importInventory(event.target.files[0]));
$('import-inventory-btn').addEventListener('click', () => importInventory($('inventory-upload').files[0]));
$('download-template-btn').addEventListener('click', downloadTemplate);
$('user-form').addEventListener('submit', (event) => { event.preventDefault(); const name = $('user-name').value.trim(); const password = $('user-password').value; const role = $('user-role').value; const aisle = $('user-aisle').value.trim(); if (!name || !password || !role || !aisle) return; state.users.push({ name, password, role, aisle }); event.target.reset(); notify(`${name} account added`); render(); });

render();
