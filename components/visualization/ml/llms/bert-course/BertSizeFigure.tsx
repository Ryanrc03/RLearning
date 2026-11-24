import Bars from "@/components/visualization/ml/primitives/Bars";
import { BERT_SIZES, SLIDE_LARGE_PARAMS_M } from "@/lib/ml/bertPretrain";
import { BahFrame, P } from "../bahdanau/shared";

const [BASE, LARGE] = BERT_SIZES;

// Static: the two sizes side by side. Every number comes from BERT_SIZES.
export default function BertSizeFigure() {
  const pair = (label: string, a: number, b: number, unit = "") => [
    { label: `${label} · Base`, value: a, max: b, color: P.enc, text: `${a}${unit}` },
    { label: `${label} · Large`, value: b, max: b, color: P.att, text: `${b}${unit}` },
  ];
  return (
    <BahFrame
      title="图 6 · BERT Base 与 BERT Large"
      description="两种尺寸的结构相同，只是更深、更宽、head 更多。每组两条按 Large 的值归一化。"
      footnote={<>数字来自原论文。课件截图把 Large 的参数量写成 {SLIDE_LARGE_PARAMS_M}M，原论文是 {LARGE.paramsM}M，这里以论文为准。{BASE.tpus} / {LARGE.tpus} 个 TPU、约 {BASE.days} 天是论文当年的训练配置，不是今天训练这类模型的固定成本。</>}
    >
      <Bars
        rows={[
          ...pair("Encoder 层数", BASE.layers, LARGE.layers),
          ...pair("Hidden 维度", BASE.hidden, LARGE.hidden),
          ...pair("Attention heads", BASE.heads, LARGE.heads),
          ...pair("参数量", BASE.paramsM, LARGE.paramsM, "M"),
        ]}
      />
      <div className="viz-narr">
        Large 的层数是 Base 的 {LARGE.layers / BASE.layers} 倍，参数量约是 {(LARGE.paramsM / BASE.paramsM).toFixed(1)} 倍。两者每个 head 的宽度相同：{BASE.hidden} / {BASE.heads} = {LARGE.hidden} / {LARGE.heads} = {BASE.hidden / BASE.heads}。
      </div>
    </BahFrame>
  );
}
