import { Mastra } from "@mastra/core";
import { Agent } from "@mastra/core/agent";
import { Classifier } from "@mastra/core/classifier";
import { Observability, TestExporter } from "@mastra/observability";

const usage = { inputTokens: 100, outputTokens: 20 };

const decisionModel = {
  specificationVersion: "v4",
  provider: "test",
  modelId: "stub-decision",
  supportedQuestionTypes: ["choice", "score", "boolean"],
  doDecide: async () => ({
    answers: { route: { type: "choice", choice: "billing" } },
    usage,
    warnings: [],
  }),
};

const languageModel = {
  specificationVersion: "v2",
  provider: "test",
  modelId: "stub-llm",
  supportedUrls: {},
  doGenerate: async () => {
    throw new Error("unused");
  },
  doStream: async () => ({
    stream: new ReadableStream({
      start(c) {
        for (const chunk of [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "billing" },
          { type: "text-end", id: "t" },
          { type: "finish", finishReason: "stop", usage: { ...usage, totalTokens: 120 } },
        ])
          c.enqueue(chunk);
        c.close();
      },
    }),
  }),
};

const exporter = new TestExporter({ logMetricsOnFlush: false });
const classifier = new Classifier({ id: "router", model: decisionModel });
const agent = new Agent({ id: "agent", name: "Agent", instructions: "Route the request.", model: languageModel });
new Mastra({
  agents: { agent },
  classifiers: { router: classifier },
  observability: new Observability({ configs: { default: { serviceName: "repro", exporters: [exporter] } } }),
});

const state = "I was charged twice for my order.";
await classifier.decide({
  state,
  questions: { route: { type: "choice", criteria: { billing: null, shipping: null } } },
});
const stream = await agent.stream(state);
for await (const _ of stream.fullStream);
await exporter.flush();

for (const s of exporter.getCompletedSpans().filter((s) => ["classifier_evaluation", "model_generation"].includes(s.type))) {
  console.log(s.type, JSON.stringify({ hasInput: s.input != null, hasOutput: s.output != null, usage: s.attributes?.usage }));
}
const tokenMetrics = exporter.getAllMetrics().filter((m) => m.name.startsWith("mastra_model_total"));
console.log("token metrics", JSON.stringify(tokenMetrics.map((m) => `${m.costContext?.model} ${m.name}=${m.value}`)));
