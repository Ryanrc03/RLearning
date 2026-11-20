# Flink & Stream Processing + OLTP vs OLAP — design for review

## Scope and updated teaching policy
Implement two independent Chinese notes from the supplied handoff, ordered Flink then OLTP/OLAP. The user's supplemental instruction overrides every assessment requirement: no Quiz, Knowledge Check, multiple-choice assessment, answer state or score. Keep parameter selection, simulation, explanations and trade-off comparisons. Workload selection reveals workload characteristics immediately, without asking the reader to guess a database.

The existing GROUP BY and Spark assessments and the Ads reconciliation hidden-scenario challenge have been removed separately. The normal reconciliation dashboard, fault scenarios, core simulators and conceptual interview explanations remain. AGENTS.md records the default no-assessment policy. Earlier design/plan requirements have been updated.

## Existing architecture and approach
Reuse local MDX registration in content/notes.ts and content/noteComponents.ts, the existing sidebar and Data Infrastructure section, VisualizationFrame and current SQL figure tokens. The current site shell remains light; figures honor system dark preference, as in the preceding notes. Native controls, CSS and SVG only, no new dependency, real cluster, server backend or site redesign.

One note per route rather than one combined page, as explicitly requested. A separate demo application would duplicate navigation/styles and conflict with static export. Pure deterministic TypeScript state transitions drive React figures; no screenshots pretending to be simulators. All teaching model assumptions appear beside their output.

### Page A
Title: Apache Flink & Stream Processing：从批处理到实时计算
Route: /notes/systems/data-infrastructure/flink-stream-processing/
Navigation: Systems → Data Infrastructure (reuse existing section).
Content: content/systems/data-infrastructure/flink-stream-processing.mdx
Engine: lib/systems/streaming/flink.ts (event, window, routing, recovery and backlog models split into focused files if needed).
Figures: components/visualization/systems/streaming/.

### Page B
Title: OLTP vs OLAP：为什么业务数据库与分析数据库要分开？
Route: /notes/systems/sql-db-basics/oltp-vs-olap/
Navigation: Systems → System Design → SQL & DB Basics.
Content: content/systems/sql-db-basics/oltp-vs-olap.mdx
Engine: lib/systems/sql/storage.ts.
Figures: components/visualization/systems/sql/storage/.

Integrate only metadata/registry and scoped stylesheet imports; update navigation tests to expect the new SQL subsection entry. Cross-link the two new notes with GROUP BY, Spark and existing Ads notes using their current Chinese URLs. Do not add other articles. Implementation details below are proposed builder choices, not previously agreed requirements.

## Flink article and figures

### 1. Why Flink: BatchVsStreamingTimeline
Fix click event time at 10:00:01 (1 second from origin). Controls: batch interval 1/5/10 min; duration 10/20/60 sec; streaming flush 5/10/30 sec. Compute next aligned batch boundary after the event, plus execution duration. Model state update immediately upon assumed arrival and next aligned sink flush. Mark both assumptions, source/compute/sink/network delay omissions, and a separately labeled illustrative query response duration (e.g. 50ms) identical in both paths. Do not suggest flush cadence follows from a default window trigger. Distinguish query latency from event-to-dashboard lag.

### 2. End-to-end architecture
Clickable component nodes reveal roles. A reader-triggered next-step flow follows one click: Browser → Gateway → Click Processor; metadata lookup to Ad DB; independent 302 redirect to Browser/advertiser and durable event append to Kafka/Kinesis; then Flink → OLAP → Query Service → Dashboard. Ad Placement Service ↔ Ad DB is shown as a separate serving branch. No arrow from Flink to browser redirect. Explain append/redirect failure and durability trade-offs without claiming atomicity. Final architecture adds retained raw archive → S3/Lake → Spark historical reconciliation, with a single canonical aggregate key and version/overwrite publication instead of adding batch and stream totals together.

### 3. Incremental counter
Use the handoff's exact seven events, stored once. Fields are eventId, adId, eventTime and arrivalTime. Arrival order MUST be e1,e2,e3,e4,e5,e7,e6 (63s before 65s); preserve source IDs. Counter steps update only the affected (adId, one-minute event-time window) entry. Keep a transition history of immutable states for Previous Step rather than recomputing the entire event prefix on each click. Show current event, key/window, before/after and cumulative state. At end, ignoring late-event policy, A00=4,B00=2,A01=1. State this counter illustrates incremental counting; watermark policy is introduced in a separate figure.

