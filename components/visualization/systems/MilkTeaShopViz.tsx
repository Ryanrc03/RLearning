"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { usePrefersReducedMotion } from "@/components/visualization/usePrefersReducedMotion";

type Stage = "one" | "team" | "chain";
type Trouble = "none" | "cap" | "idem" | "sched" | "fail" | "back";

const W = 640;
const H = 270;
const INK = "#30332c";
const MUTED = "#76796f";
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";
const RED = "#d03b3b";
const AMBER = "#eda100";

const HQ = { x: 320, y: 46 };
const BRANCHES = [
  { name: "北京店", x: 86 },
  { name: "上海店", x: 242 },
  { name: "深圳店", x: 398 },
  { name: "杭州店", x: 554 },
].map((b) => ({ ...b, y: 200 }));

const STAGES: Record<Stage, { label: string; narr: string }> = {
  one: {
    label: "1. 一家店，一个人",
    narr: "你一个人开奶茶店：接单、做茶、收钱、记账全是你。账本只有一本，就在手边，永远不会记错。这就是一台机器：所有事都在一个地方发生。简单，但你忙不过来；你一生病，店就关门。",
  },
  team: {
    label: "2. 一家店，五个人",
    narr: "生意好了，招了四个店员，有人接单、有人做茶、有人收银，活分开干，快多了。新麻烦是两个人可能同时卖出最后一杯珍珠。不过大家在一个屋里，喊一声就能对上账。这像一台机器上的多线程。",
  },
  chain: {
    label: "3. 开成连锁店",
    narr: "开了四家分店，总部在中间。每家店各干各的，靠打电话（发消息）和总部、和彼此配合，对顾客来说要像一家店一样：会员卡在哪家都能用，余额哪家都一样。这就是分布式系统：很多台机器分开干活，靠消息配合。下面五个按钮，是连锁之后才冒出来的五个麻烦。",
  },
};

const TROUBLES: Record<Exclude<Trouble, "none">, { label: string; title: string; narr: string; anchor: string; section: string; tone: string }> = {
  cap: {
    label: "电话断了",
    title: "总部和上海店之间电话断了，两边都还开着门",
    narr: "上海店来了个顾客，要用会员卡里的 100 块余额。上海店联系不上总部，不知道这 100 块在别的店是不是已经花掉了。让他用，可能和总部的账对不上（选可用）；不让他用，顾客只能干站着等（选一致）。电话断了的时候，这两者只能选一个。",
    anchor: "一致性与-cap",
    section: "一致性与 CAP",
    tone: "is-warn",
  },
  idem: {
    label: "回复没听见",
    title: "北京店扣完钱说“好了”，这句话总部没听见",
    narr: "总部让北京店给顾客扣 20 块（单号 A17）。北京店扣完回了一句“好了”，这句在路上丢了。总部等不到回音，又打了一次。如果北京店只看“扣 20 块”，顾客就被扣了 40。好在每单带编号：北京店一看 A17 已经扣过，就不再扣，直接回“好了”。重复执行和执行一次结果一样，这叫幂等。",
    anchor: "幂等与重试",
    section: "幂等与重试",
    tone: "is-good",
  },
  sched: {
    label: "派活凑不齐",
    title: "一个大订单要 4 家店同时开工，现在只有 3 家空着",
    narr: "公司年会订了 2000 杯，必须 4 家店同时做才赶得上。现在杭州店还在忙。如果先让 3 家开工，它们做到一半要等杭州的那一份才能一起送，3 家都在干等，还占着地方。更好的派法是：先不动，把这 3 家留给零散的小单，等 4 家都空了再一起开工。这叫“凑齐再一起启动”（gang scheduling）。",
    anchor: "调度活怎么分给机器",
    section: "调度：活怎么分给机器",
    tone: "is-warn",
  },
  fail: {
    label: "分店停电",
    title: "深圳店做到一半突然停电",
    narr: "深圳店正在做一个 100 杯的单子，做到第 60 杯停电了。如果没有记录，只能换一家店从第 1 杯重新做。好在深圳店每做完 20 杯就在总部的本子上记一笔进度（checkpoint）。总部发现深圳店好几分钟没动静（心跳停了），把单子转给杭州店，杭州店从第 61 杯接着做（failover）。",
    anchor: "容错checkpoint-与-failover",
    section: "容错：checkpoint 与 failover",
    tone: "is-good",
  },
  back: {
    label: "前台太快",
    title: "北京店前台一分钟接 30 单，后厨一分钟只能做 10 杯",
    narr: "前台不停收单，小票在后厨门口越堆越多，顾客要等一个小时才拿到，有人等不及就走了，这些单白做。正确做法是给小票架设个上限，满了就让前台先停一停，告诉新顾客“现在要等 20 分钟”。压力从后厨顶回前台，而不是在中间无限堆积，这叫背压（backpressure）。",
    anchor: "背压下游慢了怎么办",
    section: "背压：下游慢了怎么办",
    tone: "is-good",
  },
};

