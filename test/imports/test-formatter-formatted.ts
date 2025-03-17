// Imports à formater
// Misc
import React                from 'react';
import { useState, useEffect } from 'react';
import { a, b }            from 'module';

// DS
import { Button }          from 'ds';

// @app
import { UserService }     from '@app/services';

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
