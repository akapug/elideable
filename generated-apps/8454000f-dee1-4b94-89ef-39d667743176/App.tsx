import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { evaluateExpression } from './api/calculator.py';
import { CalculationHistory } from './core/HistoryManager.kt';
import { formatResult } from './utils/helpers.js';

interface CalculatorState {
  display: string;
  history: string[];
  isNewCalculation: boolean;
}

const Calculator: React.FC = () => {
  const [state, setState] = useState<CalculatorState>({
    display: '0',
    history: [],
    isNewCalculation: true
  });

  const historyManager = new CalculationHistory();

  const handleNumberClick = (num: string) => {
    setState(prev => ({
      ...prev,
      display: prev.isNewCalculation || prev.display === '0' ? num : prev.display + num,
      isNewCalculation: false
    }));
  };

  const handleOperatorClick = (operator: string) => {
    setState(prev => ({
      ...prev,
      display: prev.display + ' ' + operator + ' ',
      isNewCalculation: false
    }));
  };

  const handleEquals = async () => {
    try {
      // Use Python for mathematical evaluation
      const result = await evaluateExpression(state.display);
      const formattedResult = formatResult(result);
      
      // Use Kotlin for history management
      const calculation = `${state.display} = ${formattedResult}`;
      historyManager.addCalculation(calculation);
      
      setState(prev => ({
        ...prev,
        display: formattedResult,
        history: historyManager.getHistory(),
        isNewCalculation: true
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        display: 'Error',
        isNewCalculation: true
      }));
    }
  };

  const handleClear = () => {
    setState({
      display: '0',
      history: state.history,
      isNewCalculation: true
    });
  };

  const handleClearHistory = () => {
    historyManager.clearHistory();
    setState(prev => ({
      ...prev,
      history: []
    }));
  };

  return (
    <div className="calculator">
      <div className="display">
        <div className="current">{state.display}</div>
      </div>
      
      <div className="buttons">
        <button onClick={handleClear} className="operator">C</button>
        <button onClick={() => handleOperatorClick('/')} className="operator">÷</button>
        <button onClick={() => handleOperatorClick('*')} className="operator">×</button>
        <button onClick={() => handleOperatorClick('-')} className="operator">-</button>
        
        <button onClick={() => handleNumberClick('7')}>7</button>
        <button onClick={() => handleNumberClick('8')}>8</button>
        <button onClick={() => handleNumberClick('9')}>9</button>
        <button onClick={() => handleOperatorClick('+')} className="operator">+</button>
        
        <button onClick={() => handleNumberClick('4')}>4</button>
        <button onClick={() => handleNumberClick('5')}>5</button>
        <button onClick={() => handleNumberClick('6')}>6</button>
        <button onClick={handleEquals} className="equals" rowSpan={2}>=</button>
        
        <button onClick={() => handleNumberClick('1')}>1</button>
        <button onClick={() => handleNumberClick('2')}>2</button>
        <button onClick={() => handleNumberClick('3')}>3</button>
        
        <button onClick={() => handleNumberClick('0')} className="zero">0</button>
        <button onClick={() => handleNumberClick('.')}>.</button>
      </div>
      
      <div className="history">
        <div className="history-header">
          <h3>History</h3>
          <button onClick={handleClearHistory} className="clear-history">Clear</button>
        </div>
        <div className="history-list">
          {state.history.map((calc, index) => (
            <div key={index} className="history-item">{calc}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<Calculator />);