function Person({ x, y, label, color = BLUE }: { x: number; y: number; label: string; color?: string }) {
  return (
    <g>
      <circle cx={x} cy={y - 8} r={7} fill={color} />
      <rect x={x - 8} y={y} width={16} height={14} rx={5} fill={color} />
      <text x={x} y={y + 28} fontSize={10} textAnchor="middle" fill={INK}>{label}</text>
    </g>
  );
}

function Moving({ x1, y1, x2, y2, label, color = BLUE, dur = 2.4, begin = 0, still, broken }: { x1: number; y1: number; x2: number; y2: number; label?: string; color?: string; dur?: number; begin?: number; still: boolean; broken?: boolean }) {
  const ex = broken ? (x1 + x2) / 2 : x2;
  const ey = broken ? (y1 + y2) / 2 : y2;
  const path = `M ${x1} ${y1} L ${ex} ${ey}`;
  if (still) {
    const t = broken ? 0.85 : 0.5;
    const cx = x1 + (ex - x1) * t;
    const cy = y1 + (ey - y1) * t;
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill={color} />
        {label && <text x={cx + 9} y={cy + 4} fontSize={10} fill={color}>{label}</text>}
      </g>
    );
  }
  return (
    <g>
      <circle r={6} fill={color}>
        <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={path} />
        {broken && <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />}
      </circle>
      {label && (
        <text fontSize={10} fill={color}>
          <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" path={`M ${x1 + 9} ${y1 + 4} L ${ex + 9} ${ey + 4}`} />
          {broken && <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" />}
          {label}
        </text>
      )}
    </g>
  );
}

function Shop({ x, y, name, w = 120, h = 46, fill = "#fff", stroke = "#d9d3bb", note, noteColor = MUTED, dim }: { x: number; y: number; name: string; w?: number; h?: number; fill?: string; stroke?: string; note?: string; noteColor?: string; dim?: boolean }) {
  return (
    <g opacity={dim ? 0.45 : 1}>
      <path d={`M ${x - w / 2} ${y - h / 2 + 8} L ${x} ${y - h / 2 - 6} L ${x + w / 2} ${y - h / 2 + 8} Z`} fill="#f3d9a6" stroke={stroke} />
      <rect x={x - w / 2} y={y - h / 2 + 8} width={w} height={h - 8} rx={4} fill={fill} stroke={stroke} strokeWidth={1.4} />
      <text x={x} y={y + 10} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={INK}>{name}</text>
      {note && <text x={x} y={y + h / 2 + 15} fontSize={10} textAnchor="middle" fill={noteColor}>{note}</text>}
    </g>
  );
}

function SingleShop({ still, team }: { still: boolean; team: boolean }) {
  const people = team
    ? [{ x: 210, l: "接单" }, { x: 275, l: "做茶" }, { x: 340, l: "做茶" }, { x: 405, l: "收银" }, { x: 470, l: "记账" }]
    : [{ x: 340, l: "你（全包）" }];
  return (
    <g>
      <path d="M 150 70 L 340 36 L 530 70 Z" fill="#f3d9a6" stroke="#d9d3bb" />
      <rect x={150} y={70} width={380} height={130} rx={6} fill="#fff" stroke="#d9d3bb" strokeWidth={1.4} />
      <text x={340} y={60} fontSize={12} fontWeight={700} textAnchor="middle" fill={INK}>奶茶店</text>
      {people.map((p) => <Person key={p.x} x={p.x} y={130} label={p.l} color={team ? BLUE : ORANGE} />)}
      <rect x={480} y={84} width={40} height={30} rx={3} fill="#fdf9e9" stroke="#ddc776" />
      <text x={500} y={103} fontSize={9.5} textAnchor="middle" fill={INK}>账本</text>
      <text x={340} y={228} fontSize={10.5} textAnchor="middle" fill={MUTED}>{team ? "一个屋子、一本账，喊一声就能对上" : "一个人、一本账，永远不会记错，但忙不过来"}</text>
      <Person x={60} y={130} label="顾客" color={MUTED} />
      <Moving x1={74} y1={126} x2={team ? 200 : 326} y2={126} still={still} color={GREEN} label="点单" dur={2.6} />
      {team && <Moving x1={210} y1={110} x2={275} y2={110} still={still} dur={1.6} begin={0.4} />}
      {team && <Moving x1={340} y1={110} x2={405} y2={110} still={still} dur={1.6} begin={0.9} />}
      {team && (
        <g>
          <rect x={250} y={168} width={180} height={22} rx={11} fill="#fdf3e3" stroke={AMBER} />
          <text x={340} y={183} fontSize={10} textAnchor="middle" fill="#8a6d00">两个人同时卖最后一杯珍珠？</text>
        </g>
      )}
    </g>
  );
}

