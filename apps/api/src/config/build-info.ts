import { readFileSync } from 'node:fs';

/** The commit is a git hash; anything else in CONVERSA_COMMIT is ignored. */
const COMMIT = /^[0-9a-f]{7,40}$/i;

/**
 * Which build of Conversa is running: the version from the API's package.json
 * (bumped by release-please) and, when the image was built with one, the short
 * git commit from CONVERSA_COMMIT. Read once at startup.
 */
export class BuildInfo {
  constructor(
    readonly version: string,
    readonly commit: string | null,
  ) {}

  /** "0.1.0 (abc1234)", or just the version, for logs. */
  get label(): string {
    return this.commit ? `${this.version} (${this.commit})` : this.version;
  }

  /**
   * package.json sits two levels above this file both in the source tree
   * (src/config) and in the build (dist/config), including the Docker image.
   */
  static load(
    packageJson: URL = new URL('../../package.json', import.meta.url),
    env: NodeJS.ProcessEnv = process.env,
  ): BuildInfo {
    const { version } = JSON.parse(readFileSync(packageJson, 'utf8')) as { version?: unknown };
    if (typeof version !== 'string' || version === '') {
      throw new Error(`No version in ${packageJson.pathname}`);
    }
    const commit = env.CONVERSA_COMMIT?.trim() ?? '';
    return new BuildInfo(version, COMMIT.test(commit) ? commit.slice(0, 7).toLowerCase() : null);
  }
}
