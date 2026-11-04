import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

export const platform = {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  homedir,
};
