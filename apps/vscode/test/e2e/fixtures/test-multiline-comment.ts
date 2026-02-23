/*
 * This is a multiline comment at the beginning of the file
 * It should be preserved and imports should be placed after it
 * properly formatted
 */
import { useState } from 'react';
import Button from '@app/components/Button';
import React from 'react';
import { FC } from 'react';

const MyComponent: FC = () => {
    const [count, setCount] = useState(0);
    return <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>;
};

export default MyComponent;