import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Projects from './pages/Projects'
import Schedule from './pages/Schedule'
import Budgets from './pages/Budgets'
import Subcontractors from './pages/Subcontractors'
import ConstructIQ from './pages/ConstructIQ'
import './App.css'

function Navigation() {
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
    </nav>
  )
}

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <div className="app-body">
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/subcontractors" element={<Subcontractors />} />
              <Route path="/constructiq" element={<ConstructIQ />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}

export default App

