import { Tokenizer, Token, TokenType } from './tokenizer';
import {
    Program, Statement, Command, Pipeline, Conditional, Loop,
    FunctionDeclaration, VariableAssignment, Expression, Literal,
    Variable, CommandSubstitution, ASTNode, Position
} from './ast';
import { ParseError } from './errors';

export class BashParser {
    private tokens: Token[] = [];
    private position: number = 0;

    parse(input: string): Program {
        try {
            const tokenizer = new Tokenizer(input);
            this.tokens = tokenizer.tokenize();
            this.position = 0;

            const body = this.parseStatements();

            return {
                type: 'program',
                body,
                position: this.getNodePosition()
            };
        } catch (error) {
            if (error instanceof ParseError) {
                throw error;
            }
            throw new ParseError(`Unexpected error: ${error}`, this.currentToken()?.position);
        }
    }

    private parseStatements(): Statement[] {
        const statements: Statement[] = [];

        while (!this.isAtEnd() && !this.check(TokenType.EOF)) {
            // Skip newlines
            if (this.check(TokenType.NEWLINE)) {
                this.advance();
                continue;
            }

            const stmt = this.parseStatement();
            if (stmt) {
                statements.push(stmt);
            } else {
                // If no statement could be parsed, advance to prevent infinite loop
                this.advance();
            }

            // Optional semicolon or newline
            if (this.check(TokenType.SEMICOLON) || this.check(TokenType.NEWLINE)) {
                this.advance();
            }
        }

        return statements;
    }

    private parseStatement(): Statement | null {
        // Skip comments
        if (this.check(TokenType.COMMENT)) {
            this.advance(); // Just consume and ignore comments
            return null;
        }

        // Skip EOF
        if (this.check(TokenType.EOF)) {
            return null;
        }

        if (this.check(TokenType.IF)) {
            return this.parseConditional();
        }

        if (this.check(TokenType.FOR) || this.check(TokenType.WHILE)) {
            return this.parseLoop();
        }

        if (this.check(TokenType.FUNCTION)) {
            return this.parseFunction();
        }

        // Check for variable assignment
        if (this.isVariableAssignment()) {
            return this.parseVariableAssignment();
        }

        // Only parse as command/pipeline if we have a WORD token
        if (this.check(TokenType.WORD)) {
            return this.parsePipeline();
        }

        // If none of the above match, return null to indicate no valid statement
        return null;
    }

    private parseConditional(): Conditional {
        const start = this.currentToken()?.position;

        this.consume(TokenType.IF, "Expected 'if'");
        const condition = this.parseExpression();
        this.consume(TokenType.THEN, "Expected 'then'");

        const thenBody: Statement[] = [];
        while (!this.check(TokenType.ELSE) && !this.check(TokenType.FI) && !this.isAtEnd()) {
            if (this.check(TokenType.NEWLINE)) {
                this.advance();
                continue;
            }
            const stmt = this.parseStatement();
            if (stmt) {
                thenBody.push(stmt);
            } else {
                // If no statement could be parsed, advance to prevent infinite loop
                this.advance();
            }
        }

        let elseBody: Statement[] | undefined;
        if (this.check(TokenType.ELSE)) {
            this.advance();
            elseBody = [];
            while (!this.check(TokenType.FI) && !this.isAtEnd()) {
                if (this.check(TokenType.NEWLINE)) {
                    this.advance();
                    continue;
                }
                const stmt = this.parseStatement();
                if (stmt) {
                    elseBody.push(stmt);
                } else {
                    // If no statement could be parsed, advance to prevent infinite loop
                    this.advance();
                }
            }
        }

        this.consume(TokenType.FI, "Expected 'fi'");

        return {
            type: 'conditional',
            condition,
            then: thenBody,
            else: elseBody,
            position: this.getNodePosition(start)
        };
    }

    private parseLoop(): Loop {
        const start = this.currentToken()?.position;
        const kind = this.advance().value as 'for' | 'while';

        let variable: string | undefined;
        let iterable: Expression | undefined;
        let condition: Expression | undefined;

        if (kind === 'for') {
            variable = this.consume(TokenType.WORD, "Expected variable name").value;
            this.consume(TokenType.WORD, "Expected 'in'"); // TODO: proper 'in' token
            iterable = this.parseExpression();
        } else {
            condition = this.parseExpression();
        }

        this.consume(TokenType.DO, "Expected 'do'");

        const body: Statement[] = [];
        while (!this.check(TokenType.DONE) && !this.isAtEnd()) {
            if (this.check(TokenType.NEWLINE)) {
                this.advance();
                continue;
            }
            const stmt = this.parseStatement();
            if (stmt) {
                body.push(stmt);
            } else {
                // If no statement could be parsed, advance to prevent infinite loop
                this.advance();
            }
        }

        this.consume(TokenType.DONE, "Expected 'done'");

        return {
            type: 'loop',
            kind,
            condition,
            variable,
            iterable,
            body,
            position: this.getNodePosition(start)
        };
    }

