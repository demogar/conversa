import { summariseUserAgent } from './user-agent';

describe('summariseUserAgent', () => {
  it('tells browsers that borrow each other’s names apart', () => {
    const chrome =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    const edge = `${chrome.replace('Macintosh; Intel Mac OS X 10_15_7', 'Windows NT 10.0; Win64; x64')} Edg/130.0.0.0`;
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    expect(summariseUserAgent(chrome)).toEqual({ browser: 'Chrome', os: 'macOS' });
    expect(summariseUserAgent(edge)).toEqual({ browser: 'Edge', os: 'Windows' });
    expect(summariseUserAgent(iphone)).toEqual({ browser: 'Safari', os: 'iOS' });
    expect(summariseUserAgent(null)).toEqual({ browser: null, os: null });
  });
});