function Chain({ trouble, still }: { trouble: Trouble; still: boolean }) {
  const line = (bx: number, by: number, i: number) => {
    const cut = trouble === "cap" && i === 1;
    return (
      <g key={`l${i}`}>
        <line x1={HQ.x} y1={HQ.y + 20} x2={bx} y2={by - 28} stroke={cut ? RED : "#c9c4ad"} strokeWidth={cut ? 2.5 : 1.5} strokeDasharray={cut ? "6 5" : "2 3"} />
        {cut && <text x={(HQ.x + bx) / 2 - 6} y={(HQ.y + 20 + by - 28) / 2 + 4} fontSize={16} fontWeight={700} fill={RED}>✕</text>}
      </g>
    );
  };
  const busy = trouble === "sched" ? [false, false, false, true] : [false, false, false, false];
  const dark = trouble === "fail" ? [false, false, true, false] : [false, false, false, false];
  const note = (i: number): { text?: string; color?: string } => {
    if (trouble === "cap" && i === 1) return { text: "顾客要用余额：让不让？", color: RED };
    if (trouble === "idem" && i === 0) return { text: "A17 扣过了，不再扣", color: GREEN };
    if (trouble === "sched") return i === 3 ? { text: "还在忙", color: RED } : { text: "空着", color: GREEN };
    if (trouble === "fail" && i === 2) return { text: "停电：做到第 60 杯", color: RED };
    if (trouble === "fail" && i === 3) return { text: "从第 61 杯接着做", color: GREEN };
    if (trouble === "back" && i === 0) return { text: "小票堆满，先停接单", color: RED };
    return {};
  };
  return (
    <g>
      {BRANCHES.map((b, i) => line(b.x, b.y, i))}
      <Shop x={HQ.x} y={HQ.y} name="总部" w={110} h={40} fill="#3b4234" stroke="#3b4234" />
      <text x={HQ.x} y={HQ.y + 10} fontSize={11.5} fontWeight={700} textAnchor="middle" fill="#fff">总部</text>
      {BRANCHES.map((b, i) => {
        const n = note(i);
        return <Shop key={b.name} x={b.x} y={b.y} name={dark[i] ? `${b.name} ⚡` : b.name} fill={dark[i] ? "#e4dfcb" : busy[i] ? "#f5e3e3" : "#fff"} stroke={dark[i] || busy[i] ? RED : "#d9d3bb"} note={n.text} noteColor={n.color} />;
      })}

      {trouble === "none" && BRANCHES.map((b, i) => (
        <Moving key={`m${i}`} x1={HQ.x} y1={HQ.y + 22} x2={b.x} y2={b.y - 30} still={still} dur={2.2 + i * 0.3} begin={i * 0.5} color={i % 2 ? ORANGE : BLUE} />
      ))}
      {trouble === "cap" && (
        <>
          <Moving x1={HQ.x} y1={HQ.y + 22} x2={BRANCHES[1].x} y2={BRANCHES[1].y - 30} still={still} broken label="余额多少？" color={ORANGE} />
          <g><rect x={HQ.x + 64} y={HQ.y - 14} width={86} height={22} rx={4} fill="#fdf9e9" stroke="#ddc776" /><text x={HQ.x + 107} y={HQ.y + 1} fontSize={10} textAnchor="middle" fill={INK}>账本：余额 100</text></g>
        </>
      )}
      {trouble === "idem" && (
        <>
          <Moving x1={HQ.x} y1={HQ.y + 22} x2={BRANCHES[0].x} y2={BRANCHES[0].y - 30} still={still} label="扣 20（A17）" color={BLUE} dur={3} />
          <Moving x1={BRANCHES[0].x + 14} y1={BRANCHES[0].y - 30} x2={HQ.x + 14} y2={HQ.y + 22} still={still} label="好了" color={GREEN} broken dur={3} begin={1} />
          <Moving x1={HQ.x - 14} y1={HQ.y + 22} x2={BRANCHES[0].x - 14} y2={BRANCHES[0].y - 30} still={still} label="再说一次：扣 20（A17）" color={AMBER} dur={3} begin={2} />
        </>
      )}
      {trouble === "sched" && (
        <g>
          <rect x={HQ.x + 64} y={HQ.y - 14} width={150} height={22} rx={4} fill="#fdf9e9" stroke="#ddc776" />
          <text x={HQ.x + 139} y={HQ.y + 1} fontSize={10} textAnchor="middle" fill={INK}>大单：2000 杯，要 4 家一起</text>
        </g>
      )}
      {trouble === "fail" && (
        <>
          <Moving x1={BRANCHES[2].x + 30} y1={BRANCHES[2].y} x2={BRANCHES[3].x - 30} y2={BRANCHES[3].y} still={still} label="进度：60 / 100" color={GREEN} dur={2.6} />
          <g><rect x={HQ.x + 64} y={HQ.y - 14} width={120} height={22} rx={4} fill="#fdf9e9" stroke="#ddc776" /><text x={HQ.x + 124} y={HQ.y + 1} fontSize={10} textAnchor="middle" fill={INK}>进度本：60 / 100</text></g>
        </>
      )}
      {trouble === "back" && (
        <g>
          {Array.from({ length: 7 }, (_, k) => (
            <rect key={k} x={BRANCHES[0].x - 52 + k * 15} y={BRANCHES[0].y - 64} width={12} height={16} rx={2} fill={k < 5 ? ORANGE : "#f5e3e3"} stroke={k < 5 ? "none" : RED} strokeDasharray={k < 5 ? undefined : "2 2"} />
          ))}
          <text x={BRANCHES[0].x + 60} y={BRANCHES[0].y - 52} fontSize={10} fill={MUTED}>小票架：最多 5 张</text>
          <Moving x1={BRANCHES[0].x - 70} y1={BRANCHES[0].y - 90} x2={BRANCHES[0].x - 40} y2={BRANCHES[0].y - 62} still={still} color={RED} broken label="新单：等一等" dur={2} />
        </g>
      )}
    </g>
  );
}

