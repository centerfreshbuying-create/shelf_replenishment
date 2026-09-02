from shelf_replenishment import InventoryItem, calculate_replenishment_plan


if __name__ == "__main__":
    items = [
        InventoryItem("milk", on_hand=4, safety_stock=6, reorder_point=10, reorder_quantity=8),
        InventoryItem("bread", on_hand=12, safety_stock=5, reorder_point=10, reorder_quantity=6),
        InventoryItem("eggs", on_hand=15, safety_stock=4, reorder_point=10, reorder_quantity=7),
    ]

    for item in calculate_replenishment_plan(items):
        print(f"{item['sku']}: {item['reorder_quantity']} units ({item['reason']})")
