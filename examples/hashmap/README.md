# Teaching HashMap (open addressing + linear probing)

Companion code for the RLearning note **HashMap Internals**. Pure Python, no
dependencies, Python 3.9+.

```sh
python3 hashmap.py                      # prints the dry run from the note
python3 -m unittest -v test_hashmap     # 12 tests
```

`hashmap.py` keeps three slot states (`EMPTY`, `DELETED`, occupied), reuses
tombstones on insert, counts tombstones toward the load factor, and doubles the
table when load exceeds `MAX_LOAD = 0.5`. The threshold and the probe sequence
are deliberately simpler than CPython's `dict` (2/3 load, perturbed probing)
and Java's `HashMap` (0.75, chaining + tree bins); the note explains the gaps.
