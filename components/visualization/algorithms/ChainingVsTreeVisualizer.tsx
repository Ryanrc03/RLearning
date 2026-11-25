"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { balancedDepth, balancedTree, JAVA, javaBinDecision, redBlackBound, searchPath, type TreeNode } from "@/lib/algorithms/hashMap";

type Placed = { node: TreeNode; x: number; y: number; parent?: Placed };

function layout(root: TreeNode | undefined, width: number, rowH: number): Placed[] {
  // In-order x positions give a tidy drawing for a balanced tree.
  const out: Placed[] = [];
  let order = 0;
  const count = (n?: TreeNode): number => (n ? 1 + count(n.left) + count(n.right) : 0);
  const total = count(root);
  const walk = (n: TreeNode | undefined, parent?: Placed) => {
    if (!n) return;
    const left = { node: n, x: 0, y: 0, parent } as Placed;
    walk(n.left, left);
    left.x = 16 + ((order + 0.5) / total) * (width - 32);
    left.y = 14 + (n.depth - 1) * rowH;
    order++;
    out.push(left);
    walk(n.right, left);
  };
  walk(root);
  return out;
}

// Same bin, two shapes. A linked list costs one comparison per node walked; a balanced
// search tree halves the candidates every comparison. The right panel evaluates the
// actual java.util.HashMap rule, which also looks at the table length.
export default function ChainingVsTreeVisualizer() {
  const [n, setN] = useState(15);
  const [target, setTarget] = useState(15);
  const [tableLen, setTableLen] = useState(16);
  const [before, setBefore] = useState(8);
  const t = Math.min(target, n);
  const root = useMemo(() => balancedTree(n), [n]);
  const path = useMemo(() => searchPath(root, t), [root, t]);
  const pathSet = new Set(path);
  const W = 420, rowH = 34;
  const placed = useMemo(() => layout(root, W, rowH), [root]);
  const H = 14 + balancedDepth(n) * rowH;
  const decision = javaBinDecision(before, tableLen);

  return (
    <VisualizationFrame
      title="同一个 Bucket 里的 n 个 key：链表 vs 平衡搜索树"
      description="拖 n 改变这个 bucket 里挤了多少个 key（它们 hash 到同一格），再选要找的 key。左边数链表要比较几次，右边数树上走几层。点任何节点可以直接选它为目标。"
      footnote="右边画的是把同样 n 个 key 按顺序排成的完全平衡 BST，用来看 log n 的量级；真实的红黑树不一定这么整齐，但保证高度 ≤ 2·log₂(n+1)。Java 树化的 bucket 里用 hash 值、再用 compareTo 决定左右，所以 key 要么可比较，要么退化成按 identityHashCode 打破平局。"
    >
      <div className="hm-row">
        <label>n = <b className="viz-mono">{n}</b><input type="range" min={1} max={64} value={n} onChange={(e) => { setN(Number(e.target.value)); setTarget((v) => Math.min(v, Number(e.target.value))); }} aria-label="bucket 里的节点数" /></label>
        <label>查找 key <b className="viz-mono">{t}</b><input type="range" min={1} max={n} value={t} onChange={(e) => setTarget(Number(e.target.value))} aria-label="要查找的 key" /></label>
        <button type="button" className="viz-btn" onClick={() => setTarget(n)}>最坏情况</button>
      </div>
      <div className="viz-stat">
        <div><small>链表：比较次数</small><b>{t}<span className="delta">最坏 {n}</span></b></div>
        <div><small>平衡树：比较次数</small><b>{path.length}<span className="delta">最坏 {balancedDepth(n)}</span></b></div>
        <div><small>红黑树高度上界</small><b>{redBlackBound(n)}<span className="delta">2·log₂(n+1)</span></b></div>
      </div>
      <div className="hm-lvt" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>Chaining + Linked List · O(n)</h5>
          <div className="hm-list" role="list" aria-label="链表">
            {Array.from({ length: n }, (_, i) => i + 1).map((k) => (
              <button key={k} type="button" role="listitem" className={`hm-lnode${k === t ? " is-hit" : k < t ? " is-visited" : " is-dim"}`} onClick={() => setTarget(k)} aria-label={`key ${k}`}>{k}</button>
            ))}
          </div>
          <p className="viz-k" style={{ marginTop: 8 }}>只能从头一个个比到 key {t}：第 {t} 次比较命中。n 翻倍，最坏次数也翻倍。</p>
        </div>
        <div className="viz-panel">
          <h5>Chaining + Balanced Tree · O(log n)</h5>
          <svg className="hm-tree" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`平衡搜索树，查找 ${t} 的路径`}>
            {placed.map((p) => p.parent && <line key={`l${p.node.key}`} className={pathSet.has(p.node.key) && pathSet.has(p.parent.node.key) ? "is-path" : ""} x1={p.parent.x} y1={p.parent.y} x2={p.x} y2={p.y} />)}
            {placed.map((p) => (
              <g key={p.node.key} onClick={() => setTarget(p.node.key)} style={{ cursor: "pointer" }}>
                <circle className={p.node.key === t ? "is-hit" : pathSet.has(p.node.key) ? "is-visited" : ""} cx={p.x} cy={p.y} r={n > 31 ? 8 : 11} />
                <text x={p.x} y={p.y}>{n > 31 && !pathSet.has(p.node.key) ? "" : p.node.key}</text>
              </g>
            ))}
          </svg>
          <p className="viz-k" style={{ marginTop: 8 }}>路径 {path.join(" → ")}：每比一次扔掉一半，{path.length} 次到达。n 翻倍，最坏只多 1 次。</p>
        </div>
      </div>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>Java HashMap 什么时候真的树化？putVal 的判断</h5>
        <div className="hm-row">
          <label>这个 bucket 原来有 <b className="viz-mono">{before}</b> 个节点<input type="range" min={1} max={12} value={before} onChange={(e) => setBefore(Number(e.target.value))} aria-label="插入前 bucket 的节点数" /></label>
          <span className="viz-k">table.length：</span>
          <div className="viz-chips" role="group" aria-label="table 长度">
            {[16, 32, 64, 128].map((len) => <button key={len} type="button" className={`viz-chip mono${len === tableLen ? " is-on" : ""}`} aria-pressed={len === tableLen} onClick={() => setTableLen(len)}>{len}</button>)}
          </div>
        </div>
        <div className={`hm-verdict${decision === "treeify" ? " is-tree" : decision === "resize-instead" ? " is-resize" : ""}`}>
          {decision === "stay-list" && <>新节点追加到链尾，链长 {before + 1} ≤ TREEIFY_THRESHOLD = {JAVA.TREEIFY_THRESHOLD}：<b>继续用链表</b>。<br /><code>binCount = {before - 1} &lt; TREEIFY_THRESHOLD - 1</code>，不会调用 treeifyBin。</>}
          {decision === "resize-instead" && <>链长到了 {before + 1}（<code>binCount = {before - 1} &gt;= TREEIFY_THRESHOLD - 1</code>），调用 treeifyBin，但 <code>tab.length = {tableLen} &lt; MIN_TREEIFY_CAPACITY = {JAVA.MIN_TREEIFY_CAPACITY}</code>：<b>不树化，改为 resize()</b>。表太小时长链多半是因为表小，扩容把它们分开比建树便宜。</>}
          {decision === "treeify" && <>链长到了 {before + 1}（<code>binCount = {before - 1} &gt;= TREEIFY_THRESHOLD - 1</code>），且 <code>tab.length = {tableLen} &gt;= MIN_TREEIFY_CAPACITY</code>：<b>这个 bucket 转成红黑树</b>。其他 bucket 不受影响。之后 resize 拆分时若一侧 ≤ UNTREEIFY_THRESHOLD = {JAVA.UNTREEIFY_THRESHOLD}，又会变回链表。</>}
        </div>
      </div>
    </VisualizationFrame>
  );
}
