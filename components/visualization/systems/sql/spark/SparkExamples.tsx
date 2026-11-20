import { CLICK_EVENTS } from '@/lib/systems/sql/groupBy';
import { SparkFrame, SparkCode } from './SparkViews';
export function SparkApiExamples() {
  const rows=CLICK_EVENTS.map(r=>`    ("${r.eventId}", "${r.adId}", "${r.minute}"),`).join('\n');
  return <SparkFrame title="同一个聚合目标 · 三种 API" description="可在已安装 PySpark 的环境运行；网页只展示代码，不启动 Spark。共用下面的输入。">
    <SparkCode code={`from pyspark.sql import SparkSession, functions as F\n\nspark = SparkSession.builder.appName("ClickCounts").getOrCreate()\ndata = [\n${rows}\n]\ndf = spark.createDataFrame(data, ["eventId", "adId", "minute"])`}/>
    <h5>RDD · 直接表达 Key / Value 聚合</h5><SparkCode code={'rdd = spark.sparkContext.parallelize(data, 2)\npairs = rdd.map(lambda e: ((e[1], e[2]), 1))\ncounts = pairs.reduceByKey(lambda a, b: a + b)\n# collect 只用于这个小结果；结果顺序不保证\nprint(counts.collect())'}/>
    <h5>DataFrame · 结构化列与聚合函数</h5><SparkCode code={'result = (\n    df.groupBy("adId", "minute")\n      .agg(F.count("*").alias("totalClicks"))\n)\nresult.show()\nresult.explain("formatted")'}/>
    <h5>Spark SQL · 声明分析目标</h5><SparkCode lang="sql" code={'SELECT adId, minute, COUNT(*) AS totalClicks\nFROM ClickEvents\nGROUP BY adId, minute;'}/><SparkCode code={'df.createOrReplaceTempView("ClickEvents")\nsql_result = spark.sql("""\nSELECT adId, minute, COUNT(*) AS totalClicks\nFROM ClickEvents\nGROUP BY adId, minute\n""")\nsql_result.show()\nspark.stop()'}/>
  </SparkFrame>;
}
export function CombineExamples() {
  return <SparkFrame title="groupByKey vs reduceByKey" description="沿用 pairs = ((adId, minute), 1)。两者都求和，但中间数据形态不同。">
    <SparkCode code={'# 把一个 Key 的所有值分组，再求和\ngrouped = pairs.groupByKey().mapValues(sum)\n\n# 可合并计数先在 Map 端求和，再跨分区合并\ncombined = pairs.reduceByKey(lambda a, b: a + b)'}/>
    <div className="spark-grid"><div className="spark-panel"><h5>groupByKey + sum</h5><p>P0: [1]，P1: [1] → Shuffle 两个值 → 同 Key 的值集合 → sum = 2</p></div><div className="spark-panel"><h5>reduceByKey</h5><p>P0/P1 先各压缩重复 Key → Shuffle 局部计数 → 再相加。A · 10:01 两边仍各为 1。</p></div></div>
  </SparkFrame>;
}
export function LazyCode() {
  return <SparkFrame title="定义依赖，还是发起计算？" description="用上一节相同 data；没有 collect 之前，这段 RDD 变换只定义依赖。"><SparkCode code={'rdd = spark.sparkContext.parallelize(data, 2)\nfiltered = rdd.filter(lambda e: e[1] != "")\nmapped = filtered.map(lambda e: ((e[1], e[2]), 1))\nresult = mapped.reduceByKey(lambda a, b: a + b)\n\n# Action：触发执行，把小结果返回 Driver\nsmall_result = result.collect()'}/></SparkFrame>;
}
