export function hasEnoughExportCredits(totalAvailable: number, exportCost: number): boolean {
  return Number.isFinite(totalAvailable) && Number.isFinite(exportCost) && exportCost > 0 && totalAvailable >= exportCost;
}