# StockFlow Shelf Replenishment

A local-first supermarket shelf replenishment and warehouse picking app. The browser workflow is static, mobile-friendly, and persists demo data in local storage.

## Features

- Track inventory items with:
  - Description
  - UPC
  - Optional location
  - on-hand quantity
  - safety stock
- Validate inventory values before calculation
- Generate a replenishment plan for items that need restocking
- Run a simple local command-line entry point
- Use Dashboard, Shelf Scan, Orders, Warehouse, Delivery, and Admin options
- Import all inventory items from `.xlsx`, `.xls`, or `.csv` files
- Download an inventory import template with all supported replenishment fields
- Create one complete refill order from multiple shelf scans
- Record warehouse acceptance, picked cases, fulfillment exceptions, delivery handoffs, and shelf stocking
- Track order timestamps, activity history, employee roles, aisles, and out-of-stock alerts
- Search order history and inventory records

## Browser dashboard

Run the static app from the project folder:

```bash
python -m http.server 8080
```

Open `http://localhost:8080`. Use the current-user selector to exercise the store, warehouse, delivery, manager, and admin workflows. The app supports local camera barcode scanning through the bundled ZXing decoder, with typed UPC lookup as a fallback.

The browser Excel parser is bundled locally in `vendor/xlsx.full.min.js`, so the static app works after a direct GitHub or Netlify import without a build step. Inventory templates use `Code`, `Desc`, `Brand`, and `Size`; `Code` is treated as a UPC text value so leading zeros are preserved.

## Usage

```python
from shelf_replenishment import InventoryItem, calculate_replenishment_plan

items = [
    InventoryItem("milk", on_hand=4, safety_stock=6, reorder_point=10, reorder_quantity=8),
    InventoryItem("bread", on_hand=12, safety_stock=5, reorder_point=10, reorder_quantity=6),
]

print(calculate_replenishment_plan(items))
```

Expected output:

```python
[
    {"sku": "milk", "reorder_quantity": 8, "reason": "below reorder point"}
]
```

## Command line

```bash
python main.py
```

This will print the replenishment recommendations for the built-in sample data.

## Running tests

```bash
python -m unittest -q
```
