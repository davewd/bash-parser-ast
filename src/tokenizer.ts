import { Position } from './ast';

export enum TokenType {
    WORD = 'WORD',
    PIPE = 'PIPE',
    REDIRECT_OUT = 'REDIRECT_OUT',
    REDIRECT_IN = 'REDIRECT_IN',
    REDIRECT_APPEND = 'REDIRECT_APPEND',
    SEMICOLON = 'SEMICOLON',
    AMPERSAND = 'AMPERSAND',
    AND = 'AND',
    OR = 'OR',
    LPAREN = 'LPAREN',
    RPAREN = 'RPAREN',
    LBRACE = 'LBRACE',
    RBRACE = 'RBRACE',
    IF = 'IF',
    THEN = 'THEN',
    ELSE = 'ELSE',
    FI = 'FI',
    FOR = 'FOR',
    WHILE = 'WHILE',
    DO = 'DO',
    DONE = 'DONE',
    FUNCTION = 'FUNCTION',
    NEWLINE = 'NEWLINE',
    EOF = 'EOF',
    VARIABLE = 'VARIABLE',
    QUOTED_STRING = 'QUOTED_STRING',
    COMMENT = 'COMMENT'
}

export interface Token {
    type: TokenType;
    value: string;
    position: Position;
}

export class Tokenizer {
    private input: string;
    private position: number = 0;
    private line: number = 1;
    private column: number = 1;

    constructor(input: string) {
        this.input = input;
    }

    tokenize(): Token[] {
        const tokens: Token[] = [];

        while (this.position < this.input.length) {
            const token = this.nextToken();
            if (token) {
                tokens.push(token);
            }
        }

        tokens.push(this.createToken(TokenType.EOF, ''));
        return tokens;
    }

    private nextToken(): Token | null {
        this.skipWhitespace();

        if (this.position >= this.input.length) {
            return null;
        }

        const char = this.current();
        const startPos = this.getPosition();

        // Comments
        if (char === '#') {
            return this.readComment();
        }

        // Newlines
        if (char === '\n') {
            this.advance();
            return this.createToken(TokenType.NEWLINE, '\n', startPos);
        }

        // Operators
        switch (char) {
            case '|':
                this.advance();
                if (this.current() === '|') {
                    this.advance();
                    return this.createToken(TokenType.OR, '||', startPos);
                }
                return this.createToken(TokenType.PIPE, '|', startPos);

            case '&':
                this.advance();
                if (this.current() === '&') {
                    this.advance();
                    return this.createToken(TokenType.AND, '&&', startPos);
                }
                return this.createToken(TokenType.AMPERSAND, '&', startPos);

            case '>':
                this.advance();
                if (this.current() === '>') {
                    this.advance();
                    return this.createToken(TokenType.REDIRECT_APPEND, '>>', startPos);
                }
                return this.createToken(TokenType.REDIRECT_OUT, '>', startPos);

            case '<':
                this.advance();
                return this.createToken(TokenType.REDIRECT_IN, '<', startPos);

            case ';':
                this.advance();
                return this.createToken(TokenType.SEMICOLON, ';', startPos);

            case '(':
                this.advance();
                return this.createToken(TokenType.LPAREN, '(', startPos);

            case ')':
                this.advance();
                return this.createToken(TokenType.RPAREN, ')', startPos);

            case '{':
                this.advance();
                return this.createToken(TokenType.LBRACE, '{', startPos);

            case '}':
                this.advance();
                return this.createToken(TokenType.RBRACE, '}', startPos);
        }

        // Quoted strings
        if (char === '"' || char === "'") {
            return this.readQuotedString(char);
        }

        // Variables
        if (char === '$') {
            return this.readVariable();
        }

        // Words and keywords
        return this.readWord();
    }

    private readComment(): Token {
        const start = this.getPosition();
        let value = '';

        this.advance(); // Skip #

        while (this.position < this.input.length && this.current() !== '\n') {
            value += this.current();
            this.advance();
        }

        return this.createToken(TokenType.COMMENT, value, start);
    }

    private readQuotedString(quote: string): Token {
        const start = this.getPosition();
        let value = '';

        this.advance(); // Skip opening quote

        while (this.position < this.input.length && this.current() !== quote) {
            if (this.current() === '\\') {
                this.advance();
                if (this.position < this.input.length) {
                    value += this.current();
                    this.advance();
                }
            } else {
                value += this.current();
                this.advance();
            }
        }

        if (this.current() === quote) {
            this.advance(); // Skip closing quote
        }

        return this.createToken(TokenType.QUOTED_STRING, value, start);
    }

    private readVariable(): Token {
        const start = this.getPosition();
        let value = '';

        this.advance(); // Skip $

        if (this.current() === '{') {
            this.advance();
            while (this.position < this.input.length && this.current() !== '}') {
                value += this.current();
                this.advance();
            }
            if (this.current() === '}') {
                this.advance();
            }
        } else {
            while (this.position < this.input.length && this.isWordChar(this.current())) {
                value += this.current();
                this.advance();
            }
        }

        return this.createToken(TokenType.VARIABLE, value, start);
    }

    private readWord(): Token {
        const start = this.getPosition();
        let value = '';

        // If current character is not a word character, we have an unknown token
        if (!this.isWordChar(this.current())) {
            // Consume the unknown character to prevent infinite loops
            value = this.current();
            this.advance();
            return this.createToken(TokenType.WORD, value, start);
        }

        while (this.position < this.input.length && this.isWordChar(this.current())) {
            value += this.current();
            this.advance();
        }

        // Check for keywords
        const tokenType = this.getKeywordType(value) || TokenType.WORD;
        return this.createToken(tokenType, value, start);
    }

    private getKeywordType(value: string): TokenType | null {
        const keywords: Record<string, TokenType> = {
            'if': TokenType.IF,
            'then': TokenType.THEN,
            'else': TokenType.ELSE,
            'fi': TokenType.FI,
            'for': TokenType.FOR,
            'while': TokenType.WHILE,
            'do': TokenType.DO,
            'done': TokenType.DONE,
            'function': TokenType.FUNCTION
        };

        return keywords[value] || null;
    }

    private isWordChar(char: string): boolean {
        return /[a-zA-Z0-9_.\/-]/.test(char);
    }

    private skipWhitespace(): void {
        while (this.position < this.input.length && /[ \t]/.test(this.current())) {
            this.advance();
        }
    }

    private current(): string {
        return this.input[this.position] || '';
    }

    private advance(): void {
        if (this.current() === '\n') {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        this.position++;
    }

    private getPosition(): Position {
        return {
            start: this.position,
            end: this.position,
            line: this.line,
            column: this.column
        };
    }

    private createToken(type: TokenType, value: string, start?: Position): Token {
        const pos = start || this.getPosition();
        return {
            type,
            value,
            position: {
                ...pos,
                end: this.position
            }
        };
    }
}

// --- Additional exports can be added here as needed