/**
 * Assembles the default ToolRegistry from the catalogue. The knowledge searcher
 * is injected so the tools stay decoupled from the knowledge module.
 */
import { ToolRegistry } from "./registry";
import { buildCatalog, type CatalogDeps } from "./catalog";

export { ToolRegistry } from "./registry";
export type { Tool, ToolContext, ToolResult } from "./types";

export function buildRegistry(deps: CatalogDeps = {}): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of buildCatalog(deps)) registry.register(tool);
  return registry;
}
