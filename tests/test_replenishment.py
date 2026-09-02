import unittest

from shelf_replenishment import InventoryItem, calculate_replenishment_plan


class ReplenishmentPlanTests(unittest.TestCase):
    def test_calculate_replenishment_for_low_stock(self):
        items = [
            InventoryItem("milk", on_hand=4, safety_stock=6, reorder_point=10, reorder_quantity=8),
            InventoryItem("bread", on_hand=12, safety_stock=5, reorder_point=10, reorder_quantity=6),
        ]

        plan = calculate_replenishment_plan(items)

        self.assertEqual(
            plan,
            [{"sku": "milk", "reorder_quantity": 8, "reason": "below reorder point"}],
        )

    def test_no_replenishment_when_stock_is_sufficient(self):
        items = [
            InventoryItem("eggs", on_hand=15, safety_stock=4, reorder_point=10, reorder_quantity=7),
        ]

        plan = calculate_replenishment_plan(items)

        self.assertEqual(plan, [])

    def test_invalid_inventory_values_are_rejected(self):
        with self.assertRaises(ValueError):
            InventoryItem("bad", on_hand=-1, safety_stock=2, reorder_point=10, reorder_quantity=5)

        with self.assertRaises(ValueError):
            InventoryItem("bad2", on_hand=5, safety_stock=-1, reorder_point=10, reorder_quantity=5)

        with self.assertRaises(ValueError):
            InventoryItem("bad3", on_hand=5, safety_stock=2, reorder_point=-1, reorder_quantity=5)

        with self.assertRaises(ValueError):
            InventoryItem("bad4", on_hand=5, safety_stock=2, reorder_point=10, reorder_quantity=0)


if __name__ == "__main__":
    unittest.main()
