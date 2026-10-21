/**
 * The web app's own build: the version from apps/web/package.json and the
 * commit from CONVERSA_COMMIT, both fixed when the app is built (next.config.ts).
 * The API reports its version separately, on GET /instance.
 */
export const WEB_VERSION = process.env.CONVERSA_VERSION ?? '0.0.0';

const commit = process.env.CONVERSA_COMMIT ?? '';
export const WEB_COMMIT = /^[0-9a-f]{7,40}$/i.test(commit)
  ? commit.slice(0, 7).toLowerCase()
  : null;

/** The release notes of a version on GitHub. */
export function releaseUrl(version: string): string {
  return `https://github.com/demogar/conversa/releases/tag/v${version}`;
}
