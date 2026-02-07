// CJS shim for oxc-parser — Jest cannot handle ESM modules directly.
// Loads the native binding and reproduces the wrap/parseSync logic.

const path = require('path');

// Load the native binding directly
let nativeBinding;
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

function jsonParseAst(programJson) {
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

function wrap(result) {
    let program, module_, comments, errors;
    return {
        get program() {
            if (!program) program = jsonParseAst(result.program);
            return program;
        },
        get module() {
            if (!module_) module_ = result.module;
            return module_;
        },
        get comments() {
            if (!comments) comments = result.comments;
            return comments;
        },
        get errors() {
            if (!errors) errors = result.errors;
            return errors;
        },
    };
}

module.exports = {
    parseSync(filename, sourceText, options) {
        return wrap(nativeBinding.parseSync(filename, sourceText, options));
    },
};
