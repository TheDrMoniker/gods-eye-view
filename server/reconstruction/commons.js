/**
 * GODS-EYE-RECONSTRUCTION-01: metadata-only Commons photo discovery.
 * Never downloads imagery or treats a category match as proof of a building match.
 */
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const DEFAULT_AGENT =
  'GodsEyeReconstruction/0.1 (https://github.com/TheDrMoniker/gods-eye-view)';

function plainText(value) {
  const raw = typeof value === 'string' ? value : value?.value;
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1000);
}

/** A hint, never permission to download or reconstruct from an image. */
export function licenseHint(shortName) {
  const name = plainText(shortName);
  if (/^(CC0(?:\s+\d+(?:\.\d+)?)?|Public domain)$/i.test(name))
    return 'potentially_reusable';
  if (/^CC BY(?:-SA)?(?:\s+\d+(?:\.\d+)?)$/i.test(name))
    return 'potentially_reusable';
  return 'unknown_or_restricted';
}

export function normalizeCommonsPhoto(page) {
  if (page?.ns !== 6 || !page?.title?.startsWith('File:')) return null;
  const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] || {} : {};
  const meta = info.extmetadata || {};
  const title = page.title;
  return {
    id: 'commons:' + (page.pageid ?? title),
    provider: 'wikimedia_commons',
    file_title: title,
    source_page:
      'https://commons.wikimedia.org/wiki/' +
      encodeURIComponent(title.replaceAll(' ', '_')),
    creator: plainText(meta.Artist),
    credit: plainText(meta.Credit),
    license: {
      short_name: plainText(meta.LicenseShortName),
      url: plainText(meta.LicenseUrl),
      hint: licenseHint(meta.LicenseShortName),
      status: 'needs_human_review',
    },
    captured_at_text: plainText(meta.DateTimeOriginal) || null,
    uploaded_at: info.timestamp || null,
    pixel_width: Number.isFinite(info.width) ? info.width : null,
    pixel_height: Number.isFinite(info.height) ? info.height : null,
    review: {
      target_identity: 'unverified',
      rights: 'unreviewed',
      view: 'unverified',
      camera_pose: 'unverified',
      reviewed_by: null,
      reviewed_at: null,
    },
    geometry_role: 'unverified',
    download_approved: false,
    reconstruction_approved: false,
  };
}

function boundedInteger(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum)
    throw new RangeError(
      name + ' must be an integer between ' + minimum + ' and ' + maximum,
    );
  return value;
}

/**
 * One request at a time; 10 images/page due to expensive extmetadata lookups.
 * Caller owns any later review of image rights, content and matching.
 */
export async function discoverCommonsPhotos({
  category,
  fetchImpl = (...args) => globalThis.fetch(...args),
  userAgent = DEFAULT_AGENT,
  maxPages = 3,
  pageSize = 10,
  signal,
} = {}) {
  if (
    typeof category !== 'string' ||
    !category.startsWith('Category:') ||
    category.length > 250 ||
    category.length <= 'Category:'.length
  )
    throw new TypeError('A Commons Category: title is required');
  boundedInteger(maxPages, 1, 5, 'maxPages');
  boundedInteger(pageSize, 1, 10, 'pageSize');
  if (typeof userAgent !== 'string' || !userAgent.includes('https://'))
    throw new TypeError('userAgent must identify the client and project URL');

  const seen = new Set();
  const candidates = [];
  let continuation = null;
  let truncated = false;

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const url = new URL(COMMONS_API);
    const params = {
      action: 'query',
      generator: 'categorymembers',
      gcmtitle: category,
      gcmtype: 'file',
      gcmlimit: String(pageSize),
      prop: 'imageinfo',
      iiprop: 'size|timestamp|extmetadata',
      iiextmetadatafilter:
        'Artist|Credit|DateTimeOriginal|LicenseShortName|LicenseUrl',
      format: 'json',
      formatversion: '2',
      ...(continuation || {}),
    };
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, String(value));
    const response = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { 'User-Agent': userAgent, 'Api-User-Agent': userAgent },
      signal,
    });
    if (!response.ok) {
      const retryAfter = response.headers?.get?.('retry-after');
      const error = new Error(
        'Wikimedia Commons HTTP ' +
          response.status +
          (retryAfter ? ' (Retry-After ' + retryAfter + ' seconds)' : ''),
      );
      error.status = response.status;
      error.retryAfter = retryAfter || null;
      throw error; // Do not circumvent rate limits with automatic retries.
    }
    const payload = await response.json();
    if (payload?.error)
      throw new Error(
        'Wikimedia Commons API error: ' +
          String(payload.error.code || payload.error.info || 'unknown'),
      );
    const pages = Array.isArray(payload?.query?.pages)
      ? payload.query.pages
      : Object.values(payload?.query?.pages || {});
    for (const page of pages) {
      const candidate = normalizeCommonsPhoto(page);
      if (candidate && !seen.has(candidate.id)) {
        seen.add(candidate.id);
        candidates.push(candidate);
      }
    }
    continuation = payload?.continue || null;
    truncated = Boolean(continuation);
    if (!continuation) break;
  }

  return {
    provider: 'wikimedia_commons',
    category,
    retrieved_at: new Date().toISOString(),
    total_candidates: candidates.length,
    truncated,
    candidates,
  };
}
