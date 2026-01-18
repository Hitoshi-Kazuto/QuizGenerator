import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import HeroImage from "../images/landingPage1.png"

const LandingPage = () => {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <nav className="landing-nav">
          <div className="logo">TestifyAI</div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#demo">Demo</a>
            <Link to="/login" className="login-btn">Login</Link>
            <Link to="/register" className="register-btn">Register</Link>
          </div>
        </nav>

        <div className="hero-content">
          <h1>Transform Your Content into Interactive Quizzes</h1>
          <p>Create engaging quizzes from text, PDFs, or websites in seconds. Perfect for teachers, educators, and content creators.</p>
          <div className="cta-buttons">
            <Link to="/register" className="primary-btn">Get Started Free</Link>
            <a href="#demo" className="secondary-btn">Watch Demo</a>
          </div>
        </div>

        <div className="hero-image">
          <img src={HeroImage} alt="TestifyAI Platform" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <h2>Powerful Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Text to Quiz</h3>
            <p>Convert any text content into well-structured quizzes with multiple choice questions.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>PDF Upload</h3>
            <p>Upload PDF documents and automatically generate quizzes from their content.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>Website Scraping</h3>
            <p>Extract content from websites and create quizzes in just a few clicks.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Analytics</h3>
            <p>Track student performance and get insights into quiz results.</p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <h2>How It Works</h2>
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Upload Content</h3>
            <p>Add your text, PDF, or website URL</p>
          </div>
          <div className="step-connector"></div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Generate Quiz</h3>
            <p>Our AI creates questions automatically</p>
          </div>
          <div className="step-connector"></div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Customize</h3>
            <p>Edit questions and settings as needed</p>
          </div>
          <div className="step-connector"></div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Share & Track</h3>
            <p>Share with students and monitor progress</p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="testimonials-section">
        <h2>What Teachers Say</h2>
        <div className="testimonials-container">
          <div className="testimonial-card">
            <div className="testimonial-content">
              <p>"This tool has revolutionized how I create quizzes. It saves me hours of work every week!"</p>
            </div>
            <div className="testimonial-author">
              <div className="author-avatar">👩‍🏫</div>
              <div className="author-info">
                <h4>Sarah Johnson</h4>
                <p>High School Teacher</p>
              </div>
            </div>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-content">
              <p>"The AI-generated questions are surprisingly good. It's like having a teaching assistant!"</p>
            </div>
            <div className="testimonial-author">
              <div className="author-avatar">👨‍🏫</div>
              <div className="author-info">
                <h4>Michael Chen</h4>
                <p>University Professor</p>
              </div>
            </div>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-content">
              <p>"My students love the interactive quizzes. It makes learning more engaging!"</p>
            </div>
            <div className="testimonial-author">
              <div className="author-avatar">👩‍🏫</div>
              <div className="author-info">
                <h4>Emily Rodriguez</h4>
                <p>Middle School Teacher</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="demo-section">
        <h2>See It In Action</h2>
        <div className="demo-container">
          <div className="demo-video">
            <div className="video-placeholder">
              <div className="play-button">▶️</div>
              <p>Watch Demo Video</p>
            </div>
          </div>
          <div className="demo-features">
            <h3>Why Choose TestifyAI?</h3>
            <ul>
              <li>✨ Save hours of manual quiz creation</li>
              <li>🤖 AI-powered question generation</li>
              <li>📱 Mobile-friendly interface</li>
              <li>📊 Detailed analytics and insights</li>
              <li>🔒 Secure and reliable platform</li>
              <li>💡 Easy to use, powerful features</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h2>Ready to Transform Your Teaching?</h2>
        <p>Join thousands of educators who are saving time and creating better quizzes with TestifyAI.</p>
        <Link to="/register" className="primary-btn">Get Started Free</Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <h3>TestifyAI</h3>
            <p>Transform your content into engaging quizzes with AI-powered technology.</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#demo">Demo</a>
              <a href="#testimonials">Testimonials</a>
            </div>
            <div className="footer-column">
              <Link to="/">Documentation</Link>
              <Link to="/">Blog</Link>
              <Link to="/">Support</Link>
              <Link to="/">FAQ</Link>
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <Link to="/">About Us</Link>
              <Link to="/">Contact</Link>
              <Link to="/">Privacy Policy</Link>
              <Link to="/">Terms of Service</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 TestifyAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage; 