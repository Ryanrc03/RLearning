# PPO 深度笔记设计

按用户完整交接稿实施，复用 MDX、KaTeX、VisualizationFrame 与现有控件，不增加依赖。放在 RLHF → PPO → GRPO，静态导出。

|组件|章节|教学目标|
|---|---|---|
|RoleArchitectureFigure|四种逻辑角色|点击卡片查看输入输出、训练状态、初始化与关系；SVG 显示数据流|
|AdvantageFigure|Value / Advantage|可调 return 和 value，实际计算差值|
|GaeFigure|GAE|三步轨迹倒序展开，调整 λ|
|ClippingFigure|Clipped objective|正负 advantage、ratio、ε 与真实分段曲线|
|PipelineFigure|训练循环|九步查看输入输出、模型、更新对象|
|PpoVsGrpoFigure|引出 GRPO|同一道题对照 critic/GAE 与组内标准化|

所有数字标注为教学示例，真实算法来源为 PPO、GAE、DeepSeekMath 论文。四角色不等于四个完整 backbone，old policy 不等于 reference，clipping 不提供硬约束。保持现有文章和未提交改动。
