"""A teaching HashMap: open addressing + linear probing + tombstones.

Companion to the RLearning note "HashMap Internals". The goal is to make every
step of put / get / delete / resize visible, not to be fast. Python 3.9+.

Slot states
    EMPTY     never used; a probe that reaches EMPTY stops (key cannot be further on)
    DELETED   a tombstone; probing must continue past it, inserting may reuse it
    occupied  a (key, value) pair

Invariants kept by every public method
    * size counts occupied slots only
    * the table always holds at least one EMPTY slot, so _find always terminates
    * size + tombstones <= capacity * MAX_LOAD  (resize happens before that is broken)
"""

from typing import Any, Hashable, Iterator, List, Optional, Tuple


class _Marker:
    """Sentinels that can never collide with a user key."""

    __slots__ = ("name",)

    def __init__(self, name: str) -> None:
        self.name = name

    def __repr__(self) -> str:
        return self.name


EMPTY = _Marker("EMPTY")
DELETED = _Marker("DELETED")


class HashMap:
    """Open addressing with linear probing: index_i = (hash(key) + i) % capacity."""

    INITIAL_CAPACITY = 8
    MAX_LOAD = 0.5  # teaching threshold; CPython uses 2/3, Java HashMap uses 0.75

    def __init__(self, capacity: int = INITIAL_CAPACITY) -> None:
        if capacity < 1:
            raise ValueError("capacity must be >= 1")
        self._keys: List[Any] = [EMPTY] * capacity
        self._values: List[Any] = [None] * capacity
        self._size = 0        # occupied slots
        self._tombstones = 0  # DELETED slots; they still cost probe steps
        self.probes = 0       # total key comparisons / slot visits, for experiments

    # ---------------------------------------------------------------- helpers
    @property
    def capacity(self) -> int:
        return len(self._keys)

    @property
    def load_factor(self) -> float:
        return self._size / self.capacity

    def _index(self, key: Hashable) -> int:
        return hash(key) % self.capacity

    def _find(self, key: Hashable) -> Tuple[Optional[int], int]:
        """Walk the probe sequence for `key`.

        Returns (found_index, insert_index):
          found_index  slot holding `key`, or None if the key is absent
          insert_index where a new entry for `key` should go: the first tombstone
                       seen on the way, otherwise the EMPTY slot that ended the walk
        Stops at the first EMPTY slot: linear probing never skips an EMPTY slot on
        insert, so the key cannot live beyond one. Tombstones are stepped over.
        """
        cap = self.capacity
        start = self._index(key)
        first_tombstone: Optional[int] = None
        for i in range(cap):
            idx = (start + i) % cap
            slot = self._keys[idx]
            self.probes += 1
            if slot is EMPTY:
                return None, (first_tombstone if first_tombstone is not None else idx)
            if slot is DELETED:
                if first_tombstone is None:
                    first_tombstone = idx
                continue
            if slot is key or slot == key:
                return idx, idx
        # Only reachable if no EMPTY slot exists, which the load invariant prevents.
        assert first_tombstone is not None, "table has no EMPTY slot: load invariant broken"
        return None, first_tombstone

    def _resize(self, new_capacity: int) -> None:
        """Rebuild the table: every live key is re-hashed into a fresh array.

        A resize is O(n) but it drops all tombstones, and because capacity grows
        geometrically the amortized cost per insertion stays O(1).
        """
        old = [(k, v) for k, v in zip(self._keys, self._values) if k is not EMPTY and k is not DELETED]
        self._keys = [EMPTY] * new_capacity
        self._values = [None] * new_capacity
        self._size = 0
        self._tombstones = 0
        for k, v in old:
            _, idx = self._find(k)
            self._keys[idx] = k
            self._values[idx] = v
            self._size += 1

    # ------------------------------------------------------------- public API
    def put(self, key: Hashable, value: Any) -> None:
        found, idx = self._find(key)
        if found is not None:
            self._values[found] = value  # update in place: size unchanged
            return
        if self._keys[idx] is DELETED:
            self._tombstones -= 1  # reuse the tombstone
        self._keys[idx] = key
        self._values[idx] = value
        self._size += 1
        # Tombstones count toward the load: they lengthen probe chains just like keys.
        if (self._size + self._tombstones) / self.capacity > self.MAX_LOAD:
            self._resize(self.capacity * 2)

    def get(self, key: Hashable, default: Any = None) -> Any:
        found, _ = self._find(key)
        return default if found is None else self._values[found]

    def delete(self, key: Hashable) -> bool:
        """Remove `key`. Returns False if it was not present.

        The slot becomes DELETED, not EMPTY: setting it EMPTY would cut the probe
        chain of every key that was inserted past this slot.
        """
        found, _ = self._find(key)
        if found is None:
            return False
        self._keys[found] = DELETED
        self._values[found] = None
        self._size -= 1
        self._tombstones += 1
        return True

    def __len__(self) -> int:
        return self._size

    def __contains__(self, key: object) -> bool:
        return self._find(key)[0] is not None  # type: ignore[arg-type]

    def __iter__(self) -> Iterator[Hashable]:
        # Unlike CPython's dict, this map does NOT preserve insertion order.
        for k in self._keys:
            if k is not EMPTY and k is not DELETED:
                yield k

    def slots(self) -> List[str]:
        """Human-readable table, used by the dry run in the note."""
        out = []
        for i, k in enumerate(self._keys):
            if k is EMPTY:
                out.append(f"{i}: EMPTY")
            elif k is DELETED:
                out.append(f"{i}: DELETED")
            else:
                out.append(f"{i}: ({k!r}, {self._values[i]!r})")
        return out


if __name__ == "__main__":
    # The dry run from the note. Integers hash to themselves in CPython, so with
    # capacity 8 the keys 10, 18, 26 all start at index 2.
    hm = HashMap()
    for step in (("put", 10, "A"), ("put", 18, "B"), ("put", 26, "C"), ("delete", 18)):
        if step[0] == "put":
            hm.put(step[1], step[2])
        else:
            hm.delete(step[1])
        print(f"after {step}:")
        print("  " + "\n  ".join(hm.slots()))
    assert hm.get(26) == "C"
    assert hm.get(18) is None
    print("get(26) =", hm.get(26))