### 4. keyBy and parallelism
Controls parallelism 2/4/8, uniform/skewed key assignment and normal/hot A traffic. Deterministic labeled teaching routing, NOT Flink's real key-group hash. Show keys and relative load per subtask, no fabricated benchmark. Changing parallelism rebuilds the illustrative distribution, not a claim that arbitrary live rescaling is free. Source partitions/shards remain distinct from operator subtasks/jobs. Upstream salted writes followed immediately by keyBy(originalAdId) can reconcentrate the hot key; reference two-stage aggregation.

### 5. Window Playground
Controls Tumbling/Sliding/Session and appropriate size/slide/gap (all in seconds, explicit alignments). Show event-time positions, per-key window memberships/counts and boundaries. Tumbling is left-closed/right-open, e.g. 60 belongs to [60,120). Sliding may assign an event to several windows. Session windows are computed per adId by merging overlapping/touching event intervals according to a clearly specified gap model, not by global arrival gaps; explain actual late events can merge sessions. Keep the event source unmodified as controls change.

### 6. EventTimeWatermarkPlayground
Most important correctness contract:
- Same seven events, consumed in arrival order; arrival time approximates processing time only for this toy.
- One input, simplified monotone watermark maxEventTimeSeen − lag, lag 2/10/30 seconds. Process an arriving event against the EXISTING watermark, then emit the updated watermark. Show previous and current watermarks. Explicitly simplify periodic emission and millisecond boundary details.
- Track state by minute windows. Classify by whether the window has fired/been cleaned, not merely whether eventTime < watermark. Out-of-order does not always mean too late for its window.
- With lag 2, e7 advances watermark to 60: first minute fires with A=3,B=2. e6 then arrives with eventTime=58. Drop: discard it. Side Output: keep it in a visible side list but do not update window count. Allowed Lateness: retain state for a fixed, labeled 10 seconds past window end; accept e6 and emit a revision with A=4. Show original and revised outputs separately. Once cleanup watermark reaches 70, further updates cannot modify that window in this model.
- With lag 10/30, e6 arrives before first minute fires and counts normally. After seven events, later windows may remain open because no newer event advances the watermark. Offer an explicit “结束有界演示输入” terminal watermark to close remaining windows; label this bounded-demo behavior, not wall-clock progress in an unbounded stream.
- Next/Previous/Reset deterministic controls. A policy/lag change resets the simulation clearly. Multiple inputs usually progress with the slowest relevant watermark; idleness handling needs explicit configuration. No promise that watermark forbids earlier events.

### 7. WindowFlushCheckpointVisualizer
Three independent controls/time axes: window 30/60/120 sec, emission 5/10/30 sec, checkpoint 15/30/60 sec. Highlight boundaries, explicit early output ticks and snapshot ticks over an understandable fixed horizon. Early periodic output is an ASSUMED implemented trigger/operator policy; default event-time tumbling windows do not automatically emit at this interval. A sink flush can only expose records already emitted. Checkpoint is not window finalization or a generic dashboard flush. Explain checkpoint commit can gate transactional visibility depending on connector.

### 8. FlinkCheckpointRecoverySimulator
Finite-state sequence: processed 100 → completed checkpoint → processed 120 → crash → restore state/source position 100 → replay 20 → state 120. Show current state, last completed checkpoint, next source offset and physical processed attempts (140), so replay is not hidden. Snapshot 100 includes matching source position and state. Each Next/Previous/Reset transition comes from the model. Document offsets as “next record to read”, avoiding off-by-one ambiguity.

Separate sink example: additive +100 repeated after lost acknowledgement gives 200; stable (adId,minute,version,cumulativeCount) duplicate remains 100. Include old/new-version reorder example: atomically accept only newer versions; warn that plain unconditional upsert is insufficient for out-of-order versions/concurrent writers. Explain exactly-once managed state versus external delivery. State backends and checkpoints are not just ordinary in-process HashMaps; real snapshots may be asynchronous and barrier coordination is simplified.

### 9. Backlog and retention
Producer/consumer rates, duration, failure/recovery interval and retention controls. Advance through time to compute queue length, oldest-unconsumed-event age and drain estimate when consumer > producer; zero means no backlog, not a negative queue. Model failure as consumer=0. Track age, not only backlog/rate, for retention risk. Do not silently count expired data as processed or claim recovery beyond stream retention. Include normal/skew load caveat: extra Kafka partitions cannot automatically repair a hot keyed subtask. This is an explicit deterministic queue model, not an exact Kafka/Flink performance model.

