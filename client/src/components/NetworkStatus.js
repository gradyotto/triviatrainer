import React, { useState, useEffect } from 'react';
import '../App.css';
import { getPendingSyncsCount } from '../utils/syncUtils';
import { getFirestoreReadCount } from '../utils/questionService';
import './NetworkStatus.css';

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [showReadCount, setShowReadCount] = useState(false);
  const [readCount, setReadCount] = useState({ daily: 0, session: 0 });

  useEffect(() => {
    // Handler to update the state whenever network status changes
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine);
    };

    // Add event listeners for online and offline events
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    // Load the last sync time from localStorage
    const storedLastSyncTime = localStorage.getItem('lastSyncTime');
    if (storedLastSyncTime) {
      setLastSyncTime(new Date(parseInt(storedLastSyncTime)));
    }

    // Check for pending syncs on mount and every minute
    const checkPendingSyncs = async () => {
      const count = await getPendingSyncsCount();
      setPendingSyncs(count);
    };

    checkPendingSyncs();
    const interval = setInterval(checkPendingSyncs, 60000); // Check every minute

    // Update read count periodically
    const updateReadCount = () => {
      setReadCount(getFirestoreReadCount());
    };
    
    // Initial update
    updateReadCount();
    
    // Update every 30 seconds
    const intervalId = setInterval(updateReadCount, 30000);

    // Clean up event listeners and interval on component unmount
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
      clearInterval(interval);
      clearInterval(intervalId);
    };
  }, []);

  // Format last sync time as a relative time (e.g., "5 minutes ago")
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const diffMs = now - lastSyncTime;
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className={`network-status-container ${isOnline ? 'online' : 'offline'}`}>
      <div className="network-status">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`} 
             onClick={() => setShowReadCount(!showReadCount)}>
          <span>{isOnline ? '🟢 Online' : '🔴 Offline'}</span>
          {showReadCount && (
            <div className="read-count-popup">
              <p>Firestore Reads Today: {readCount.daily}</p>
              <p>Session Reads: {readCount.session}</p>
            </div>
          )}
        </div>
      </div>
      {pendingSyncs > 0 && (
        <div className="sync-status">
          <span className="sync-icon">↑</span>
          <span className="sync-count">{pendingSyncs}</span>
          <span className="sync-tooltip">
            {pendingSyncs} update{pendingSyncs !== 1 ? 's' : ''} pending sync
            <br />Last sync: {formatLastSync()}
          </span>
        </div>
      )}
    </div>
  );
};

export default NetworkStatus; 