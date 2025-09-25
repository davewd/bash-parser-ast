import { Position } from './ast';

export class ParseError extends Error {
    public readonly position?: Position;

    constructor(message: string, position?: Position) {
        super(message);
        this.name = 'ParseError';
        this.position = position;
    }

    toString(): string {
        if (this.position) {
            return `${this.name} at line ${this.position.line}, column ${this.position.column}: ${this.message}`;
        }
        return `${this.name}: ${this.message}`;
    }
}