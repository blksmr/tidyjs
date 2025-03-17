// Imports à formater
import { useState, useEffect } from 'react';
import React from 'react';
import { Button } from 'ds';
import { UserService } from '@app/services';
import {
    b
    thisisNotaLong,
}                   from "module";

// Code à préserver
const MyComponent = () => {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log('Component mounted');
    return () => {
      console.log('Component unmounted');
    };
  }, []);
  
  const handleClick = () => {
    setCount(count + 1);
    UserService.doSomething();
  };
  
  return (
    <div>
      <h1>Count: {count}</h1>
      <Button onClick={handleClick}>Increment</Button>
    </div>
  );
};

export default MyComponent;