    private parseFunction(): FunctionDeclaration {
        const start = this.currentToken()?.position;

        this.consume(TokenType.FUNCTION, "Expected 'function'");
        const name = this.consume(TokenType.WORD, "Expected function name").value;

        this.consume(TokenType.LPAREN, "Expected '('");
        this.consume(TokenType.RPAREN, "Expected ')'");
        this.consume(TokenType.LBRACE, "Expected '{'");

        const body: Statement[] = [];
        while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
            if (this.check(TokenType.NEWLINE)) {
                this.advance();
                continue;
            }
            const stmt = this.parseStatement();
            if (stmt) {
                body.push(stmt);
            } else {
                // If no statement could be parsed, advance to prevent infinite loop
                this.advance();
            }
        }

        this.consume(TokenType.RBRACE, "Expected '}'");

        return {
            type: 'function',
            name,
            body,
            position: this.getNodePosition(start)
        };
    }

    private parseVariableAssignment(): VariableAssignment {
        const start = this.currentToken()?.position;
        const name = this.advance().value;

        this.consume(TokenType.WORD, "Expected '='"); // TODO: proper '=' token
        const value = this.parseExpression();

        return {
            type: 'assignment',
            name,
            value,
            position: this.getNodePosition(start)
        };
    }

    private parsePipeline(): Pipeline {
        const commands: Command[] = [];
        commands.push(this.parseCommand());

        while (this.check(TokenType.PIPE)) {
            this.advance(); // consume |
            commands.push(this.parseCommand());
        }

        if (commands.length === 1) {
            return commands[0] as any; // Return single command
        }

        return {
            type: 'pipeline',
            commands,
            position: this.getNodePosition()
        };
    }

    private parseCommand(): Command {
        const start = this.currentToken()?.position;

        if (!this.check(TokenType.WORD)) {
            throw new ParseError("Expected command name", this.currentToken()?.position);
        }

        const name = this.advance().value;
        const args: string[] = [];

        while (this.check(TokenType.WORD) || this.check(TokenType.QUOTED_STRING)) {
            args.push(this.advance().value);
        }

        return {
            type: 'command',
            name,
            args,
            position: this.getNodePosition(start)
        };
    }

    private parseExpression(): Expression {
        if (this.check(TokenType.WORD) || this.check(TokenType.QUOTED_STRING)) {
            const token = this.advance();
            return {
                type: 'literal',
                value: token.value,
                quoted: token.type === TokenType.QUOTED_STRING,
                position: token.position
            } as Literal;
        }

        if (this.check(TokenType.VARIABLE)) {
            const token = this.advance();
            return {
                type: 'variable',
                name: token.value,
                position: token.position
            } as Variable;
        }

        throw new ParseError("Expected expression", this.currentToken()?.position);
    }

    private isVariableAssignment(): boolean {
        // Look ahead for pattern: WORD = ...
        if (this.check(TokenType.WORD) && this.position + 1 < this.tokens.length) {
            const next = this.tokens[this.position + 1];
            return next.value === '='; // TODO: proper '=' token
        }
        return false;
    }

    private currentToken(): Token | undefined {
        return this.tokens[this.position];
    }

    private check(type: TokenType): boolean {
        const token = this.currentToken();
        return token ? token.type === type : false;
    }

    private advance(): Token {
        if (!this.isAtEnd()) {
            this.position++;
        }
        return this.tokens[this.position - 1];
    }

    private isAtEnd(): boolean {
        return this.position >= this.tokens.length || this.check(TokenType.EOF);
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) {
            return this.advance();
        }

        throw new ParseError(message, this.currentToken()?.position);
    }

    private getNodePosition(start?: Position): Position | undefined {
        if (!start) return undefined;

        const current = this.currentToken()?.position;
        return {
            start: start.start,
            end: current?.end || start.end,
            line: start.line,
            column: start.column
        };
    }
}