// src/__tests__/parser.test.ts
import { BashParser } from '../parser';
import { Tokenizer, TokenType } from '../tokenizer';
import { ParseError } from '../errors';

describe('BashParser', () => {
    let parser: BashParser;

    beforeEach(() => {
        parser = new BashParser();
    });

    describe('Simple Commands', () => {
        test('should parse basic command', () => {
            const ast = parser.parse('ls');
            expect(ast.type).toBe('program');
            expect(ast.body).toHaveLength(1);
            expect(ast.body[0].type).toBe('command');
            expect((ast.body[0] as any).name).toBe('ls');
        });

        test('should parse command with arguments', () => {
            const ast = parser.parse('ls -la /home');
            const command = ast.body[0] as any;
            expect(command.type).toBe('command');
            expect(command.name).toBe('ls');
            expect(command.args).toEqual(['-la', '/home']);
        });

        test('should parse quoted arguments', () => {
            const ast = parser.parse('echo "hello world"');
            const command = ast.body[0] as any;
            expect(command.args).toEqual(['hello world']);
        });
    });

    describe('Pipelines', () => {
        test('should parse simple pipeline', () => {
            const ast = parser.parse('ls | grep test');
            const pipeline = ast.body[0] as any;
            expect(pipeline.type).toBe('pipeline');
            expect(pipeline.commands).toHaveLength(2);
            expect(pipeline.commands[0].name).toBe('ls');
            expect(pipeline.commands[1].name).toBe('grep');
        });

        test('should parse complex pipeline', () => {
            const ast = parser.parse('cat file.txt | grep pattern | sort | uniq');
            const pipeline = ast.body[0] as any;
            expect(pipeline.commands).toHaveLength(4);
        });
    });

    describe('Variables', () => {
        test('should parse variable assignment', () => {
            const ast = parser.parse('name=john');
            const assignment = ast.body[0] as any;
            expect(assignment.type).toBe('assignment');
            expect(assignment.name).toBe('name');
            expect(assignment.value.value).toBe('john');
        });

        test('should parse variable usage', () => {
            const ast = parser.parse('echo $name');
            const command = ast.body[0] as any;
            expect(command.name).toBe('echo');
            // Variable parsing would need more implementation
        });
    });

    describe('Control Flow', () => {
        test('should parse if statement', () => {
            const script = `
        if test -f file.txt
        then
          echo "file exists"
        fi
      `;
            const ast = parser.parse(script);
            const conditional = ast.body[0] as any;
            expect(conditional.type).toBe('conditional');
            expect(conditional.then).toHaveLength(1);
        });

        test('should parse for loop', () => {
            const script = `
        for item in list
        do
          echo $item
        done
      `;
            const ast = parser.parse(script);
            const loop = ast.body[0] as any;
            expect(loop.type).toBe('loop');
            expect(loop.kind).toBe('for');
            expect(loop.variable).toBe('item');
        });
    });

    describe('Functions', () => {
        test('should parse function declaration', () => {
            const script = `
        function greet() {
          echo "Hello $1"
        }
      `;
            const ast = parser.parse(script);
            const func = ast.body[0] as any;
            expect(func.type).toBe('function');
            expect(func.name).toBe('greet');
            expect(func.body).toHaveLength(1);
        });
    });

    describe('Error Handling', () => {
        test('should throw ParseError for invalid syntax', () => {
            expect(() => {
                parser.parse('if without fi');
            }).toThrow(ParseError);
        });

        test('should provide position information in errors', () => {
            try {
                parser.parse('invalid ( syntax');
            } catch (error) {
                expect(error).toBeInstanceOf(ParseError);
                expect((error as ParseError).position).toBeDefined();
            }
        });
    });

    describe('Multiple Statements', () => {
        test('should parse multiple statements', () => {
            const ast = parser.parse('echo hello; ls -la');
            expect(ast.body).toHaveLength(2);
            expect(ast.body[0].type).toBe('command');
            expect(ast.body[1].type).toBe('command');
        });

        test('should handle newlines as statement separators', () => {
            const script = `
        echo hello
        ls -la
        pwd
      `;
            const ast = parser.parse(script);
            expect(ast.body).toHaveLength(3);
        });
    });
});

