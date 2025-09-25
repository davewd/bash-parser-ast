export { BashParser } from './parser';
export * from './ast';
export * from './tokenizer';
export { ParseError } from './errors';

// Default export for convenience
import { BashParser } from './parser';
export default BashParser;

// --- Additional exports can be added here as needed