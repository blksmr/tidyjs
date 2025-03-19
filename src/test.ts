import { ImportParser } from 'tidyimport-parser';

const parser = new ImportParser({
  defaultGroupName: 'Misc',
  typeOrder: {
    sideEffect: 0,
    default: 1,
    named: 2,
    typeDefault: 3,
    typeNamed: 4
  },
  TypeOrder: {
    default: 0,
    named: 1,
    typeDefault: 2,
    typeNamed: 3,
    sideEffect: 4
  },
  patterns: {
    appSubfolderPattern: /@app\/([^/]+)/
  },
  importGroups: [
    {
      name: 'Misc',
      regex: /^(react|lodash|date-fns)$/,
      order: 0,
      isDefault: true
    },
    {
      name: 'DS',
      regex: /^ds$/,
      order: 1
    },
    {
      name: '@app',
      regex: /^@app/,
      order: 2
    }
  ]
});

const parsed = JSON.stringify(parser.parse('import { a, b } from "module";'), null, 2);

console.log(parsed);
