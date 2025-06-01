import { formatImports } from '../../src/formatter';
import { ImportParser } from '../../src/parser';
import { Config } from '../../src/types';

describe('Empty line after imports', () => {
  const config: Config = {
    groups: [
      {
        name: 'React',
        order: 0,
        match: /^react$/
      },
      {
        name: 'Misc',
        order: 1,
        isDefault: true
      }
    ],
    importOrder: {
      sideEffect: 0,
      default: 1,
      named: 2,
      typeOnly: 3
    },
    format: {
      onSave: true
    }
  };

  let parser: ImportParser;

  beforeEach(() => {
    parser = new ImportParser(config);
  });

  test('should have exactly one empty line after imports when code follows immediately', async () => {
    const sourceCode = `import React from 'react';
import { useState } from 'react';
const MyComponent = () => {
  return <div>Hello</div>;
};`;

    const parserResult = parser.parse(sourceCode);
    const formatted = await formatImports(sourceCode, config, parserResult);
    
    expect(formatted.text).toBe(`// React
import React        from 'react';
import { useState } from 'react';

const MyComponent = () => {
  return <div>Hello</div>;
};`);
  });

  test('should maintain exactly one empty line when there is already one', async () => {
    const sourceCode = `import React from 'react';
import { useState } from 'react';

const MyComponent = () => {
  return <div>Hello</div>;
};`;

    const parserResult = parser.parse(sourceCode);
    const formatted = await formatImports(sourceCode, config, parserResult);
    
    expect(formatted.text).toBe(`// React
import React        from 'react';
import { useState } from 'react';

const MyComponent = () => {
  return <div>Hello</div>;
};`);
  });

  test('should reduce multiple empty lines to exactly one', async () => {
    const sourceCode = `import React from 'react';
import { useState } from 'react';



const MyComponent = () => {
  return <div>Hello</div>;
};`;

    const parserResult = parser.parse(sourceCode);
    const formatted = await formatImports(sourceCode, config, parserResult);
    
    expect(formatted.text).toBe(`// React
import React        from 'react';
import { useState } from 'react';

const MyComponent = () => {
  return <div>Hello</div>;
};`);
  });

  test('should handle case with comment after imports', async () => {
    const sourceCode = `import React from 'react';
import { useState } from 'react';
// This is a component
const MyComponent = () => {
  return <div>Hello</div>;
};`;

    const parserResult = parser.parse(sourceCode);
    const formatted = await formatImports(sourceCode, config, parserResult);
    
    expect(formatted.text).toBe(`// React
import React        from 'react';
import { useState } from 'react';

// This is a component
const MyComponent = () => {
  return <div>Hello</div>;
};`);
  });

  test('should handle case with multiline comment after imports', async () => {
    const sourceCode = `import React from 'react';
import { useState } from 'react';
/**
 * This is a component
 */
const MyComponent = () => {
  return <div>Hello</div>;
};`;

    const parserResult = parser.parse(sourceCode);
    const formatted = await formatImports(sourceCode, config, parserResult);
    
    expect(formatted.text).toBe(`// React
import React        from 'react';
import { useState } from 'react';

/**
 * This is a component
 */
const MyComponent = () => {
  return <div>Hello</div>;
};`);
  });

  test('should handle empty file after imports', async () => {
    const sourceCode = `import React from 'react';
import { useState } from 'react';`;

    const parserResult = parser.parse(sourceCode);
    const formatted = await formatImports(sourceCode, config, parserResult);
    
    expect(formatted.text).toBe(`// React
import React        from 'react';
import { useState } from 'react';
`);
  });

  test('should handle file ending with newline after imports', async () => {
    const sourceCode = `import React from 'react';
import { useState } from 'react';
`;

    const parserResult = parser.parse(sourceCode);
    const formatted = await formatImports(sourceCode, config, parserResult);
    
    expect(formatted.text).toBe(`// React
import React        from 'react';
import { useState } from 'react';
`);
  });
});