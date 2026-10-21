import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BuildInfo } from './build-info.js';

function packageJson(content: unknown): URL {
  const file = join(mkdtempSync(join(tmpdir(), 'conversa-build-info-')), 'package.json');
  writeFileSync(file, JSON.stringify(content));
  return pathToFileURL(file);
}

describe('BuildInfo', () => {
  it('reads the version from the package.json beside the build', () => {
    const info = BuildInfo.load(packageJson({ name: '@conversa/api', version: '1.2.3' }), {});
    expect(info.version).toBe('1.2.3');
    expect(info.commit).toBeNull();
    expect(info.label).toBe('1.2.3');
  });

  it('reads the real package.json by default', async () => {
    const { default: pkg } = await import('../../package.json', { with: { type: 'json' } });
    expect(BuildInfo.load(undefined, {}).version).toBe(pkg.version);
  });

  it('shortens the commit from CONVERSA_COMMIT', () => {
    const info = BuildInfo.load(packageJson({ version: '1.2.3' }), {
      CONVERSA_COMMIT: 'ABCDEF1234567890abcdef1234567890abcdef12',
    });
    expect(info.commit).toBe('abcdef1');
    expect(info.label).toBe('1.2.3 (abcdef1)');
  });

  it('ignores a commit that is not a git hash', () => {
    for (const value of ['', '   ', 'main', 'abc', '<script>']) {
      expect(
        BuildInfo.load(packageJson({ version: '1.2.3' }), { CONVERSA_COMMIT: value }).commit,
      ).toBeNull();
    }
  });

  it('fails fast when package.json has no version', () => {
    expect(() => BuildInfo.load(packageJson({ name: 'x' }), {})).toThrow(/No version/);
  });
});
