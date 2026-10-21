import { renderTemplate } from './template.js';

describe('renderTemplate', () => {
  it('replaces {username} with the handle', () => {
    expect(renderTemplate('Hi {username}, here you go', { username: 'ana' })).toBe('Hi @ana, here you go');
  });

  it('drops the placeholder cleanly when the handle is unknown', () => {
    expect(renderTemplate('Hi {username} here you go', {})).toBe('Hi here you go');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(renderTemplate('Use code {code}', { username: 'ana' })).toBe('Use code {code}');
  });
});
