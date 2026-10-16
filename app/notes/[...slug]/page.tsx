import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FundamentalsOverview from "@/content/cs/fundamentals/overview.mdx";
import NetworkingOverview from "@/content/cs/networking/overview.mdx";
import OsOverview from "@/content/cs/os/overview.mdx";
import ProcessVsThread from "@/content/cs/fundamentals/process-vs-thread.mdx";
import ThreadVsCoroutine from "@/content/cs/fundamentals/thread-vs-coroutine.mdx";
import MemoryHierarchy from "@/content/cs/fundamentals/memory-hierarchy.mdx";
import TcpVsUdp from "@/content/cs/networking/tcp-vs-udp.mdx";
import JsonVsProtobuf from "@/content/cs/networking/json-vs-protobuf.mdx";
import HttpVsGrpc from "@/content/cs/networking/http-vs-grpc.mdx";
import ReqRespVsPubSub from "@/content/cs/networking/reqresp-vs-pubsub.mdx";
import BrokerVsBrokerless from "@/content/cs/networking/broker-vs-brokerless.mdx";
import ProcessesThreadsCoroutines from "@/content/cs/os/processes-threads-coroutines.mdx";
import VirtualMemory from "@/content/cs/os/virtual-memory.mdx";
import UCB from "@/content/ml/reinforcement-learning/ucb.mdx";
import KuairandInput from "@/content/ml/recsys/kuairand-input.mdx";
import LightgbmExplained from "@/content/ml/recsys/lightgbm-explained.mdx";
import BoostingLab from "@/content/ml/recsys/boosting-lab.mdx";
import DistributedCore from "@/content/systems/distributed/core.mdx";
import Serverless from "@/content/systems/backend/serverless.mdx";
import AgentLoop from "@/content/ai-infra/agent-harness/agent-loop.mdx";
import ToolsPermissionsHooks from "@/content/ai-infra/agent-harness/tools-permissions-hooks.mdx";
import SubagentsSkillsMcp from "@/content/ai-infra/agent-harness/subagents-skills-mcp.mdx";
import GoalsAndHarnessDesign from "@/content/ai-infra/agent-harness/goals-and-harness-design.mdx";
import CpuVsGpu from "@/content/ai-infra/gpu/cpu-vs-gpu.mdx";
import ComputeVsMemoryBound from "@/content/ai-infra/gpu/compute-vs-memory-bound.mdx";
import GlobalVsSharedMemory from "@/content/ai-infra/gpu/global-vs-shared-memory.mdx";
import SeparateVsFusedKernels from "@/content/ai-infra/gpu/separate-vs-fused-kernels.mdx";
import ThreadVsWarpPerRow from "@/content/ai-infra/gpu/thread-vs-warp-per-row.mdx";
import AggregateVsProjectFirst from "@/content/ai-infra/gpu/aggregate-vs-project-first.mdx";
import ImplicitGemmVsFft from "@/content/ai-infra/gpu/implicit-gemm-vs-fft.mdx";
import { getNote, noteEntries } from "@/content/notes";
import { getNoteToc } from "@/lib/content";
import TableOfContents from "@/components/layout/TableOfContents";
import Icon from "@/components/ui/Icon";

const noteComponents = {
  "cs/fundamentals/overview": FundamentalsOverview,
  "cs/networking/overview": NetworkingOverview,
  "cs/os/overview": OsOverview,
  "cs/fundamentals/process-vs-thread": ProcessVsThread,
  "cs/fundamentals/thread-vs-coroutine": ThreadVsCoroutine,
  "cs/fundamentals/memory-hierarchy": MemoryHierarchy,
  "cs/networking/tcp-vs-udp": TcpVsUdp,
  "cs/networking/json-vs-protobuf": JsonVsProtobuf,
  "cs/networking/http-vs-grpc": HttpVsGrpc,
  "cs/networking/reqresp-vs-pubsub": ReqRespVsPubSub,
  "cs/networking/broker-vs-brokerless": BrokerVsBrokerless,
  "cs/os/processes-threads-coroutines": ProcessesThreadsCoroutines,
  "cs/os/virtual-memory": VirtualMemory,
  "ml/reinforcement-learning/ucb": UCB,
  "ml/recsys/kuairand-input": KuairandInput,
  "ml/recsys/lightgbm-explained": LightgbmExplained,
  "ml/recsys/boosting-lab": BoostingLab,
  "systems/distributed/core": DistributedCore,
  "systems/backend/serverless": Serverless,
  "ai-infra/agent-harness/agent-loop": AgentLoop,
  "ai-infra/agent-harness/tools-permissions-hooks": ToolsPermissionsHooks,
  "ai-infra/agent-harness/subagents-skills-mcp": SubagentsSkillsMcp,
  "ai-infra/agent-harness/goals-and-harness-design": GoalsAndHarnessDesign,
  "ai-infra/gpu/cpu-vs-gpu": CpuVsGpu,
  "ai-infra/gpu/compute-vs-memory-bound": ComputeVsMemoryBound,
  "ai-infra/gpu/global-vs-shared-memory": GlobalVsSharedMemory,
  "ai-infra/gpu/separate-vs-fused-kernels": SeparateVsFusedKernels,
  "ai-infra/gpu/thread-vs-warp-per-row": ThreadVsWarpPerRow,
  "ai-infra/gpu/aggregate-vs-project-first": AggregateVsProjectFirst,
  "ai-infra/gpu/implicit-gemm-vs-fft": ImplicitGemmVsFft,
};

export const dynamicParams = false;

export function generateStaticParams() {
  return noteEntries.map((note) => ({ slug: note.slug.split("/") }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const note = getNote(slug.join("/"));
  return { title: note?.title ?? "Note", description: note?.description };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const key = slug.join("/");
  const note = getNote(key);
  const Content = noteComponents[key as keyof typeof noteComponents];
  if (!note || !Content) notFound();
  const toc = getNoteToc(key);

  return (
    <div className="note-layout">
      <div className="note-main">
        <header className="article-header">
          <div className="note-breadcrumb"><span>{note.category}</span><Icon name="chevron" /><span>{note.section}</span></div>
          <h1>{note.title}</h1>
          <p className="article-description">{note.description}</p>
          <div className="article-meta"><span className={`note-status status-${note.status}`}><span />{note.status === "growing" ? "Growing" : note.status === "stable" ? "Stable" : "Seed"}</span><span><Icon name="calendar" /><time dateTime={note.updated}>{note.updated.replaceAll("-", ".")}</time></span><span><Icon name="clock" />约 {note.readingMinutes} 分钟</span></div>
        </header>
        <article className="prose"><Content components={{ h1: () => null }} /></article>
        <div className="note-tags"><span>FILED UNDER</span>{note.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <div className="article-end"><div><Icon name="leaf" /><span>这篇笔记还会继续生长。</span></div><Link href="/">回到知识库 <Icon name="arrow" /></Link></div>
      </div>
      <TableOfContents items={toc} />
    </div>
  );
}
