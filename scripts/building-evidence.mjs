/**
 * Run: node scripts/building-evidence.mjs [--out output.json]
 * Metadata-only public image discovery. Does not download image files.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverCommonsPhotos } from '../server/reconstruction/commons.js';
import {
  PHOENIX_CITY_HALL,
  makeBuildingEvidenceRegistry,
} from '../server/reconstruction/planner.js';

export async function runBuildingEvidence(args = process.argv.slice(2)) {
  let outputPath = null;
  let maxPages = 3;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--out' && args[i + 1]) outputPath = args[++i];
    else if (args[i] === '--max-pages' && args[i + 1])
      maxPages = Number(args[++i]);
    else if (args[i] === '--help') {
      process.stdout.write(
        'Usage: node scripts/building-evidence.mjs [--out FILE] [--max-pages 1..5]\n',
      );
      return null;
    } else throw new Error('Unknown or incomplete argument: ' + args[i]);
  }
  const discovery = await discoverCommonsPhotos({
    category: PHOENIX_CITY_HALL.commons_category,
    maxPages,
  });
  const registry = makeBuildingEvidenceRegistry({
    target: PHOENIX_CITY_HALL,
    discovery,
  });
  const json = JSON.stringify(registry, null, 2) + '\n';
  if (outputPath) {
    const destination = path.resolve(outputPath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, json, 'utf8');
    process.stdout.write('Wrote evidence report: ' + destination + '\n');
  } else process.stdout.write(json);
  return registry;
}

const currentScript = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (import.meta.url === currentScript)
  runBuildingEvidence().catch((error) => {
    console.error('[GODS-EYE-RECONSTRUCTION-01] ' + error.message);
    process.exitCode = 1;
  });
