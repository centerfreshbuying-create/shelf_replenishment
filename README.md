# Shelf Replenishment

A small Python project for calculating replenishment recommendations from inventory data using only the Python standard library.

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
