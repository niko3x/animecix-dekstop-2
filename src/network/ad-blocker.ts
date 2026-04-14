import * as path from 'path';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ABPFilterParser = require('abp-filter-parser') as {
  parse: (text: string, filterData: object) => void;
  matches: (filterData: object, url: string, options: { domain: string }) => boolean;
};

/**
 * Pure function: returns true if the URL is a first-party domain that
 * should never be blocked (animecix.tv or tau-video.xyz).
 */
export function isWhitelisted(url: string): boolean {
  return url.includes('animecix.tv') || url.includes('tau-video.xyz');
}

/**
 * AdBlocker class: parses EasyList/EasyPrivacy filter lists and
 * provides shouldBlock(url) for the combined request handler.
 */
export class AdBlocker {
  private filterData: object = {};
  private filtersLoaded = false;

  constructor() {
    // Filters are loaded lazily / explicitly; constructor does not auto-load
    // so tests can instantiate without needing the bundled files.
  }

  /**
   * Load bundled EasyList and EasyPrivacy from the filter-lists directory.
   * Called from the main process during app initialization.
   */
  loadFilterLists(): void {
    const filterDir = path.join(__dirname, 'filter-lists');
    this.filterData = {};

    for (const fileName of ['easylist.txt', 'easyprivacy.txt']) {
      const filePath = path.join(filterDir, fileName);
      try {
        const text = fs.readFileSync(filePath, 'utf8');
        ABPFilterParser.parse(text, this.filterData);
      } catch (err) {
        // If filter file is missing, log and continue — app still works without
        console.warn(`[AdBlocker] Could not load ${fileName}:`, err);
      }
    }

    this.filtersLoaded = true;
  }

  /**
   * Load test filter rules directly from a string (for unit tests).
   * This avoids needing the bundled EasyList files in the test environment.
   */
  loadTestFilters(filterText: string): void {
    this.filterData = {};
    ABPFilterParser.parse(filterText, this.filterData);
    this.filtersLoaded = true;
  }

  /**
   * Returns true if the URL should be blocked.
   * Always allows first-party (animecix.tv, tau-video.xyz) URLs through.
   */
  shouldBlock(url: string): boolean {
    // Whitelist: never block first-party domains
    if (isWhitelisted(url)) {
      return false;
    }

    // If no filters loaded, don't block anything
    if (!this.filtersLoaded) {
      return false;
    }

    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return false;
    }

    try {
      return ABPFilterParser.matches(this.filterData, url, { domain: hostname });
    } catch {
      // filterData may be incomplete if filter lists failed to load — don't crash
      return false;
    }
  }
}
