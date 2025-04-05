import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import './Profile.css';

const bannedWords = [
  'fuck', 'shit', 'damn', 'ass', 'bitch', 'cock', 'cunt', 'dick', 'pussy', 'bastard',
  'nigger', 'fag', 'slut', 'whore', 'prick', 'twat', 'arse', 'jerk', 'crap', 'wank'
];

const Profile = ({ user, onSignOut }) => {
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [activityData, setActivityData] = useState({});
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const joinDate = user.metadata?.creationTime 
    ? new Date(user.metadata.creationTime).toLocaleDateString()
    : 'Unknown';

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUsername(userDoc.data().username || '');
        }

        const attemptsSnapshot = await getDocs(collection(db, `userProgress/${user.uid}/attempts`));
        const attempts = attemptsSnapshot.docs.map(doc => {
          const timestamp = doc.data().timestamp;
          const date = new Date(timestamp);
          return {
            timestamp: date.toISOString().split('T')[0]
          };
        });

        const today = new Date().toISOString().split('T')[0];
        const activity = {};
        attempts.forEach(({ timestamp }) => {
          if (timestamp <= today) {
            activity[timestamp] = (activity[timestamp] || 0) + 1;
          }
        });
        
        console.log('Activity data:', activity);
        setActivityData(activity);
      } catch (e) {
        console.error('Error fetching profile data:', e);
        setError('Failed to load profile data');
      }
    };
    fetchProfileData();
  }, [user.uid]);

  const isUsernameValid = (name) => {
    const lowerName = name.toLowerCase().trim();
    return !bannedWords.some(word => lowerName.includes(word)) && /^[a-zA-Z0-9_-]{3,20}$/.test(lowerName);
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    const trimmedUsername = newUsername.trim();
    if (!trimmedUsername) {
      setError('Username cannot be empty');
      return;
    }
    if (!isUsernameValid(trimmedUsername)) {
      setError('Username must be 3-20 characters (letters, numbers, _, -) and not contain offensive words');
      return;
    }
    try {
      await setDoc(doc(db, 'users', user.uid), { 
        username: trimmedUsername,
        created_at: new Date().toISOString()
      }, { merge: true });
      setUsername(trimmedUsername);
      setNewUsername('');
      setIsEditing(false);
      setError(null);
    } catch (e) {
      console.error('Error updating username:', e);
      setError('Failed to update username');
    }
  };

  const getActivityGraph = () => {
    let maxAttemptsValue = 1;
    if (Object.values(activityData).length > 0) {
      maxAttemptsValue = Math.max(...Object.values(activityData));
    }
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    const daysInMonth = [];
    for (let i = 1; i <= lastOfMonth.getDate(); i++) {
      const date = new Date(year, month, i);
      const isFutureDate = date > currentDate;
      daysInMonth.push({
        date: date,
        dateString: date.toISOString().split('T')[0],
        day: i,
        weekday: date.getDay(),
        isFuture: isFutureDate
      });
    }
    
    const weeks = [];
    let currentWeek = Array(firstOfMonth.getDay()).fill(null);
    
    daysInMonth.forEach(dayInfo => {
      currentWeek.push(dayInfo);
      if (dayInfo.weekday === 6 || dayInfo.day === lastOfMonth.getDate()) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }

    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth);
    const today = new Date().toISOString().split('T')[0];

    const goToPreviousMonth = () => {
      setCurrentMonth(new Date(year, month - 1, 1));
    };

    const goToNextMonth = () => {
      const nextMonth = new Date(year, month + 1, 1);
      if (nextMonth <= new Date()) {
        setCurrentMonth(nextMonth);
      }
    };

    const getIntensity = (count) => {
      if (count === 0) return 0;
      const percentage = count / maxAttemptsValue;
      if (percentage <= 0.25) return 1;
      if (percentage <= 0.5) return 2;
      if (percentage <= 0.75) return 3;
      return 4;
    };

    return (
      <div className="activity-section">
        <h2>Your Activity</h2>
        <div className="month-navigation">
          <button onClick={goToPreviousMonth}>←</button>
          <span>{monthName}</span>
          <button 
            onClick={goToNextMonth} 
            disabled={new Date(year, month + 1, 1) > new Date()}
          >→</button>
        </div>
        <div className="activity-graph">
          <div className="weeks-container">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="week">
                {week.map((dayInfo, dayIndex) => {
                  if (dayInfo === null) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="activity-square empty" />;
                  }
                  const count = dayInfo.isFuture ? 0 : (activityData[dayInfo.dateString] || 0);
                  const intensity = getIntensity(count);
                  const isToday = dayInfo.dateString === today;
                  return (
                    <div
                      key={dayInfo.dateString}
                      className={`activity-square intensity-${intensity} ${isToday ? 'today' : ''} ${dayInfo.isFuture ? 'future' : ''}`}
                      title={dayInfo.isFuture ? `${dayInfo.dateString}: Future date` : `${dayInfo.dateString}: ${count} attempts`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="legend">
          <span>Less</span>
          <div className="legend-square intensity-0" />
          <div className="legend-square intensity-1" />
          <div className="legend-square intensity-2" />
          <div className="legend-square intensity-3" />
          <div className="legend-square intensity-4" />
          <span>More</span>
        </div>
      </div>
    );
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1>User Profile</h1>
        <div className="profile-info">
          <p><strong>Username:</strong> {username || 'Not set'}</p>
          {isEditing ? (
            <form onSubmit={handleUsernameSubmit} className="edit-username-form">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter new username"
                maxLength={20}
              />
              <div className="form-buttons">
                <button type="submit">Save</button>
                <button type="button" onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setIsEditing(true)}>Edit Username</button>
          )}
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Joined:</strong> {joinDate}</p>
          <p><strong>Stats:</strong> Coming soon! (Questions answered, accuracy, etc.)</p>
        </div>
        {error && <p className="error">{error}</p>}
        <button onClick={onSignOut} className="sign-out-button">Sign Out</button>
      </div>
      {getActivityGraph()}
    </div>
  );
};

export default Profile;