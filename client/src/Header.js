import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

const Header = ({ user, username, onSignOut, onLogoClick, onProfileClick, onAdminClick, isAdmin }) => {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  return (
    <header className="header">
      <div className="header-logo" onClick={onLogoClick}>
        TriviaTrainer
      </div>
      <div className="header-user">
        {username && <span>{username}</span>}
        <Link to="/" onClick={onLogoClick} className={isActive('/') ? 'active' : ''}>
          Home
        </Link>
        <Link to="/profile" onClick={onProfileClick} className={isActive('/profile') ? 'active' : ''}>
          Profile
        </Link>
        <Link to="/pricing" className={isActive('/pricing') ? 'active' : ''}>
          Pricing
        </Link>
        {isAdmin && (
          <Link 
            to="/admin" 
            className={`admin-button ${isActive('/admin') ? 'active' : ''}`} 
            onClick={onAdminClick}
          >
            Admin
          </Link>
        )}
        <button onClick={onSignOut}>Sign Out</button>
      </div>
    </header>
  );
};

export default Header;