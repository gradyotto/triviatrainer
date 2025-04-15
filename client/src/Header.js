import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = ({ user, username, onSignOut, onLogoClick, onProfileClick, onAdminClick, isAdmin }) => {
  return (
    <header className="header">
      <div className="header-logo" onClick={onLogoClick}>
        TriviaTrainer
      </div>
      <div className="header-user">
        <span>{username || user.email}</span>
        <Link to="/training" onClick={onLogoClick}>Home</Link>
        <Link to="/profile" onClick={onProfileClick}>Profile</Link>
        {isAdmin && <Link to="/admin" className="admin-button" onClick={onAdminClick}>Admin</Link>}
        <button onClick={onSignOut}>Sign Out</button>
      </div>
    </header>
  );
};

export default Header;