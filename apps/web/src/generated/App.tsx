
import React, { useState } from 'react';
import { calculateResult } from './core/Calculator.kt';
import { performAdvancedMath } from './math/advanced.py';

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [firstNum, setFirstNum] = useState('');
  const [operation, setOperation] = useState('');

  const handleNumber = (num: string) => {
    setDisplay(display === '0' ? num : display + num);
  };

  const handleOperation = async (op: string) => {
    if (operation && firstNum) {
      const result = await calculateResult(parseFloat(firstNum), parseFloat(display), operation);
      setDisplay(result.toString());
    }
    setFirstNum(display);
    setOperation(op);
    setDisplay('0');
  };

  const handleEquals = async () => {
    if (operation === 'sqrt') {
      const result = await performAdvancedMath(parseFloat(display), 'sqrt');
      setDisplay(result.toString());
    } else {
      const result = await calculateResult(parseFloat(firstNum), parseFloat(display), operation);
      setDisplay(result.toString());
    }
    setFirstNum('');
    setOperation('');
  };

  return (
    <div className="calculator">
      <div className="display">{display}</div>
      <div className="keypad">
        {[7,8,9,4,5,6,1,2,3,0].map(num => (
          <button onClick={() => handleNumber(num.toString())}>{num}</button>
        ))}
        <button onClick={() => handleOperation('+')}>+</button>
        <button onClick={() => handleOperation('-')}>-</button>
        <button onClick={() => handleOperation('*')}>×</button>
        <button onClick={() => handleOperation('/')}>÷</button>
        <button onClick={() => handleOperation('sqrt')}>√</button>
        <button onClick={handleEquals}>=</button>
      </div>
    </div>
  