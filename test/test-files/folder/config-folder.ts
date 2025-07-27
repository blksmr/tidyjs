// Other
import coreLibrary       from 'core';
import express           from 'express';
import lodash            from 'lodash';
import mongoose          from 'mongoose';
import { localFunction } from './local';
import { helper }        from './utils';
import { coreUtil }      from 'core/utils';
import type { Schema }   from 'mongoose';
import './styles.css';
import '@/components/Button';

// React
import React        from 'react';
import { useState } from 'react';
import type { FC }  from 'react';

// This file uses the config from folder/tidyjs.json
// Expected order after formatting:
// 1. Core Libraries (matches "^core")
// 2. External (matches "^[^@.]")
// 3. Internal (matches "^@/")
// 4. Relative (matches "^\.")
// 5. Others (default)

const app = express();

export function testFolderConfig(): void {
  console.log('Using folder-specific configuration');
}