// ---

// src/__tests__/tokenizer.test.ts
describe('Tokenizer', () => {
    test('should tokenize simple command', () => {
        const tokenizer = new Tokenizer('ls -la');
        const tokens = tokenizer.tokenize();

        expect(tokens).toHaveLength(3); // ls, -la, EOF
        expect(tokens[0].type).toBe(TokenType.WORD);
        expect(tokens[0].value).toBe('ls');
        expect(tokens[1].type).toBe(TokenType.WORD);
        expect(tokens[1].value).toBe('-la');
        expect(tokens[2].type).toBe(TokenType.EOF);
    });

    test('should tokenize pipeline', () => {
        const tokenizer = new Tokenizer('ls | grep test');
        const tokens = tokenizer.tokenize();

        expect(tokens[1].type).toBe(TokenType.PIPE);
        expect(tokens[1].value).toBe('|');
    });

    test('should tokenize redirections', () => {
        const tokenizer = new Tokenizer('cat file > output.txt');
        const tokens = tokenizer.tokenize();

        const redirectToken = tokens.find(t => t.type === TokenType.REDIRECT_OUT);
        expect(redirectToken).toBeDefined();
        expect(redirectToken!.value).toBe('>');
    });

    test('should tokenize quoted strings', () => {
        const tokenizer = new Tokenizer('echo "hello world"');
        const tokens = tokenizer.tokenize();

        const quotedToken = tokens.find(t => t.type === TokenType.QUOTED_STRING);
        expect(quotedToken).toBeDefined();
        expect(quotedToken!.value).toBe('hello world');
    });

    test('should tokenize variables', () => {
        const tokenizer = new Tokenizer('echo $HOME');
        const tokens = tokenizer.tokenize();

        const varToken = tokens.find(t => t.type === TokenType.VARIABLE);
        expect(varToken).toBeDefined();
        expect(varToken!.value).toBe('HOME');
    });

    test('should tokenize comments', () => {
        const tokenizer = new Tokenizer('# This is a comment');
        const tokens = tokenizer.tokenize();

        expect(tokens[0].type).toBe(TokenType.COMMENT);
        expect(tokens[0].value).toBe(' This is a comment');
    });

    test('should handle keywords', () => {
        const tokenizer = new Tokenizer('if then else fi');
        const tokens = tokenizer.tokenize();

        expect(tokens[0].type).toBe(TokenType.IF);
        expect(tokens[1].type).toBe(TokenType.THEN);
        expect(tokens[2].type).toBe(TokenType.ELSE);
        expect(tokens[3].type).toBe(TokenType.FI);
    });

    test('should track position information', () => {
        const tokenizer = new Tokenizer('ls\necho hello');
        const tokens = tokenizer.tokenize();

        expect(tokens[0].position.line).toBe(1);
        expect(tokens[2].position.line).toBe(2); // echo token
    });
});

// ---

// src/__tests__/integration.test.ts
describe('Integration Tests', () => {
    let parser: BashParser;

    beforeEach(() => {
        parser = new BashParser();
    });

    test('should parse real-world script', () => {
        const script = `
      #!/bin/bash
      
      # Setup variables
      NAME="deployment"
      VERSION="1.0.0"
      
      # Build the project
      if [ -f "package.json" ]; then
        npm install
        npm run build
      fi
      
      # Deploy function
      function deploy() {
        echo "Deploying $NAME version $VERSION"
        docker build -t $NAME:$VERSION .
        docker push $NAME:$VERSION
      }
      
      # Main execution
      for env in dev staging prod; do
        echo "Processing $env environment"
        deploy $env
      done
      
      echo "Deployment complete!"
    `;

        const ast = parser.parse(script);
        expect(ast.type).toBe('program');
        expect(ast.body.length).toBeGreaterThan(0);
    });
});
// Check that we have various statement types