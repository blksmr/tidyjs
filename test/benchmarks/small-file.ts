// Small benchmark file: ~20 imports
import React from 'react';
import { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import axios from 'axios';
import moment from 'moment';
import { Button, TextField } from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import type { User, Post } from './types';
import { api } from './services/api';
import { formatDate, parseJSON } from './utils/helpers';
import { CONSTANTS } from './config/constants';
import Logger from './utils/logger';
import * as validators from './utils/validators';
import './styles/global.css';
import { Component1 } from './components/Component1';
import { Component2 } from './components/Component2';
import { useRouter } from 'next/router';
import { GraphQLClient } from 'graphql-request';
import lodash from 'lodash';
import { z } from 'zod';

// Component code would go here
export default function SmallComponent() {
    const [state, setState] = useState(null);
    
    return <div>Small Component</div>;
}