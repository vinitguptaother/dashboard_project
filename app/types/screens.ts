/**
 * Shared TypeScript types for Screens and Batches
 * Used across the application for consistent screen management
 */

export type ScreenId = string;

export interface ScreenDefinition {
  id: ScreenId;
  name: string;
  shortDescription: string;
  queryText: string;
  isActive: boolean;
}

export interface ScreenSymbol {
  symbol: string;
  name?: string;
  sector?: string;
  marketCap?: number;
}

export interface ScreenBatch {
  id: string;
  screenId: ScreenId;
  importedAt: string; // ISO date string
  symbols: ScreenSymbol[];
}
