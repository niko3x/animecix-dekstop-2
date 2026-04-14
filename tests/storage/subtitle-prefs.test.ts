import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { INIT_SCHEMA } from '../../src/storage/schema';

// We test the schema and SQL logic directly using better-sqlite3 in-memory DB
// to avoid dependency on Electron's app.getPath('userData')

describe('SubtitlePrefsService', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(INIT_SCHEMA);
  });

  afterEach(() => {
    db.close();
  });

  it('subtitle_prefs table is created on schema init', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='subtitle_prefs'")
      .get() as { name: string } | undefined;
    expect(row?.name).toBe('subtitle_prefs');
  });

  it('getSubtitlePref returns "tr" for unknown anime', () => {
    // Simulate StorageService.getSubtitlePref logic
    const animeId = 'unknown-anime';
    const row = db
      .prepare('SELECT language FROM subtitle_prefs WHERE anime_id = ?')
      .get(animeId) as { language: string } | undefined;
    const result = row?.language ?? 'tr';
    expect(result).toBe('tr');
  });

  it('setSubtitlePref stores and retrieves language', () => {
    // Insert
    db.prepare('INSERT OR REPLACE INTO subtitle_prefs (anime_id, language, updated_at) VALUES (?, ?, unixepoch())')
      .run('naruto', 'en');

    // Retrieve
    const row = db
      .prepare('SELECT language FROM subtitle_prefs WHERE anime_id = ?')
      .get('naruto') as { language: string } | undefined;
    const result = row?.language ?? 'tr';
    expect(result).toBe('en');
  });

  it('setSubtitlePref overwrites existing preference', () => {
    // Insert initial
    db.prepare('INSERT OR REPLACE INTO subtitle_prefs (anime_id, language, updated_at) VALUES (?, ?, unixepoch())')
      .run('naruto', 'en');

    // Overwrite
    db.prepare('INSERT OR REPLACE INTO subtitle_prefs (anime_id, language, updated_at) VALUES (?, ?, unixepoch())')
      .run('naruto', 'ja');

    // Check final value
    const row = db
      .prepare('SELECT language FROM subtitle_prefs WHERE anime_id = ?')
      .get('naruto') as { language: string } | undefined;
    const result = row?.language ?? 'tr';
    expect(result).toBe('ja');
  });
});
