export * from "./generated/api";
// Note: ./generated/types is intentionally not re-exported here — orval emits
// path-param zod schemas (in api.ts) and query-param request interfaces (in
// types/) under the same name, which collides under `export *`. Server code
// only needs the zod schemas; consumers that need a TS interface can import
// directly from "@workspace/api-zod/generated/types/<file>".
