import React from 'react';
import './Header.css';

const Header = ({ user, username, onSignOut, onLogoClick, onProfileClick }) => (
  <header className="header">
    <div className="header-logo" onClick={onLogoClick}>
      TriviaTrainer
    </div>
    <div className="header-user">
      <span>{username || user.email}</span>
      <button onClick={onProfileClick}>Profile</button>
      <button onClick={onSignOut}>Sign Out</button>
    </div>
  </header>
);

export default Header;