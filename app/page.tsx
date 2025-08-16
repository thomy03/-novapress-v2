"use client";

import { useState, useEffect } from 'react';

export default function Home() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [hoveredMarket, setHoveredMarket] = useState<number | null>(null);
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ShareButton = ({ url, platform }: { url: string; platform: string }) => (
    <button
      style={{
        padding: '6px 12px',
        backgroundColor: platform === 'twitter' ? '#1DA1F2' : platform === 'facebook' ? '#4267B2' : '#0077b5',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textTransform: 'uppercase'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {platform}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>

      {/* Header Bar with Weather Widget */}
      <div style={{ background: 'linear-gradient(90deg, #000000, #1a1a1a, #000000)', color: 'white', padding: '8px 0', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>PARIS</span>
            <span>{currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>CAC 40: 7,543 <span style={{ color: '#4ade80' }}>▲1.24%</span></span>
            {/* Weather Widget */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '20px' }}>
              <span>☀️</span>
              <span>22°C</span>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>Paris</span>
            </div>
          </div>
          <button 
            style={{ 
              background: 'linear-gradient(90deg, #dc2626, #b91c1c)', 
              padding: '6px 20px', 
              borderRadius: '25px', 
              border: 'none', 
              color: 'white', 
              fontWeight: 'bold', 
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 38, 38, 0.3)';
            }}
          >
            S'ABONNER
          </button>
        </div>
      </div>

      {/* Main Header */}
      <header style={{ borderBottom: '3px solid #000000', backgroundColor: 'white', padding: '20px 0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '900', letterSpacing: '-1px', cursor: 'pointer', transition: 'transform 0.3s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            <span style={{ color: '#000000' }}>NOVA</span>
            <span style={{ color: '#dc2626' }}>PRESS</span>
            <span style={{ color: '#4f46e5', fontSize: '24px', fontWeight: '600', marginLeft: '8px' }}>AI</span>
          </h1>
          <nav style={{ display: 'flex', gap: '30px' }}>
            {['ACCUEIL', 'MONDE', 'TECH', 'ÉCONOMIE', 'POLITIQUE', 'CULTURE'].map(item => (
              <a 
                key={item} 
                href="#" 
                style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: '#000', 
                  textDecoration: 'none',
                  padding: '8px 16px',
                  borderRadius: '25px',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {item}
              </a>
            ))}
            <a 
              href="#" 
              style={{ 
                fontSize: '14px', 
                fontWeight: 'bold', 
                color: '#dc2626', 
                textDecoration: 'none', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '25px',
                border: '2px solid #dc2626',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#dc2626';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ 
                width: '8px', 
                height: '8px', 
                backgroundColor: '#dc2626', 
                borderRadius: '50%', 
                display: 'inline-block',
                animation: 'pulse 2s infinite'
              }}></span>
              EN DIRECT
            </a>
          </nav>
        </div>
      </header>

      {/* Breaking News Ticker */}
      <div style={{ 
        backgroundColor: '#dc2626', 
        color: 'white', 
        overflow: 'hidden', 
        position: 'relative',
        height: '45px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{ 
          display: 'flex', 
          paddingLeft: '100%',
          whiteSpace: 'nowrap',
          animation: 'scroll 50s linear infinite',
          fontSize: '15px',
          fontWeight: '500',
          alignItems: 'center',
          gap: '50px',
          lineHeight: '45px'
        }}>
          <span style={{ fontWeight: 'bold', paddingRight: '20px' }}>🔴 DERNIÈRE MINUTE</span>
          <span>OpenAI annonce GPT-5 avec des capacités révolutionnaires</span>
          <span>•</span>
          <span>La BCE relève ses taux d'intérêt de 0.25 point</span>
          <span>•</span>
          <span>Tesla dépasse les attentes avec un bénéfice record au Q4</span>
          <span>•</span>
          <span>Accord historique sur le climat signé à la COP29</span>
          <span>•</span>
          <span>Apple dévoile son nouveau casque Vision Pro 2</span>
          <span>•</span>
          <span>La France remporte la coupe du monde de rugby 2025</span>
          <span>•</span>
          <span>Bitcoin atteint un nouveau record historique à 50,000€</span>
          <span>•</span>
          <span style={{ fontWeight: 'bold', paddingRight: '20px' }}>🔴 DERNIÈRE MINUTE</span>
          <span>OpenAI annonce GPT-5 avec des capacités révolutionnaires</span>
          <span>•</span>
          <span>La BCE relève ses taux d'intérêt de 0.25 point</span>
          <span>•</span>
          <span>Tesla dépasse les attentes avec un bénéfice record au Q4</span>
        </div>
      </div>
      

      {/* Main Content */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '30px 20px' }}>
        {/* Hero Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginBottom: '40px' }}>
          {/* Main Story */}
          <article 
            style={{ 
              position: 'relative', 
              cursor: 'pointer',
              transition: 'transform 0.3s ease',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
            }}
          >
            <div style={{ 
              height: '500px', 
              backgroundImage: 'url(https://picsum.photos/800/500?random=1)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div className="shimmer" style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0,
                background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.8), rgba(49, 46, 129, 0.8), rgba(88, 28, 135, 0.8))'
              }} />
              <div style={{ 
                position: 'absolute', 
                bottom: '0', 
                left: '0', 
                right: '0', 
                padding: '30px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6), transparent)',
                zIndex: 2
              }}>
                <span style={{ 
                  display: 'inline-block',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  marginBottom: '15px',
                  borderRadius: '20px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  EXCLUSIF
                </span>
                <h2 style={{ 
                  fontSize: '36px', 
                  fontWeight: '900', 
                  color: 'white',
                  lineHeight: '1.2',
                  marginBottom: '15px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }}>
                  L'Intelligence Artificielle Révolutionne le Journalisme Mondial
                </h2>
                <p style={{ color: '#e5e5e5', fontSize: '18px', marginBottom: '20px', lineHeight: '1.5' }}>
                  Les plus grands médias adoptent l'IA générative pour transformer la production de contenu
                </p>
                
                {/* Author and Meta Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img 
                      src="https://picsum.photos/40/40?random=10" 
                      alt="Author avatar"
                      style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '50%', 
                        border: '2px solid white',
                        objectFit: 'cover'
                      }}
                    />
                    <div style={{ fontSize: '14px', color: '#e5e5e5' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Sarah Chen</div>
                      <div style={{ opacity: 0.8 }}>Il y a 15 minutes • 12.5k vues</div>
                    </div>
                  </div>
                  
                  {/* Social Share Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <ShareButton url="#" platform="twitter" />
                    <ShareButton url="#" platform="facebook" />
                    <ShareButton url="#" platform="linkedin" />
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Live Updates */}
            <div style={{ 
              background: 'linear-gradient(135deg, #f9fafb, #f3f4f6)',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <h3 style={{ 
                fontWeight: '900',
                color: '#dc2626',
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ 
                  width: '8px',
                  height: '8px',
                  backgroundColor: '#dc2626',
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }}></span>
                EN DIRECT
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {[
                  { time: '14:32', text: 'Macron annonce 10 milliards pour l\'IA' },
                  { time: '14:15', text: 'Bitcoin franchit les 45,000€' },
                  { time: '13:45', text: 'SpaceX lance 60 satellites' }
                ].map((item, idx) => (
                  <div key={idx} style={{ paddingBottom: '15px', borderBottom: idx < 2 ? '1px solid #e5e7eb' : 'none' }}>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '5px' }}>{item.time}</div>
                    <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Read */}
            <div style={{ 
              backgroundColor: '#000000',
              color: 'white',
              borderRadius: '8px',
              padding: '20px'
            }}>
              <h3 style={{ fontWeight: '900', marginBottom: '15px' }}>LES PLUS LUS</h3>
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  'La révolution de l\'IA dans la santé',
                  'Crise énergétique: l\'Europe s\'organise',
                  'Les secrets du nouveau iPhone 16'
                ].map((title, i) => (
                  <li key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '28px', fontWeight: '900', color: '#dc2626' }}>{i + 1}</span>
                    <a href="#" style={{ fontSize: '14px', color: 'white', textDecoration: 'none', lineHeight: '1.4' }}>{title}</a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* Topic Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '60px' }}>
          {[
            { category: 'TECHNOLOGIE', title: 'Microsoft investit 100 milliards dans le quantique', image: 'https://picsum.photos/400/200?random=2', premium: true, author: 'Alex Martin', readTime: '5 min' },
            { category: 'ÉCONOMIE', title: 'La croissance française dépasse les prévisions', image: 'https://picsum.photos/400/200?random=3', premium: false, author: 'Marie Dubois', readTime: '3 min' },
            { category: 'POLITIQUE', title: 'Réforme des retraites: nouvelle proposition', image: 'https://picsum.photos/400/200?random=4', premium: false, author: 'Jean Moreau', readTime: '4 min' },
            { category: 'INTERNATIONAL', title: 'Accord historique sur le climat', image: 'https://picsum.photos/400/200?random=5', premium: true, author: 'Emma Wilson', readTime: '6 min' }
          ].map((article, idx) => (
            <article 
              key={idx} 
              style={{ 
                cursor: 'pointer',
                borderRadius: '16px',
                overflow: 'hidden',
                backgroundColor: 'white',
                boxShadow: hoveredCard === idx ? '0 25px 50px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.08)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: hoveredCard === idx ? 'translateY(-12px) scale(1.02)' : 'translateY(0) scale(1)',
                border: '1px solid rgba(0,0,0,0.06)'
              }}
              onMouseEnter={() => setHoveredCard(idx)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={{ 
                height: '200px',
                backgroundImage: `url(${article.image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: hoveredCard === idx ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)',
                  transition: 'all 0.3s ease'
                }} />
                
                {article.premium && (
                  <span style={{ 
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    backgroundColor: '#fbbf24',
                    color: '#1f2937',
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    borderRadius: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)'
                  }}>
                    ⭐ PREMIUM
                  </span>
                )}

                {/* Play Button for Video-like Effect */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60px',
                  height: '60px',
                  backgroundColor: 'rgba(220, 38, 38, 0.9)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: hoveredCard === idx ? 1 : 0,
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}>
                  <div style={{
                    width: 0,
                    height: 0,
                    borderLeft: '16px solid white',
                    borderTop: '10px solid transparent',
                    borderBottom: '10px solid transparent',
                    marginLeft: '4px'
                  }} />
                </div>
              </div>
              
              <div style={{ padding: '20px' }}>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: 'bold', 
                  color: '#dc2626',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {article.category}
                </span>
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold', 
                  marginTop: '8px', 
                  marginBottom: '12px',
                  lineHeight: '1.4',
                  color: '#1f2937'
                }}>
                  {article.title}
                </h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img 
                      src={`https://picsum.photos/24/24?random=${idx + 20}`}
                      alt="Author avatar"
                      style={{ 
                        width: '24px', 
                        height: '24px', 
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                      {article.author}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {article.readTime}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <ShareButton url="#" platform="twitter" />
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Trending Tags Section */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#1f2937' }}>TENDANCES</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {['#IA', '#CryptoMonnaies', '#ClimateChange', '#TechStartups', '#Énergie', '#Santé', '#Élections2025', '#SpaceX'].map((tag, idx) => (
              <span 
                key={idx}
                style={{
                  padding: '8px 16px',
                  backgroundColor: idx % 3 === 0 ? '#dc2626' : idx % 3 === 1 ? '#1f2937' : '#059669',
                  color: 'white',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'inline-block'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Markets Section */}
        <div style={{ 
          background: 'linear-gradient(135deg, #000000, #1a1a1a, #2d2d2d, #1a1a1a, #000000)',
          color: 'white',
          borderRadius: '16px',
          padding: '40px',
          marginBottom: '60px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}>
          <h2 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '30px', textAlign: 'center' }}>
            📈 MARCHÉS EN DIRECT
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            {[
              { name: 'CAC 40', value: '7,543.21', change: '+1.24%', positive: true, icon: '🇫🇷' },
              { name: 'DAX', value: '15,842.51', change: '-0.45%', positive: false, icon: '🇩🇪' },
              { name: 'NASDAQ', value: '14,283.91', change: '+2.34%', positive: true, icon: '🇺🇸' },
              { name: 'Bitcoin', value: '€45,231', change: '+5.67%', positive: true, icon: '₿' }
            ].map((market, idx) => (
              <div 
                key={idx} 
                style={{ 
                  backgroundColor: hoveredMarket === idx ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transform: hoveredMarket === idx ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
                  boxShadow: hoveredMarket === idx ? '0 8px 25px rgba(0,0,0,0.3)' : 'none'
                }}
                onMouseEnter={() => setHoveredMarket(idx)}
                onMouseLeave={() => setHoveredMarket(null)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 'bold' }}>{market.name}</div>
                  <span style={{ fontSize: '18px' }}>{market.icon}</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>{market.value}</div>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: 'bold', 
                  color: market.positive ? '#4ade80' : '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>{market.positive ? '▲' : '▼'}</span>
                  {market.change}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter Signup Section */}
        <div style={{ 
          background: 'linear-gradient(135deg, #dc2626, #b91c1c, #991b1b)',
          borderRadius: '20px',
          padding: '50px',
          textAlign: 'center',
          color: 'white',
          marginBottom: '60px',
          boxShadow: '0 15px 40px rgba(220, 38, 38, 0.3)'
        }}>
          <h2 style={{ fontSize: '32px', fontWeight: '900', marginBottom: '16px' }}>
            📧 Restez Informé
          </h2>
          <p style={{ fontSize: '18px', marginBottom: '30px', opacity: 0.9, maxWidth: '600px', margin: '0 auto 30px' }}>
            Recevez les dernières actualités et analyses directement dans votre boîte mail. Plus de 50,000 abonnés nous font confiance.
          </p>
          <div style={{ display: 'flex', maxWidth: '500px', margin: '0 auto', gap: '12px' }}>
            <input 
              type="email" 
              placeholder="Votre adresse email..."
              style={{
                flex: 1,
                padding: '16px 20px',
                borderRadius: '50px',
                border: 'none',
                fontSize: '16px',
                outline: 'none'
              }}
            />
            <button 
              style={{
                backgroundColor: '#1f2937',
                color: 'white',
                padding: '16px 32px',
                borderRadius: '50px',
                border: 'none',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#111827';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1f2937';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              S'ABONNER
            </button>
          </div>
          <p style={{ fontSize: '12px', marginTop: '20px', opacity: 0.7 }}>
            🔒 Vos données sont protégées. Désabonnement en un clic.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ backgroundColor: '#000000', color: 'white', padding: '60px 0 40px', marginTop: '0' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '40px', marginBottom: '40px' }}>
            {/* Company Info */}
            <div>
              <h3 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#dc2626' }}>
                NOVAPRESS
              </h3>
              <p style={{ fontSize: '14px', color: '#9ca3af', lineHeight: '1.6', marginBottom: '20px' }}>
                Le média de référence pour l'actualité tech, économique et politique. Analyse approfondie et expertise reconnue.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['📘', '🐦', '📸', '💼'].map((icon, idx) => (
                  <div 
                    key={idx}
                    style={{
                      width: '40px',
                      height: '40px',
                      backgroundColor: '#1f2937',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#1f2937';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {icon}
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>NAVIGATION</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {['Accueil', 'Actualités', 'Analyses', 'Opinions', 'Dossiers'].map(item => (
                  <li key={item} style={{ marginBottom: '8px' }}>
                    <a 
                      href="#" 
                      style={{ 
                        color: '#9ca3af', 
                        textDecoration: 'none', 
                        fontSize: '14px',
                        transition: 'color 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Categories */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>CATÉGORIES</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {['Technologie', 'Économie', 'Politique', 'International', 'Culture'].map(item => (
                  <li key={item} style={{ marginBottom: '8px' }}>
                    <a 
                      href="#" 
                      style={{ 
                        color: '#9ca3af', 
                        textDecoration: 'none', 
                        fontSize: '14px',
                        transition: 'color 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Services */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>SERVICES</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {['Newsletter', 'Podcasts', 'Événements', 'Formation', 'Consulting'].map(item => (
                  <li key={item} style={{ marginBottom: '8px' }}>
                    <a 
                      href="#" 
                      style={{ 
                        color: '#9ca3af', 
                        textDecoration: 'none', 
                        fontSize: '14px',
                        transition: 'color 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                    >
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>CONTACT</h4>
              <div style={{ fontSize: '14px', color: '#9ca3af', lineHeight: '1.6' }}>
                <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📧</span>
                  <span>contact@novapress.ai</span>
                </div>
                <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📱</span>
                  <span>+33 1 23 45 67 89</span>
                </div>
                <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📍</span>
                  <span>Paris, France</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div style={{ 
            borderTop: '1px solid #374151', 
            paddingTop: '30px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div style={{ fontSize: '14px', color: '#9ca3af' }}>
              © 2025 NovaPress AI. Tous droits réservés. Propulsé par l'intelligence artificielle.
            </div>
            <div style={{ display: 'flex', gap: '20px' }}>
              {['Politique de confidentialité', 'Conditions d\'utilisation', 'Cookies'].map(item => (
                <a 
                  key={item}
                  href="#" 
                  style={{ 
                    color: '#9ca3af', 
                    textDecoration: 'none', 
                    fontSize: '12px',
                    transition: 'color 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}