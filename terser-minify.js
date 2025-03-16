const { minify } = require('terser');
const fs = require('fs');
const path = require('path');

async function minifyFile() {
  try {
    // Lire le fichier d'entrée
    const inputFile = path.join(__dirname, 'dist', 'extension.js');
    const code = fs.readFileSync(inputFile, 'utf8');
    
    // Options de minification Terser ultra-agressives
    const options = {
      compress: {
        arguments: true,
        arrows: true,
        booleans: true,
        booleans_as_integers: true,
        collapse_vars: true,
        comparisons: true,
        computed_props: true,
        conditionals: true,
        dead_code: true,
        directives: true,
        drop_console: false, // Garder les console.log pour le débogage
        drop_debugger: true,
        ecma: 2020,
        evaluate: true,
        expression: true,
        global_defs: {},
        hoist_funs: true,
        hoist_props: true,
        hoist_vars: true,
        if_return: true,
        inline: true,
        join_vars: true,
        keep_classnames: true, // Important pour les extensions VSCode
        keep_fargs: false,
        keep_fnames: true,     // Important pour les extensions VSCode
        keep_infinity: true,
        loops: true,
        module: false,
        negate_iife: true,
        passes: 5,             // Augmenté à 5 passes
        properties: true,
        pure_funcs: [],
        pure_getters: true,
        reduce_vars: true,
        sequences: true,
        side_effects: true,
        switches: true,
        toplevel: true,
        typeofs: false,
        unsafe: true,
        unsafe_arrows: true,
        unsafe_comps: true,
        unsafe_Function: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
      },
      mangle: {
        eval: true,
        keep_classnames: true,
        keep_fnames: true,
        module: false,
        properties: {
          builtins: false,
          debug: false,
          keep_quoted: true,
          reserved: [],
        },
        reserved: [],
        safari10: false,
        toplevel: true,
      },
      format: {
        comments: false,       // Supprimer tous les commentaires
        indent_level: 0,       // Pas d'indentation
        ascii_only: true,      // Utiliser uniquement des caractères ASCII
        beautify: false,       // Ne pas embellir le code
        braces: false,         // Supprimer les accolades quand possible
        semicolons: true,      // Garder les points-virgules
      },
      sourceMap: false,
      toplevel: true,          // Transformations au niveau supérieur
    };
    
    // Minifier le code
    const result = await minify(code, options);
    
    if (result.error) {
      console.error('Erreur de minification:', result.error);
      return;
    }
    
    // Écrire le résultat dans un nouveau fichier
    const outputFile = path.join(__dirname, 'dist', 'extension.min.js');
    fs.writeFileSync(outputFile, result.code);
    
    // Obtenir les tailles des fichiers
    const originalSize = fs.statSync(inputFile).size;
    const minifiedSize = fs.statSync(outputFile).size;
    const reduction = ((originalSize - minifiedSize) / originalSize * 100).toFixed(2);
    
    console.log(`Taille originale: ${(originalSize / 1024 / 1024).toFixed(2)} Mo`);
    console.log(`Taille minifiée: ${(minifiedSize / 1024 / 1024).toFixed(2)} Mo`);
    console.log(`Réduction: ${reduction}%`);
    
    // Remplacer le fichier original par la version minifiée
    fs.renameSync(outputFile, inputFile);
    console.log('Le fichier original a été remplacé par la version minifiée.');
  } catch (err) {
    console.error('Erreur:', err);
  }
}

minifyFile();
