import { describe, it, expect } from 'vitest';
import { parseSpaceNames } from './spaces';

describe('parseSpaceNames', () => {
  it('expands number ranges', () => {
    expect(parseSpaceNames('101-105')).toEqual(['101', '102', '103', '104', '105']);
  });
  it('expands prefixed ranges and keeps zero padding', () => {
    expect(parseSpaceNames('T1-T3')).toEqual(['T1', 'T2', 'T3']);
    expect(parseSpaceNames('B-08-10')).toEqual(['B-08', 'B-09', 'B-10']);
  });
  it('takes plain lists, mixes, and drops duplicates', () => {
    expect(parseSpaceNames('Deluxe, Suite, 1-2, deluxe')).toEqual(['Deluxe', 'Suite', '1', '2']);
  });
  it('leaves odd input as a single name', () => {
    expect(parseSpaceNames('Terrace 4')).toEqual(['Terrace 4']);
    expect(parseSpaceNames('9-3')).toEqual(['9-3']);
  });
});