### 10. Trade-offs and final design
Compare Spark Batch to continuous Flink at the requested dimensions, while noting Structured Streaming exists. Explain small/simple workloads may not justify Flink. Real-time results and historical corrections share explicit versioned publication/ownership; no double increments. No Window/Watermark deep dive in the separate database note.

## OLTP/OLAP article and figures

### 1. Workload selector (no prediction or test)
Five queries: Get Ad by ID, Update Campaign Budget, Top 10 Ads by Clicks, Daily Click Trend, Revenue by Advertiser. Selecting a query immediately reveals SQL, touched data pattern, point/short transaction vs broad scan/aggregation and typical workload fit. No answer selection, correctness feedback or score. Workload affinity is not a product capability restriction.

### 2–3. Fundamentals
OLTP: point lookup, CRUD, short concurrent transactions, brief ACID and B-tree role with PostgreSQL/MySQL examples. OLAP: broad filtering, COUNT/SUM/AVG/GROUP BY and time/dimension analysis; AdClickStats fields. Examples ClickHouse, Pinot, Druid, BigQuery, Snowflake, without rankings. Small scope for Index/Transaction, no new articles. OLTP/OLAP describe workloads, not strict row/column or product identity.

### 4. RowColumnStorageVisualizer
Exact storage fixture e1 A u1 1 .30; e2 B u2 1 .40; e3 A u3 1 .50; e4 C u4 1 .70. Cost uses integer cents. Toggle point lookup e3 vs grouped adId/SUM(clicks); step the logical scan/gather path and highlight touched cells in row and column layouts. Explain full-row locality and scanning only needed column segments.

Use two clearly separate models: no-index scan examines eventId across four rows to locate e3, then gathers its fields; an explicitly known row-position illustration may gather just that row but must not claim an index-free point lookup is free. Aggregate scan reads 4×5 logical cells for contiguous whole-row access versus 4×2 selected column cells. Teaching cell/byte estimates omit pages, indexes, zone maps, compression, cache and vectorization; no timings or real product benchmark. Results A=2,B=1,C=1 match the same fixture.

### 5. ColumnReadCostPlayground
Select all fields / adId+clicks / grouped adId+SUM(clicks), and a clearly labeled equal field-width byte assumption. Show query dependencies separately from output columns (filters/group keys also need reading), highlighted field segments, input rows, estimated scan bytes and output row/cell counts. Do not equate aggregate result size to scan volume. Explain pruning, same-type compression opportunities and vectorized processing without promising universality.

### 6. RawVsPreaggregatedSimulator
Use the handoff's separate four-row aggregation fixture, clearly labeled distinct from the storage-layout fixture: e1 A00,e2 A00,e3 B00,e4 A01. Preserve counts A00=2,B00=1,A01=1. Add explicitly labeled illustrative country values only for demonstrating dimension loss. Raw mode reads four rows and groups on demand; preaggregate mode materializes three rows and reads three for the same request. Vary requested dimension to country: raw data can answer, the stored (adId,minute,count) table cannot reconstruct country. Show missing information honestly rather than inventing a result. Distinguish ingest/materialization work from repeated query work. OLAP supports raw GROUP BY and may aggregate internally/materialized views, without needing Flink.

### 7–8. Comparison and System Design
Typical workload comparison table, short HTAP note, Ad DB serving path versus analytics path, independent resource scaling and contention trade-offs. Explain when one database is sufficient and when Flink is unnecessary. Link the earlier notes and new Flink note.

## Verification, files and rollout
Pure model tests: sorted arrivals, incremental before/after and reversibility; all window boundaries; lag2 drop/side/revision vs lag10 normal handling; monotone watermarks, cleanup and bounded end signal; independent clock schedules; checkpoint restore/replay offsets and attempts; atomic version acceptance; nonnegative backlog and retention age; row/column touched cells, estimated bytes and result sizes; preaggregate result preservation and unanswerable dimensions.

No assessment tests or state. Full suite, lint, typecheck, npm run build and diff check must pass. Browser validation at desktop and 390px, keyboard/focus, dark-media figures, all parameter changes, reset/replay and browser console. No published changes until explicitly requested; preserve current uncommitted GROUP BY/Spark work.
