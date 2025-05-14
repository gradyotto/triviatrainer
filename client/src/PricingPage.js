import React from 'react';
import './PricingPage.css';
import { useNavigate } from 'react-router-dom';

const PricingPage = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="pricing-page">
      <div className="pricing-header">
        <button className="back-button" onClick={handleGoBack}>← Back</button>
        <h1>Choose Your Plan</h1>
      </div>
      <div className="pricing-container">
        <div className="pricing-table-wrapper">
          <stripe-pricing-table 
            pricing-table-id="prctbl_1RIkX4HDGUyxIp13LbA4qSGi"
            publishable-key="pk_test_51RGRE9HDGUyxIp13RXeht2z7qdtJhNxFm71TLrQSY48boEA16qxdq1cwSUVEdMkv9xXAkXXKqh3fiBc97d9NsPKk00lrh7Vf8m">
          </stripe-pricing-table>
        </div>
      </div>
    </div>
  );
};

export default PricingPage; 