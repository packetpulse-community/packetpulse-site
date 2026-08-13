// Must be imported before any other module in main.ts — OpenTelemetry needs to
// patch HTTP/Prisma/Redis client internals before those clients are first constructed,
// otherwise their calls go uninstrumented for the lifetime of the process.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on("SIGTERM", () => {
  sdk.shutdown().finally(() => process.exit(0));
});
