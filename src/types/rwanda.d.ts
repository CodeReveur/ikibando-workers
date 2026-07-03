/**
 * Type declarations for the `rwanda` package.
 * The published package ships types at dist/index.d.ts but its package.json
 * "exports" map prevents TypeScript from resolving them, so we declare a
 * permissive surface here (values are dynamic user selections, hence `string`).
 */
declare module "rwanda" {
  export function Provinces(): string[];
  export function Districts(params?: { provinces: string | string[] }): string[] | undefined;
  export function Sectors(params?: { province: string; district: string }): string[] | undefined;
  export function Cells(params?: { province: string; district: string; sector: string }): string[] | undefined;
  export function Villages(params?: { province: string; district: string; sector: string; cell: string }): string[] | undefined;
}
