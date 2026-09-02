# Shelf Replenishment

A local-first supermarket shelf replenishment dashboard with a Python replenishment engine and browser-based operations workflow.

## Features

- Track inventory items with:
  - SKU
  - on-hand quantity
  - safety stock
  - reorder point
  - reorder quantity
- Validate inventory values before calculation
- Generate a replenishment plan for items that need restocking
- Run a simple local command-line entry point
- Use Dashboard, Shelf Scan, Orders, Warehouse, Delivery, and Admin options
- Import all inventory items from `.xlsx`, `.xls`, or `.csv` files
- Download an inventory import template with all supported replenishment fields

## Browser dashboard

Run the static app from the project folder:

```bash
python -m http.server 8080
```

Open `http://localhost:8080` and use **Admin > Inventory import**. The importer accepts flexible names such as `Product Name`, `Item No`, `Barcode`, `Aisle`, `Current Stock`, `Min Stock`, `Par Level`, and `Order Qty`. It also preserves additional columns from the spreadsheet.

The browser Excel parser is installed from the npm dependency in `package.json`; run `npm install` before serving a fresh checkout.

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
