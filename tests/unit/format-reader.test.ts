/**
 * Fix Round 5, 1.3 (ADR-069): one display-formatting layer. The guided path says numbers plainly; expert mode keeps
 * four significant digits with scientific notation; the value is never changed.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { exact, expertNum, num, plainNum, setReader, tex } from '../../src/explain/format';
import { fieldText } from '../../src/ui/components/ParamField';

afterEach(() => setReader('expert'));

describe('1.3 number formatting for the reader', () => {
  it('guided: words below a millionth, plain decimals, words for the very large', () => {
    expect(plainNum(4.69e-7)).toBe('essentially zero');
    expect(plainNum(-3e-9)).toBe('essentially zero');
    expect(plainNum(4.69e-4)).toBe('0.00047');
    expect(plainNum(-0.0012347)).toBe('−0.001235');
    expect(plainNum(1.3616238975098902)).toBe('1.362');
    expect(plainNum(25)).toBe('25');
    expect(plainNum(12345.6)).toBe('12,346');
    expect(plainNum(3.21e6)).toBe('3.21 million');
    expect(plainNum(-4.5e10)).toBe('−45 billion');
    expect(plainNum(2e16)).toBe('more than a thousand trillion');
    expect(plainNum(0)).toBe('0');
    expect(plainNum(Infinity)).toBe('infinitely large');
  });

  it('the reader decides what num and tex show; expertNum and exact ignore it', () => {
    setReader('expert');
    expect(num(4.69e-4)).toBe('4.69×10⁻⁴');
    expect(tex(4.69e-7)).toBe('4.69\\times10^{-7}');
    setReader('guided');
    expect(num(4.69e-4)).toBe('0.00047');
    expect(tex(4.69e-7)).toBe('\\text{essentially zero}');
    expect(tex(-12345)).toBe('-12{,}345');
    expect(expertNum(4.69e-4)).toBe('4.69×10⁻⁴');
    expect(exact(-1.3616238975098902)).toBe('-1.3616238975098902');
  });

  it('a parameter field shows a rounded value that still parses, so applying it unchanged is a no-op', () => {
    expect(fieldText(-1.3616238975098902)).toBe('-1.3616');
    expect(fieldText(0.05)).toBe('0.05');
    expect(fieldText(1e-7)).toBe('1e-7');
    expect(fieldText(50)).toBe('50');
    expect(fieldText('relu')).toBe('relu');
  });
});
