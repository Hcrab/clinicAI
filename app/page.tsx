

"use client";


import Link from "next/link";

export default function Home() {
  return (
    <div className="container">
      <div className="header">
        <h1>Welcome to ClinicAI!</h1>
        <p className="subheading">Your one‑stop healthcare assistant.</p>
      </div>

      <div className="feature-blocks">
        <div className="feature-card">
          <h2 className="feature-title">Chatbot</h2>
          <p className="feature-description">
            Interact with ClinicAI&apos;s chatbot to get healthcare assistance and guidance.
          </p>
          <Link href="/chatbot" className="button">
            Go to Chatbot
          </Link>
        </div>

        <div className="feature-card">
          <h2 className="feature-title">World Map</h2>
          <p className="feature-description">
          he map and discover nearby medical facilities.
          </p>
          <Link href="/map" className="button">
            Go to Map
          </Link>
        </div>
      </div>

      {/* Inline styles kept for simplicity; feel free to move into CSS Module. */}
      <style jsx>{`
        .container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
          background: #f0f8ff;
          font-family: Arial, sans-serif;
        }

        .header {
          text-align: center;
          margin-bottom: 40px;
        }
        .header h1 {
          font-size: 2.5rem;
          color: #479eb4;
        }
        .subheading {
          font-size: 1.2rem;
          color: #6fc3f7;
        }

        .feature-blocks {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          justify-content: center;
        }

        .feature-card {
          background: #fff;
          border-radius: 10px;
          padding: 20px;
          width: 300px;
          text-align: center;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-10px);
        }

        .feature-title {
          font-size: 1.5rem;
          color: #479eb4;
          margin-bottom: 10px;
        }
        .feature-description {
          font-size: 1rem;
          color: #6c757d;
          margin-bottom: 20px;
        }

        .button {
          display: inline-block;
          padding: 12px 20px;
          background: #6fc3f7;
          color: #fff;
          border-radius: 5px;
          text-decoration: none;
          transition: background 0.3s ease;
        }
        .button:hover {
          background: #479eb4;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .header h1 {
            font-size: 2rem;
          }
          .feature-card {
            width: 100%;
          }
          .feature-title {
            font-size: 1.3rem;
          }
        }
      `}</style>
    </div>
  );
}
