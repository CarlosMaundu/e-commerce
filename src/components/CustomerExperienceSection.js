// src/components/CustomerExperienceSection.js

import React from 'react';
import '../styles/customerExperienceSection.css';
import { FaShieldAlt, FaSmile, FaCalendarAlt, FaTruck } from 'react-icons/fa'; // FontAwesome Icons

const CustomerExperienceSection = () => {
  const experiences = [
    {
      icon: <FaShieldAlt size={60} color="#007bff" />,
      title: 'Original Products',
      description:
        'We provide a money-back guarantee if the product is not original.',
    },
    {
      icon: <FaSmile size={60} color="#28a745" />,
      title: 'Satisfaction Guarantee',
      description:
        'Exchange the product you’ve purchased if it doesn’t fit on you.',
    },
    {
      icon: <FaCalendarAlt size={60} color="#ffc107" />,
      title: 'New Arrival Everyday',
      description: 'We update our collections almost every day.',
    },
    {
      icon: <FaTruck size={60} color="#17a2b8" />,
      title: 'Fast & Free Shipping',
      description: 'We offer fast and free shipping for our loyal customers.',
    },
  ];

  return (
    <section className="customer-experience-section">
      <h2>Why Choose Us</h2>
      <div className="experience-grid">
        {experiences.map((exp, index) => (
          <div key={index} className="experience-card">
            <div className="experience-icon">{exp.icon}</div>
            <h3>{exp.title}</h3>
            <p>{exp.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CustomerExperienceSection;
