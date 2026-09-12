/**
 * Turns whatever an admin pasted into the about page's «رابط فيديو يوتيوب» field into an
 * embed URL, or null when there is nothing usable there.
 *
 * The field is a plain text record edited by hand, so it will hold every shape a person can
 * copy out of a browser or a share sheet — a full watch URL with tracking params, a youtu.be
 * short link, a /shorts/ or /live/ permalink, an already-embeddable /embed/ URL, or just the
 * bare id. Returning null (rather than throwing, or passing the raw string through) is what
 * lets the page drop the video block entirely for an empty or malformed value instead of
 * rendering a broken iframe.
 *
 * The id is always re-matched against [A-Za-z0-9_-]{11} and interpolated into a URL we build
 * ourselves — the admin's string never reaches the iframe's src, so a pasted `javascript:` or
 * a host that merely contains "youtube.com" can't become the frame's origin.
 */

const ID = /^[A-Za-z0-9_-]{11}$/;

/** Hosts we accept a link from. Subdomains are matched too (m.youtube.com, www.youtube.com). */
const HOSTS = ['youtube.com', 'youtube-nocookie.com', 'youtu.be'];

/** `/embed/ID`, `/shorts/ID`, `/live/ID`, `/v/ID` — and on youtu.be, a bare `/ID`. */
const PATH_ID = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/;

/**
 * A `t`/`start` param as YouTube writes it: plain seconds, or the `1h2m3s` form used by the
 * "copy link at current time" share option. Returns 0 when there is nothing to skip to.
 */
function startSeconds(raw: string | null): number {
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Math.min(Number(raw), 86_400);

  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !m[0]) return 0;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return Math.min(total, 86_400);
}

function hostMatches(hostname: string): boolean {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  return HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** The video id in a parsed YouTube URL, or null if this URL doesn't name one. */
function idFromUrl(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
    const bare = url.pathname.slice(1);
    return ID.test(bare) ? bare : null;
  }

  const v = url.searchParams.get('v');
  if (v && ID.test(v)) return v;

  const path = url.pathname.match(PATH_ID);
  return path ? path[1] : null;
}

export function youtubeEmbedUrl(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  // A bare id, which is what someone pastes after copying just the `v=` value.
  if (ID.test(trimmed)) return `https://www.youtube-nocookie.com/embed/${trimmed}`;

  let url: URL;
  try {
    // Protocol-relative and scheme-less links ("youtu.be/xyz") are common in a hand-edited
    // field; assume https rather than rejecting them.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, '')}`);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!hostMatches(url.hostname)) return null;

  const id = idFromUrl(url);
  if (!id) return null;

  const start = startSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'));
  return `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}`;
}
