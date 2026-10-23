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
import DataOverview from "@/content/systems/data/overview.mdx";
import DesignMessageQueue from "@/content/systems/design/message-queue.mdx";
import DesignCache from "@/content/systems/design/cache.mdx";
import DesignSharding from "@/content/systems/design/sharding.mdx";
import DesignDataModeling from "@/content/systems/design/data-modeling.mdx";
import DesignApi from "@/content/systems/design/api.mdx";
import DesignAbPlatform from "@/content/systems/design/ab-testing-analytics-platform.mdx";
import Serverless from "@/content/systems/backend/serverless.mdx";
import AgentLoop from "@/content/ai-infra/agent-harness/agent-loop.mdx";
import ToolsPermissionsHooks from "@/content/ai-infra/agent-harness/tools-permissions-hooks.mdx";
import SubagentsSkillsMcp from "@/content/ai-infra/agent-harness/subagents-skills-mcp.mdx";
import GoalsAndHarnessDesign from "@/content/ai-infra/agent-harness/goals-and-harness-design.mdx";
import GpuOverview from "@/content/ai-infra/gpu/overview.mdx";
import CpuVsGpu from "@/content/ai-infra/gpu/cpu-vs-gpu.mdx";
import ComputeVsMemoryBound from "@/content/ai-infra/gpu/compute-vs-memory-bound.mdx";
import GlobalVsSharedMemory from "@/content/ai-infra/gpu/global-vs-shared-memory.mdx";
import SeparateVsFusedKernels from "@/content/ai-infra/gpu/separate-vs-fused-kernels.mdx";
import ThreadVsWarpPerRow from "@/content/ai-infra/gpu/thread-vs-warp-per-row.mdx";
import AggregateVsProjectFirst from "@/content/ai-infra/gpu/aggregate-vs-project-first.mdx";
import ImplicitGemmVsFft from "@/content/ai-infra/gpu/implicit-gemm-vs-fft.mdx";
import TransformerVsRnn from "@/content/ml/llms/transformer-vs-rnn.mdx";
import VisualTokens from "@/content/ml/multimodal/visual-tokens.mdx";
import VisionLanguageAlignment from "@/content/ml/multimodal/vision-language-alignment.mdx";
import ClipContrastiveLearning from "@/content/ml/multimodal/clip-contrastive-learning.mdx";
import MultistickerProject from "@/content/ml/multimodal/multisticker-project.mdx";
import MlOverview from "@/content/ml/overview.mdx";
import EvaluationOverview from "@/content/ml/evaluation/overview.mdx";
import ConfusionMatrix from "@/content/ml/evaluation/confusion-matrix.mdx";
import PrecisionRecallF1 from "@/content/ml/evaluation/precision-recall-f1.mdx";
import RocAuc from "@/content/ml/evaluation/roc-auc.mdx";
import PrCurvePrecisionAtK from "@/content/ml/evaluation/pr-curve-precision-at-k.mdx";
import AbTestPValue from "@/content/ml/evaluation/ab-test-p-value.mdx";
import LlmsOverview from "@/content/ml/llms/overview.mdx";
import Rnn from "@/content/ml/llms/rnn.mdx";
import AttentionQkv from "@/content/ml/llms/attention-qkv.mdx";
import MultiHeadAttention from "@/content/ml/llms/multi-head-attention.mdx";
import TransformerBlock from "@/content/ml/llms/transformer-block.mdx";
import PretrainingObjectives from "@/content/ml/llms/pretraining-objectives.mdx";
import DecodingStrategies from "@/content/ml/llms/decoding-strategies.mdx";
import Bert from "@/content/ml/llms/bert.mdx";
import BertVsMacbert from "@/content/ml/llms/bert-vs-macbert.mdx";
import BertFinetuning from "@/content/ml/llms/bert-finetuning.mdx";
import InceptionBlock from "@/content/ml/dl-blocks/inception-block.mdx";
import RetrievalPrecisionAtK from "@/content/ml/recsys/retrieval-precision-at-k.mdx";
import ClassifiersOverview from "@/content/ml/classifiers/overview.mdx";
import NaiveBayes from "@/content/ml/classifiers/naive-bayes.mdx";
import LogisticRegression from "@/content/ml/classifiers/logistic-regression.mdx";
import SoftmaxCrossEntropy from "@/content/ml/classifiers/softmax-cross-entropy.mdx";
import TrainingOverview from "@/content/ml/training/overview.mdx";
import GradientDescentOptimizers from "@/content/ml/training/gradient-descent-optimizers.mdx";
import BiasVariance from "@/content/ml/training/bias-variance.mdx";
import RegularizationL1L2 from "@/content/ml/training/regularization-l1-l2.mdx";
import TreesOverview from "@/content/ml/trees/overview.mdx";
import DecisionTree from "@/content/ml/trees/decision-tree.mdx";
import Ensembles from "@/content/ml/trees/ensembles.mdx";
import Gbdt from "@/content/ml/trees/gbdt.mdx";
import XgboostLightgbm from "@/content/ml/trees/xgboost-lightgbm.mdx";
import RepresentationsOverview from "@/content/ml/representations/overview.mdx";
import Word2Vec from "@/content/ml/representations/word2vec.mdx";
import SentenceEmbedding from "@/content/ml/representations/sentence-embedding.mdx";
import CosineSimilarity from "@/content/ml/representations/cosine-similarity.mdx";
import Tfidf from "@/content/ml/representations/tf-idf.mdx";
import DlBlocksOverview from "@/content/ml/dl-blocks/overview.mdx";
import BackpropChainRule from "@/content/ml/dl-blocks/backprop-chain-rule.mdx";
import ResidualConnection from "@/content/ml/dl-blocks/residual-connection.mdx";
import Normalization from "@/content/ml/dl-blocks/normalization.mdx";
import LlmEngineeringOverview from "@/content/ml/llm-engineering/overview.mdx";
import PromptEngineering from "@/content/ml/llm-engineering/prompt-engineering.mdx";
import ContextEngineering from "@/content/ml/llm-engineering/context-engineering.mdx";
import Hallucination from "@/content/ml/llm-engineering/hallucination.mdx";
import BinarySearchTemplates from "@/content/algorithms/binary-search/templates.mdx";
import BinarySearchOnAnswer from "@/content/algorithms/binary-search/on-answer.mdx";
import MonotonicStack from "@/content/algorithms/stack/monotonic-stack.mdx";
import PostTrainingOverview from "@/content/ml/post-training/overview.mdx";
import Sft from "@/content/ml/post-training/sft.mdx";
import Lora from "@/content/ml/post-training/lora.mdx";
import Rlhf from "@/content/ml/post-training/rlhf.mdx";
import Grpo from "@/content/ml/post-training/grpo.mdx";
import RewardHacking from "@/content/ml/post-training/reward-hacking.mdx";
import LlmAsJudge from "@/content/ml/llm-engineering/llm-as-judge.mdx";
import EvalHarness from "@/content/ml/llm-engineering/eval-harness.mdx";
import CtrCvrEsmm from "@/content/ml/recsys/ctr-cvr-esmm.mdx";
import FeatureCrossing from "@/content/ml/recsys/feature-crossing.mdx";
import SampleFeatureJoin from "@/content/ml/recsys/sample-feature-join.mdx";
import PointInTimeSplit from "@/content/ml/recsys/point-in-time-split.mdx";
import GaucPairedBootstrap from "@/content/ml/recsys/gauc-paired-bootstrap.mdx";
import TTest from "@/content/ml/evaluation/t-test.mdx";
import { getNote, getSeriesNeighbors, noteEntries } from "@/content/notes";
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
  "systems/data/overview": DataOverview,
  "systems/design/message-queue": DesignMessageQueue,
  "systems/design/cache": DesignCache,
  "systems/design/sharding": DesignSharding,
  "systems/design/data-modeling": DesignDataModeling,
  "systems/design/api": DesignApi,
  "systems/design/ab-testing-analytics-platform": DesignAbPlatform,
  "systems/backend/serverless": Serverless,
  "ai-infra/agent-harness/agent-loop": AgentLoop,
  "ai-infra/agent-harness/tools-permissions-hooks": ToolsPermissionsHooks,
  "ai-infra/agent-harness/subagents-skills-mcp": SubagentsSkillsMcp,
  "ai-infra/agent-harness/goals-and-harness-design": GoalsAndHarnessDesign,
  "ai-infra/gpu/overview": GpuOverview,
  "ai-infra/gpu/cpu-vs-gpu": CpuVsGpu,
  "ai-infra/gpu/compute-vs-memory-bound": ComputeVsMemoryBound,
  "ai-infra/gpu/global-vs-shared-memory": GlobalVsSharedMemory,
  "ai-infra/gpu/separate-vs-fused-kernels": SeparateVsFusedKernels,
  "ai-infra/gpu/thread-vs-warp-per-row": ThreadVsWarpPerRow,
  "ai-infra/gpu/aggregate-vs-project-first": AggregateVsProjectFirst,
  "ai-infra/gpu/implicit-gemm-vs-fft": ImplicitGemmVsFft,
  "ml/llms/transformer-vs-rnn": TransformerVsRnn,
  "ml/multimodal/visual-tokens": VisualTokens,
  "ml/multimodal/vision-language-alignment": VisionLanguageAlignment,
  "ml/multimodal/clip-contrastive-learning": ClipContrastiveLearning,
  "ml/multimodal/multisticker-project": MultistickerProject,
  "ml/overview": MlOverview,
  "ml/evaluation/overview": EvaluationOverview,
  "ml/evaluation/confusion-matrix": ConfusionMatrix,
  "ml/evaluation/precision-recall-f1": PrecisionRecallF1,
  "ml/evaluation/roc-auc": RocAuc,
  "ml/evaluation/pr-curve-precision-at-k": PrCurvePrecisionAtK,
  "ml/evaluation/ab-test-p-value": AbTestPValue,
  "ml/llms/overview": LlmsOverview,
  "ml/llms/rnn": Rnn,
  "ml/llms/attention-qkv": AttentionQkv,
  "ml/llms/multi-head-attention": MultiHeadAttention,
  "ml/llms/transformer-block": TransformerBlock,
  "ml/llms/pretraining-objectives": PretrainingObjectives,
  "ml/llms/decoding-strategies": DecodingStrategies,
  "ml/llms/bert": Bert,
  "ml/llms/bert-vs-macbert": BertVsMacbert,
  "ml/llms/bert-finetuning": BertFinetuning,
  "ml/dl-blocks/inception-block": InceptionBlock,
  "ml/recsys/retrieval-precision-at-k": RetrievalPrecisionAtK,
  "ml/classifiers/overview": ClassifiersOverview,
  "ml/classifiers/naive-bayes": NaiveBayes,
  "ml/classifiers/logistic-regression": LogisticRegression,
  "ml/classifiers/softmax-cross-entropy": SoftmaxCrossEntropy,
  "ml/training/overview": TrainingOverview,
  "ml/training/gradient-descent-optimizers": GradientDescentOptimizers,
  "ml/training/bias-variance": BiasVariance,
  "ml/training/regularization-l1-l2": RegularizationL1L2,
  "ml/trees/overview": TreesOverview,
  "ml/trees/decision-tree": DecisionTree,
  "ml/trees/ensembles": Ensembles,
  "ml/trees/gbdt": Gbdt,
  "ml/trees/xgboost-lightgbm": XgboostLightgbm,
  "ml/representations/overview": RepresentationsOverview,
  "ml/representations/word2vec": Word2Vec,
  "ml/representations/sentence-embedding": SentenceEmbedding,
  "ml/representations/cosine-similarity": CosineSimilarity,
  "ml/representations/tf-idf": Tfidf,
  "ml/dl-blocks/overview": DlBlocksOverview,
  "ml/dl-blocks/backprop-chain-rule": BackpropChainRule,
  "ml/dl-blocks/residual-connection": ResidualConnection,
  "ml/dl-blocks/normalization": Normalization,
  "ml/llm-engineering/overview": LlmEngineeringOverview,
  "ml/llm-engineering/prompt-engineering": PromptEngineering,
  "ml/llm-engineering/context-engineering": ContextEngineering,
  "ml/llm-engineering/hallucination": Hallucination,
  "algorithms/binary-search/templates": BinarySearchTemplates,
  "algorithms/binary-search/on-answer": BinarySearchOnAnswer,
  "algorithms/stack/monotonic-stack": MonotonicStack,
  "ml/post-training/overview": PostTrainingOverview,
  "ml/post-training/sft": Sft,
  "ml/post-training/lora": Lora,
  "ml/post-training/rlhf": Rlhf,
  "ml/post-training/grpo": Grpo,
  "ml/post-training/reward-hacking": RewardHacking,
  "ml/llm-engineering/llm-as-judge": LlmAsJudge,
  "ml/llm-engineering/eval-harness": EvalHarness,
  "ml/recsys/ctr-cvr-esmm": CtrCvrEsmm,
  "ml/recsys/feature-crossing": FeatureCrossing,
  "ml/recsys/sample-feature-join": SampleFeatureJoin,
  "ml/recsys/point-in-time-split": PointInTimeSplit,
  "ml/recsys/gauc-paired-bootstrap": GaucPairedBootstrap,
  "ml/evaluation/t-test": TTest,
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
  const { prev, next } = getSeriesNeighbors(key);

  return (
    <div className="note-layout">
      <div className="note-main">
        <header className="article-header">
          <div className="note-breadcrumb"><span>{note.category}</span><Icon name="chevron" /><span>{note.section}</span></div>
          <h1>{note.title}</h1>
          <p className="article-description">{note.description}</p>
          <div className="article-meta"><span className={`note-status status-${note.status}`}><span />{note.status === "growing" ? "Growing" : note.status === "stable" ? "Stable" : "Seed"}</span><span><Icon name="calendar" /><time dateTime={note.updated}>{note.updated.replaceAll("-", ".")}</time></span><span><Icon name="clock" />约 {note.readingMinutes} 分钟</span></div>
        </header>
        <article className={note.layout === "case-study" ? "prose prose-case" : "prose"}><Content components={{ h1: () => null }} /></article>
        {note.series && (prev || next) && (
          <nav className="series-nav" aria-label={`系列：${note.series.title}`}>
            {prev ? <Link className="series-link" href={`/notes/${prev.slug}/`}><small>← 上一篇 · {note.series.title}</small><span>{prev.title}</span></Link> : <span />}
            {next ? <Link className="series-link is-next" href={`/notes/${next.slug}/`}><small>下一篇 →</small><span>{next.title}</span></Link> : <span />}
          </nav>
        )}
        <div className="note-tags"><span>FILED UNDER</span>{note.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        <div className="article-end"><div><Icon name="leaf" /><span>这篇笔记还会继续生长。</span></div><Link href="/">回到知识库 <Icon name="arrow" /></Link></div>
      </div>
      <TableOfContents items={toc} />
    </div>
  );
}
