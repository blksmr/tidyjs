import React from 'react';                    // utilisé
import { useState, useEffect } from 'react';  // useState utilisé, useEffect non utilisé
import { union } from 'lodash';       // non utilisé
import { UserProfile } from './missing-file'; // module manquant

export function MyComponent() {
  const [count, setCount] = useState(0);
  
  // Use union from lodash
  useEffect(() => {
    const arr1 = [1, 2, 3];
    const arr2 = [3, 4, 5];
    const uniqueArray = union(arr1, arr2);
    console.log('Unique Array:', uniqueArray);
  }, []);
  
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}