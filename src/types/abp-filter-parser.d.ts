declare module 'abp-filter-parser' {
  interface FilterData {
    [key: string]: unknown;
  }
  interface MatchOptions {
    domain?: string;
    elementType?: string;
  }
  export function parse(input: string, data: FilterData): void;
  export function matches(data: FilterData, url: string, options?: MatchOptions): boolean;
}
