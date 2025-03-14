import React from 'react';

function Button({ 
  children, 
  onClick, 
  loading = false, 
  secondary = false, 
  disabled = false,
  className = '',
  ...props 
}) {
  const buttonClass = `btn ${secondary ? 'btn-secondary' : ''} ${loading ? 'btn-loading' : ''} ${disabled ? 'btn-disabled' : ''} ${className}`;
  
  return (
    <button 
      className={buttonClass} 
      onClick={onClick} 
      disabled={disabled || loading}
      {...props}
    >
      {children}
      {loading && <span className="spinner"></span>}
    </button>
  );
}

export default Button;