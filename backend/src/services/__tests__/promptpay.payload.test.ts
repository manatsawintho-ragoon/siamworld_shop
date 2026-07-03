import { generatePromptPayPayload } from '../payment.service';

// Extract the merchant-account-info (root tag 29) contents from an EMVCo payload.
function extractTag29(payload: string): string {
  const i = payload.indexOf('29');
  const len = parseInt(payload.slice(i + 2, i + 4), 10);
  return payload.slice(i + 4, i + 4 + len);
}

describe('generatePromptPayPayload', () => {
  it('starts with the EMVCo header and ends with a 4-char CRC', () => {
    const p = generatePromptPayPayload('0812345678', 100, 'mobile');
    expect(p.startsWith('000201')).toBe(true);
    expect(p).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('encodes a phone number under sub-tag 01 in 0066 format', () => {
    const p = generatePromptPayPayload('0812345678', 100, 'mobile');
    const t29 = extractTag29(p);
    expect(t29).toContain('0016A000000677010111');
    // 01 + len(13) + 0066812345678
    expect(t29).toContain('01130066812345678');
    // must NOT carry a tag-02 proxy
    expect(t29).not.toMatch(/02\d{2}\d/);
  });

  it('encodes a Tax ID under sub-tag 02 as the raw 13 digits', () => {
    const p = generatePromptPayPayload('1102003269441', 100, 'taxid');
    const t29 = extractTag29(p);
    expect(t29).toContain('0016A000000677010111');
    // 02 + len(13) + 1102003269441
    expect(t29).toContain('02131102003269441');
    // must NOT mis-encode the Tax ID under the mobile tag 01
    expect(t29).not.toContain('01131102003269441');
  });

  it('falls back to length detection when type is omitted (13 digits → Tax ID tag 02)', () => {
    const t29 = extractTag29(generatePromptPayPayload('1102003269441', 100));
    expect(t29).toContain('02131102003269441');
  });

  it('falls back to length detection when type is omitted (10 digits → phone tag 01)', () => {
    const t29 = extractTag29(generatePromptPayPayload('0812345678', 100));
    expect(t29).toContain('01130066812345678');
  });

  it('embeds the amount under tag 54', () => {
    const p = generatePromptPayPayload('0812345678', 250.5, 'mobile');
    expect(p).toContain('5406250.50');
  });
});
