import React from 'react';
import './Header.css';

const Header = ({ user, username, onSignOut, onLogoClick, onProfileClick, onAdminClick, isAdmin }) => (
  <header className="header">
    <div className="header-logo" onClick={onLogoClick}>
      TriviaTrainer
    </div>
    <div className="header-user">
      <span>{username || user.email}</span>
      <button onClick={onLogoClick}>Home</button>
      <button onClick={onProfileClick}>Profile</button>
      {isAdmin && <button onClick={onAdminClick} className="admin-button">Admin</button>}
      <button onClick={onSignOut}>Sign Out</button>
    </div>
  </header>
);

export default Header;