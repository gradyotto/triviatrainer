import React from "react";
import "./NeuralBackground.css";

const NeuralBackground = ({ className }) => {
  return (
    <div className={`fixed-background ${className || ''}`}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern 
            id="neural-pattern" 
            width="100" 
            height="100" 
            patternUnits="userSpaceOnUse"
          >
            <circle cx="10" cy="10" r="2" fill="#9b87f5" opacity="0.4" />
            <circle cx="50" cy="30" r="2" fill="#9b87f5" opacity="0.3" />
            <circle cx="90" cy="10" r="2" fill="#9b87f5" opacity="0.5" />
            <circle cx="30" cy="50" r="2" fill="#9b87f5" opacity="0.4" />
            <circle cx="70" cy="70" r="2" fill="#9b87f5" opacity="0.3" />
            <circle cx="90" cy="90" r="2" fill="#9b87f5" opacity="0.5" />
            <line x1="10" y1="10" x2="50" y2="30" stroke="#9b87f5" strokeWidth="0.5" opacity="0.15" />
            <line x1="50" y1="30" x2="90" y2="10" stroke="#9b87f5" strokeWidth="0.5" opacity="0.15" />
            <line x1="30" y1="50" x2="50" y2="30" stroke="#9b87f5" strokeWidth="0.5" opacity="0.15" />
            <line x1="70" y1="70" x2="30" y2="50" stroke="#9b87f5" strokeWidth="0.5" opacity="0.15" />
            <line x1="90" y1="90" x2="70" y2="70" stroke="#9b87f5" strokeWidth="0.5" opacity="0.15" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#neural-pattern)" />
      </svg>
    </div>
  );
};

export default NeuralBackground; 