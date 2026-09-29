import { passwordStrength } from './passwordStrength';

describe('passwordStrength', () => {
  it.each([
    ['', null],
    ['abc', 'Too short: use at least 8 characters'],
    ['abcdefgh', 'Weak: longer is better'],
    ['abcdefghijkl', 'Fair'],
    ['Abcdefgh1!xy', 'Strong'],
    ['a much longer passphrase', 'Strong'],
  ])('%j reads %j', (password, label) => {
    expect(passwordStrength(password)?.label ?? null).toBe(label);
  });
});
