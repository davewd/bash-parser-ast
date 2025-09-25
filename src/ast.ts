export interface Position {
    start: number;
    end: number;
    line: number;
    column: number;
}

export interface ASTNode {
    type: string;
    position?: Position;
}

export interface Program extends ASTNode {
    type: 'program';
    body: Statement[];
}

export interface Statement extends ASTNode { }

export interface Command extends Statement {
    type: 'command';
    name: string;
    args: string[];
    redirections?: Redirection[];
}

export interface Pipeline extends Statement {
    type: 'pipeline';
    commands: Command[];
}

export interface Conditional extends Statement {
    type: 'conditional';
    condition: Expression;
    then: Statement[];
    else?: Statement[];
}

export interface Loop extends Statement {
    type: 'loop';
    kind: 'for' | 'while' | 'until';
    condition?: Expression;
    variable?: string;
    iterable?: Expression;
    body: Statement[];
}

export interface FunctionDeclaration extends Statement {
    type: 'function';
    name: string;
    body: Statement[];
}

export interface VariableAssignment extends Statement {
    type: 'assignment';
    name: string;
    value: Expression;
    export?: boolean;
}

export interface Expression extends ASTNode { }

export interface Literal extends Expression {
    type: 'literal';
    value: string;
    quoted?: boolean;
}

export interface Variable extends Expression {
    type: 'variable';
    name: string;
}

export interface CommandSubstitution extends Expression {
    type: 'command_substitution';
    command: Statement;
}

export interface Redirection extends ASTNode {
    type: 'redirection';
    operator: '>' | '>>' | '<' | '<<' | '2>' | '2>>' | '&>' | '|';
    target: string;
}

export interface Comment extends ASTNode {
    type: 'comment';
    text: string;
}

// --- Additional AST node types can be added here as needed