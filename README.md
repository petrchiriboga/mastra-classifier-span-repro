# Classifier spans have no input/output and their usage is not costed

`Classifier.decide()` creates a `classifier_evaluation` span with only attributes. The span has no `input` (state, questions) and no `output` (answers), so a trace shows that a classifier ran but not what it decided. The span's `usage` is never turned into `mastra_model_total_*_tokens` metrics, so classifier tokens and cost are missing from every trace and from Studio cost.

A stub decision model returns usage `{ inputTokens: 100, outputTokens: 20 }`. An agent with a stub language model returning the same usage is the control.

## Run

```sh
npm install && npm start
```

## Expected

- The `classifier_evaluation` span has `input` (state and questions) and `output` (answers), like `model_generation`.
- Token metrics are emitted for both the classifier (`stub-decision`) and the agent (`stub-llm`).

## Actual (`@mastra/core` 1.78.0, `@mastra/observability` 1.20.1)

```
classifier_evaluation {"hasInput":false,"hasOutput":false,"usage":{"inputTokens":100,"outputTokens":20}}
model_generation {"hasInput":true,"hasOutput":true,"usage":{"inputTokens":100,"outputTokens":20,...}}
token metrics ["stub-llm mastra_model_total_input_tokens=100","stub-llm mastra_model_total_output_tokens=20"]
```

- `Classifier.decide` creates the span with attributes only and later updates attributes only ([classifier/index.ts#L291-L384](https://github.com/mastra-ai/mastra/blob/370f159e96f1e630cd51d06a9e3a7a0a6659c465/packages/core/src/classifier/index.ts#L291-L384)).
- `emitTokenMetrics` returns unless the span is `MODEL_GENERATION` ([auto-extract.ts#L38](https://github.com/mastra-ai/mastra/blob/370f159e96f1e630cd51d06a9e3a7a0a6659c465/observability/mastra/src/metrics/auto-extract.ts#L38)).
