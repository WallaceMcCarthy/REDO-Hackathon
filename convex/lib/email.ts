/** One spelling per mailbox: account ids are compared exactly, so case and stray spaces would split accounts. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const isValidEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
