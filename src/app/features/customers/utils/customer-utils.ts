export function generateCustomerCode(firstName: string, lastName: string): string {
  const getWords = (str: string) =>
    str
      .trim()
      .toUpperCase()
      .split(/\s+/)
      .filter((w) => w.length > 0);
  
  // Helper to pad or slice. 
  // Note: Original logic used 'X' padding. New requirements mention 'Z' for strange cases.
  // We will use 'Z' for padding in new cases to be safe/consistent with "strange cases".
  const pad = (str: string, len: number, char = 'Z') => str.padEnd(len, char).slice(0, len);

  const fWords = getWords(firstName);
  const lWords = getWords(lastName);

  let nameCode = '';

  if (fWords.length === 1 && lWords.length === 1) {
    // Case 1: 1 word each. Use current logic (3 chars each, padded with X as per original)
    // Original logic: const pad = (str: string) => str.padEnd(3, 'X').slice(0, 3);
    const padOriginal = (str: string) => str.padEnd(3, 'Z').slice(0, 3);
    nameCode = padOriginal(fWords[0]) + padOriginal(lWords[0]);
  } else if (fWords.length === 1 && lWords.length >= 2) {
    // Case 2: 1 first, 2+ last.
    // "se debe agregar las 2 primeras letras de cada palabra" -> First(2) + Last1(2) + Last2(2)
    const f1 = pad(fWords[0], 2);
    const l1 = pad(lWords[0], 2);
    const l2 = pad(lWords[1], 2);
    nameCode = f1 + l1 + l2;
  } else if (fWords.length >= 2 && lWords.length >= 2) {
    // Case 3: 2+ first, 2+ last.
    // First: 1st letter of first 2 words.
    // Last: 2st letters of first 2 words.
    const f1 = fWords[0].charAt(0) || 'Z';
    const f2 = fWords[1].charAt(0) || 'Z';
    const l1 = pad(lWords[0], 2);
    const l2 = pad(lWords[1], 2);
    nameCode = f1 + f2 + l1 + l2;
  } else {
    // Case 4: Strange case (e.g. fWords >= 2 && lWords == 1, or empty inputs)
    // "Agregar 'Z' si algun caso extraño se presenta"
    // We fall back to taking the first available words and padding with Z to ensure 6 chars.
    const f = fWords.length > 0 ? fWords[0] : 'Z';
    const l = lWords.length > 0 ? lWords[0] : 'Z';
    // If we have extra first name words but only 1 last name, maybe we should use them?
    // But to be safe and simple as a fallback:
    nameCode = pad(f, 3, 'Z') + pad(l, 3, 'Z');
  }

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();

  return `${nameCode}${day}${month}${year}`;
}
