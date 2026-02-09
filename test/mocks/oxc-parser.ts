// TypeScript mock for oxc-parser — ts-jest compiles to CJS,
// so the Node.js `require` is available at runtime.
// We declare it to satisfy TypeScript.

declare const require: (id: string) => any;

// Load the native binding directly
let nativeBinding: any;
try {
    nativeBinding = require('@oxc-parser/binding-darwin-arm64');
} catch {
    try {
        nativeBinding = require('@oxc-parser/binding-darwin-x64');
    } catch {
        try {
            nativeBinding = require('@oxc-parser/binding-darwin-universal');
        } catch {
            // Fallback: try platform-specific
            const platform = process.platform;
            const arch = process.arch;
            nativeBinding = require(`@oxc-parser/binding-${platform}-${arch}`);
        }
    }
}

function jsonParseAst(programJson: string) {
    const { node: program, fixes } = JSON.parse(programJson);
    for (const fixPath of fixes) {
        let node = program;
        for (const key of fixPath) {
            node = node[key];
        }
        if (node.bigint) {
            node.value = BigInt(node.bigint);
        } else {
            try {
                node.value = RegExp(node.regex.pattern, node.regex.flags);
            } catch {
                // Invalid regexp
            }
        }
    }
    return program;
}

function wrap(result: any) {
    let program: any, module_: any, comments: any, errors: any;
    return {
        get program() {
            if (!program) { program = jsonParseAst(result.program); }
            return program;
        },
        get module() {
            if (!module_) { module_ = result.module; }
            return module_;
        },
        get comments() {
            if (!comments) { comments = result.comments; }
            return comments;
        },
        get errors() {
            if (!errors) { errors = result.errors; }
            return errors;
        },
    };
}

export function parseSync(filename: string, sourceText: string, options?: any) {
    return wrap(nativeBinding.parseSync(filename, sourceText, options));
}
