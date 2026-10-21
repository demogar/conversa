import { classifyMailError } from './mail.service.js';

describe('classifyMailError', () => {
  it('sorts nodemailer failures into categories the admin area explains', () => {
    expect(classifyMailError({ code: 'EAUTH', responseCode: 535 })).toBe('auth');
    expect(classifyMailError({ code: 'ECONNECTION' })).toBe('connection');
    expect(classifyMailError({ code: 'ENOTFOUND' })).toBe('connection');
    expect(classifyMailError({ code: 'ETIMEDOUT' })).toBe('timeout');
    expect(classifyMailError({ code: 'ETLS' })).toBe('tls');
    expect(classifyMailError({ code: 'EENVELOPE', responseCode: 550 })).toBe('rejected');
    expect(classifyMailError(new Error('something else'))).toBe('unknown');
    expect(classifyMailError(undefined)).toBe('unknown');
  });
});
