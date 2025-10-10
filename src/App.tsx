import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import Home from './pages/Home'
import Projects from './pages/Projects'
import Schedule from './pages/Schedule'
import Budgets from './pages/Budgets'
import Subcontractors from './pages/Subcontractors'
import ConstructIQ from './pages/ConstructIQ'
import './App.css'

function ChatInterface({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [messages, setMessages] = useState<Array<{ text: string, sender: 'user' | 'ai' }>>([
    { text: "Hello! I'm your ContractorOS AI assistant. How can I help you today?", sender: 'ai' }
  ])
  const [inputValue, setInputValue] = useState('')

  const handleSend = () => {
    if (inputValue.trim()) {
      setMessages([...messages, { text: inputValue, sender: 'user' }])
      setInputValue('')
      // Simulate AI response
      setTimeout(() => {
        setMessages(prev => [...prev, { text: "I'm processing your request. This is a demo response.", sender: 'ai' }])
      }, 1000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h3>AI Assistant</h3>
        <button onClick={onClose} className="chat-close">×</button>
      </div>
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender}`}>
            <div className="message-content">{message.text}</div>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask me anything about your projects..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  )
}

function Navigation({ onChatToggle }: { onChatToggle: () => void }) {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/projects', label: 'Projects', icon: '📋' },
    { path: '/schedule', label: 'Schedule', icon: '📅' },
    { path: '/budgets', label: 'Budgets', icon: '💰' },
    { path: '/subcontractors', label: 'Subcontractors', icon: '👥' },
    { path: '/constructiq', label: 'ConstructIQ', icon: '🧠' }
  ]

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>ContractorOS</h2>
      </div>
      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.path}>
            <Link 
              to={item.path} 
              className={location.pathname === item.path ? 'active' : ''}
            >
              <span className="icon">{item.icon}</span>
              <span className="label">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <button onClick={onChatToggle} className="chat-toggle">
        <span className="icon">💬</span>
        <span className="label">AI Chat</span>
      </button>
    </nav>
  )
}

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <Router>
      <div className="app">
        <Navigation onChatToggle={() => setIsChatOpen(!isChatOpen)} />
        <div className="app-body">
          <main className={`main-content ${isChatOpen ? 'chat-open' : ''}`}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/subcontractors" element={<Subcontractors />} />
              <Route path="/constructiq" element={<ConstructIQ />} />
            </Routes>
          </main>
          <ChatInterface isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        </div>
      </div>
    </Router>
  )
}

export default App
