from dataclasses import dataclass


@dataclass(frozen=True)
class InventoryItem:
    sku: str
    on_hand: int
    safety_stock: int
    reorder_point: int
    reorder_quantity: int

    def __post_init__(self):
        if self.on_hand < 0:
            raise ValueError(f"{self.sku}: on_hand cannot be negative")
        if self.safety_stock < 0:
            raise ValueError(f"{self.sku}: safety_stock cannot be negative")
        if self.reorder_point < 0:
            raise ValueError(f"{self.sku}: reorder_point cannot be negative")
        if self.reorder_quantity <= 0:
            raise ValueError(f"{self.sku}: reorder_quantity must be greater than zero")


def calculate_replenishment_plan(items):
    """Return replenishment actions for items that need stock replenishment."""
    plan = []

    for item in items:
        available_stock = item.on_hand + item.safety_stock
        if available_stock <= item.reorder_point:
            reason = "below reorder point"
            if item.on_hand >= item.reorder_point:
                reason = "safety stock risk"

            plan.append(
                {
                    "sku": item.sku,
                    "reorder_quantity": item.reorder_quantity,
                    "reason": reason,
                }
            )

    return plan
