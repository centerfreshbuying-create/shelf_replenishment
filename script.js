const inventoryList = document.getElementById('inventory-list');
const addItemBtn = document.getElementById('add-item-btn');
const calculateBtn = document.getElementById('calculate-btn');
const results = document.getElementById('results');
const template = document.getElementById('inventory-row-template');

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
});

inventoryList.appendChild(
  createRow({
    sku: 'milk',
    on_hand: 4,
    safety_stock: 6,
    reorder_point: 10,
    reorder_quantity: 8,
  })
);

inventoryList.appendChild(
  createRow({
    sku: 'bread',
    on_hand: 12,
    safety_stock: 5,
    reorder_point: 10,
    reorder_quantity: 6,
  })
);

renderResults(calculatePlan(getInventoryItems()));
