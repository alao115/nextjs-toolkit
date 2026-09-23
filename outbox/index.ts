/**
 * @experimental — API may change before 1.0. The in-memory adapter is NOT
 * production-ready; use a persistent backend (Postgres outbox table is the
 * canonical choice).
 */
export * from "./outbox.contract.js";
export * from "./prisma-outbox.adapter.js";
export * from "./in-memory-outbox.adapter.js";
export * from "./outbox.module.js";
export * from "./outbox.worker.js";