export default function MilkTeaShopViz() {
  const reduced = usePrefersReducedMotion();
  const [stage, setStage] = useState<Stage>("one");
  const [trouble, setTrouble] = useState<Trouble>("none");
  const t = trouble !== "none" ? TROUBLES[trouble] : null;
  return (
    <VisualizationFrame
      title="从一家奶茶店到连锁店：分布式系统是怎么来的"
      description="先按顺序点上面三个阶段。到了连锁店，再点下面五个麻烦，每一个都对应这一章后面的一节。"
    >
      <div className="viz-chips" role="tablist" aria-label="阶段" style={{ marginBottom: 10 }}>
        {(Object.keys(STAGES) as Stage[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={stage === k} className={`viz-chip${stage === k ? " is-on" : ""}`} onClick={() => { setStage(k); setTrouble("none"); }}>{STAGES[k].label}</button>
        ))}
      </div>
      {stage === "chain" && (
        <div className="viz-controls">
          <span className="viz-k">连锁之后的五个麻烦：</span>
          {(Object.keys(TROUBLES) as Exclude<Trouble, "none">[]).map((k) => (
            <button key={k} type="button" className={`viz-btn${trouble === k ? " is-on" : ""}`} onClick={() => setTrouble(trouble === k ? "none" : k)}>{TROUBLES[k].label}</button>
          ))}
        </div>
      )}
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t ? `${t.title}。${t.narr}` : STAGES[stage].narr}>
          {stage === "chain" ? <Chain trouble={trouble} still={reduced} /> : <SingleShop still={reduced} team={stage === "team"} />}
          {t && <text x={0} y={H - 6} fontSize={11} fontWeight={600} fill={INK}>{t.title}</text>}
        </svg>
      </div>
      <div className={`viz-narr${t ? ` ${t.tone}` : stage === "chain" ? " is-good" : ""}`}>
        {t ? (
          <>
            {t.narr}　<a href={`#${t.anchor}`}>对应下面的「{t.section}」→</a>
          </>
        ) : STAGES[stage].narr}
      </div>
    </VisualizationFrame>
  );
}
