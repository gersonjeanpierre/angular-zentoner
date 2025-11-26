import { generateCustomerCode } from './customer-utils';

describe('generateCustomerCode', () => {
  it('should generate code correctly for standard names', () => {
    const code = generateCustomerCode('Sol Maria', 'Vera Ortiz');
    // Expect SOL + VER + Date
    expect(code.substring(0, 6)).toBe('SOLVER');
    expect(code.length).toBe(14);
  });

  it('should generate code correctly for short names', () => {
    const code = generateCustomerCode('Ty', 'Po');
    // Expect TYX + POX + Date
    expect(code.substring(0, 6)).toBe('TYXPOX');
    expect(code.length).toBe(14);
  });

  it('should use current date', () => {
    const code = generateCustomerCode('Test', 'User');
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const expectedDate = `${day}${month}${year}`;
    expect(code.substring(6)).toBe(expectedDate);
  });
});
