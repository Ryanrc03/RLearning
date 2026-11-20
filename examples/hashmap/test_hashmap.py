"""Unit tests for the teaching HashMap. Run: python3 -m unittest -v test_hashmap"""

import random
import unittest

from hashmap import DELETED, EMPTY, HashMap


class HashMapTests(unittest.TestCase):
    def test_put_get_basic(self):
        hm = HashMap()
        hm.put("apple", 3)
        hm.put("banana", 5)
        self.assertEqual(hm.get("apple"), 3)
        self.assertEqual(hm.get("banana"), 5)
        self.assertEqual(len(hm), 2)

    def test_missing_key_returns_default(self):
        hm = HashMap()
        self.assertIsNone(hm.get("nope"))
        self.assertEqual(hm.get("nope", -1), -1)
        self.assertNotIn("nope", hm)
        self.assertFalse(hm.delete("nope"))

    def test_update_existing_key_does_not_grow(self):
        hm = HashMap()
        hm.put("k", 1)
        hm.put("k", 2)
        self.assertEqual(len(hm), 1)
        self.assertEqual(hm.get("k"), 2)

    def test_collisions_probe_linearly(self):
        # Integers hash to themselves, so 10, 18, 26 all map to 2 in a table of 8.
        hm = HashMap(capacity=8)
        hm.put(10, "A")
        hm.put(18, "B")
        hm.put(26, "C")
        self.assertEqual(hm._keys[2:5], [10, 18, 26])
        self.assertEqual(hm.get(26), "C")

    def test_tombstone_keeps_later_keys_reachable(self):
        hm = HashMap(capacity=8)
        hm.put(10, "A")
        hm.put(18, "B")
        hm.put(26, "C")
        self.assertTrue(hm.delete(18))
        self.assertIs(hm._keys[3], DELETED)
        self.assertEqual(hm.get(26), "C")  # must step over the tombstone
        self.assertIsNone(hm.get(18))
        self.assertEqual(len(hm), 2)

    def test_insert_reuses_tombstone_but_checks_duplicates_first(self):
        hm = HashMap(capacity=8)
        hm.put(10, "A")
        hm.put(18, "B")
        hm.put(26, "C")
        hm.delete(18)
        # 26 already exists past the tombstone: this must update, not insert at slot 3.
        hm.put(26, "C2")
        self.assertEqual(len(hm), 2)
        self.assertIs(hm._keys[3], DELETED)
        self.assertEqual(hm.get(26), "C2")
        # A genuinely new key with the same home slot reuses the tombstone.
        hm.put(34, "D")
        self.assertEqual(hm._keys[3], 34)
        self.assertEqual(hm._tombstones, 0)

    def test_resize_doubles_and_rehashes(self):
        hm = HashMap(capacity=8)
        for k in range(4):
            hm.put(k, k)
        self.assertEqual(hm.capacity, 8)
        hm.put(4, 4)  # 5/8 > 0.5 triggers the resize
        self.assertEqual(hm.capacity, 16)
        self.assertEqual(sorted(hm), [0, 1, 2, 3, 4])
        for k in range(5):
            self.assertEqual(hm.get(k), k)
        # After a rehash, keys sit at hash % 16 again.
        for k in range(5):
            self.assertEqual(hm._keys[k % 16], k)

    def test_resize_drops_tombstones(self):
        hm = HashMap(capacity=8)
        for k in range(4):
            hm.put(k, k)
        for k in range(4):
            hm.delete(k)
        self.assertEqual(hm._tombstones, 4)
        hm.put(100, "x")  # size 1 + tombstones 3 = 4 -> 4/8 ok; then put again
        hm.put(101, "y")  # (2 + 3) / 8 > 0.5 -> resize, tombstones vanish
        self.assertEqual(hm._tombstones, 0)
        self.assertEqual(len(hm), 2)
        self.assertEqual(hm.get(100), "x")
        self.assertEqual(hm.get(101), "y")

    def test_always_keeps_an_empty_slot(self):
        hm = HashMap(capacity=4)
        for k in range(50):
            hm.put(k, k)
            hm.delete(k)  # churn: tombstones alone must not fill the table
            self.assertIn(EMPTY, hm._keys)
        self.assertEqual(len(hm), 0)

    def test_matches_builtin_dict_under_random_ops(self):
        rng = random.Random(7)
        hm, ref = HashMap(), {}
        for _ in range(5000):
            op, k = rng.random(), rng.randrange(64)
            if op < 0.5:
                v = rng.randrange(1000)
                hm.put(k, v)
                ref[k] = v
            elif op < 0.8:
                self.assertEqual(hm.delete(k), ref.pop(k, None) is not None)
            else:
                self.assertEqual(hm.get(k), ref.get(k))
            self.assertEqual(len(hm), len(ref))
            self.assertLessEqual(hm.load_factor, HashMap.MAX_LOAD)
        self.assertEqual(sorted(hm), sorted(ref))

    def test_string_and_tuple_keys(self):
        hm = HashMap()
        hm.put(("x", 1), "pair")
        hm.put("x", "str")
        self.assertEqual(hm.get(("x", 1)), "pair")
        self.assertEqual(hm.get("x"), "str")

    def test_unhashable_key_rejected(self):
        hm = HashMap()
        with self.assertRaises(TypeError):
            hm.put([1, 2], "list")


if __name__ == "__main__":
    unittest.main()
