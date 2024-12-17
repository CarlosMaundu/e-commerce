// src/components/layout/Testimonials.js

import React from 'react';
import '../styles/homePage.css';
import testimonial1 from '../images/testimonial1.jpg'; // Ensure these images exist
import testimonial2 from '../images/testimonial2.jpg';
import testimonial3 from '../images/testimonial3.jpg';

const Testimonials = () => {
  const testimonials = [
    {
      id: 1,
      name: 'Alice Johnson',
      feedback: 'Great products and excellent customer service!',
      avatar: testimonial1,
    },
    {
      id: 2,
      name: 'Mark Smith',
      feedback: 'Fast shipping and the quality exceeded my expectations.',
      avatar: testimonial2,
    },
    {
      id: 3,
      name: 'Jane Smith',
      feedback: 'I would definately recommend them.',
      avatar: testimonial3,
    },
    // Add more testimonials as needed
  ];

  return (
    <section className="testimonials">
      <h2>What Our Customers Say</h2>
      <div className="testimonials-grid">
        {testimonials.map((testimonial) => (
          <div key={testimonial.id} className="testimonial-card">
            <img
              src={testimonial.avatar}
              alt={`${testimonial.name}'s avatar`}
              className="testimonial-avatar"
            />
            <h3>{testimonial.name}</h3>
            <p>"{testimonial.feedback}"</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;
