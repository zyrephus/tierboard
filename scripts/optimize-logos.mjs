// One-time logo optimizer.
//
// Downloads each raster logo from the `logos` bucket, resizes to <=128px and
// converts to WebP, re-uploads as `<name>.webp` with a 1-year cache, points
// companies.logo_url at the new file, then deletes the original. SVGs are left
// untouched (vector, already tiny).
//
// Run (Node 20.6+):
//   npm i -D sharp
//   SUPABASE_SERVICE_ROLE_KEY=... node --env-file=.env.local scripts/optimize-logos.mjs
//
// Dry run (no writes/deletes), recommended first:
//   ... DRY_RUN=1 node --env-file=.env.local scripts/optimize-logos.mjs

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = !!process.env.DRY_RUN;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const BUCKET = 'logos';
const SIZE = 128;
const prefix = `${url}/storage/v1/object/public/${BUCKET}/`;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const { data: companies, error } = await supabase
  .from('companies')
  .select('id, logo_url')
  .not('logo_url', 'is', null);
if (error) throw error;

let converted = 0, skipped = 0, failed = 0, saved = 0;

for (const { id, logo_url } of companies) {
  if (!logo_url.startsWith(prefix)) { console.warn(`skip (unexpected url): ${logo_url}`); skipped++; continue; }
  const oldPath = logo_url.slice(prefix.length);
  if (oldPath.toLowerCase().endsWith('.svg')) { skipped++; continue; }

  const newPath = oldPath.replace(/\.[^.]+$/, '.webp');

  try {
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(oldPath);
    if (dlErr) throw dlErr;
    const input = Buffer.from(await blob.arrayBuffer());

    const output = await sharp(input)
      .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    if (DRY_RUN) {
      console.log(`(dry) ${oldPath} → ${newPath}  ${input.length} → ${output.length} bytes`);
      saved += input.length - output.length;
      converted++;
      continue;
    }

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, output, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });
    if (upErr) throw upErr;

    const { error: dbErr } = await supabase
      .from('companies')
      .update({ logo_url: `${prefix}${newPath}` })
      .eq('id', id);
    if (dbErr) throw dbErr;

    // Only delete when the path actually changed (e.g. .jpeg → .webp). An
    // already-.webp original was overwritten in place by the upsert above.
    if (newPath !== oldPath) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
      if (rmErr) throw rmErr;
    }

    console.log(`✓ ${oldPath} → ${newPath}  ${input.length} → ${output.length} bytes`);
    saved += input.length - output.length;
    converted++;
  } catch (e) {
    console.error(`✗ ${oldPath}: ${e.message ?? e}`);
    failed++;
  }
}

console.log(`\n${DRY_RUN ? '(dry run) ' : ''}converted=${converted} skipped=${skipped} failed=${failed} saved=${(saved / 1024).toFixed(0)}KB`);
