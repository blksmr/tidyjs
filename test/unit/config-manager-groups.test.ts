import { configManager } from '../../src/utils/config';

describe('configManager.getGroups', () => {
  beforeEach(() => {
    // Réinitialiser la configuration avant chaque test
    configManager.loadConfiguration();
  });

  test('trie correctement les groupes avec appModulePattern', () => {
    // Configuration avec pattern @app personnalisé
    configManager['config'] = {
      groups: [
        { name: 'External', order: 1, isDefault: false, match: /^(?!@app).*$/ },
        { name: 'Internal', order: 2, isDefault: true, match: /^@app/ }
      ],
      importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
      format: { onSave: false },
      patterns: {
        appModules: /^@app\/([a-zA-Z0-9_-]+)/
      }
    };

    // Simulation de sous-dossiers @app
    configManager['subfolders'] = new Map([
      ['components', {
        name: '@app/components',
        order: 2,
        isDefault: false,
        match: /^@app\/components/
      }],
      ['utils', {
        name: '@app/utils',
        order: 2,
        isDefault: false,
        match: /^@app\/utils/
      }]
    ]);

    const sortedGroups = configManager.getGroups();

    // Vérifie l'ordre des groupes
    expect(sortedGroups.map(g => g.name)).toEqual([
      'Internal',           // isDefault: true doit être en premier
      '@app/components',    // sous-dossiers @app triés alphabétiquement
      '@app/utils',
      'External'           // groupe non-@app en dernier selon l'order
    ]);
  });

  test('fonctionne correctement sans appModulePattern défini', () => {
    // Configuration sans appModulePattern
    configManager['config'] = {
      groups: [
        { name: 'External', order: 1, isDefault: false, match: /^(?!@app).*$/ },
        { name: 'Internal', order: 2, isDefault: true, match: /^@app/ }
      ],
      importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
      format: { onSave: false },
      patterns: {}
    };

    const sortedGroups = configManager.getGroups();

    // Vérifie que le tri fonctionne toujours sans le pattern
    expect(sortedGroups.map(g => g.name)).toEqual([
      'Internal',  // isDefault: true doit être en premier
      'External'   // suivi par l'ordre normal
    ]);
  });

  test('préserve le tri par ordre pour les groupes non-@app', () => {
    configManager['config'] = {
      groups: [
        { name: 'React', order: 0, isDefault: false, match: /^react/ },
        { name: 'External', order: 1, isDefault: false, match: /^(?!@app).*$/ },
        { name: 'Internal', order: 2, isDefault: true, match: /^@app/ }
      ],
      importOrder: { default: 0, named: 1, typeOnly: 2, sideEffect: 3 },
      format: { onSave: false },
      patterns: {}  // Pas de pattern appModules défini
    };

    // Vider les sous-dossiers pour ce test
    configManager['subfolders'] = new Map();

    const sortedGroups = configManager.getGroups();

    // Vérifie que l'ordre est respecté pour les groupes non-@app
    expect(sortedGroups.map(g => g.name)).toEqual([
      'Internal',  // isDefault: true en premier
      'React',     // puis par ordre croissant
      'External'
    ]);
  });
});