/**
 * @experimental — API may change before 1.0. The in-memory adapter is NOT
 * production-ready; use a persistent backend (Postgres outbox table is the
 * canonical choice).
 */
export * from "./outbox.contract";
export * from "./prisma-outbox.adapter";
export * from "./in-memory-outbox.adapter";
export * from "./outbox.module";
export * from "./outbox.worker";

