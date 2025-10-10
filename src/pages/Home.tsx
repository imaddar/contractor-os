function Home() {
  return (
    <div className="page">
      <h1>Welcome to ContractorOS</h1>
      
      <div className="welcome-card">
        <h2>Your Construction Management Hub</h2>
        <p>
          Streamline your construction business with our comprehensive management platform. 
          Track projects, manage schedules, monitor budgets, and coordinate with subcontractors 
          all in one place.
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>5</h3>
          <p>Active Projects</p>
        </div>
        <div className="stat-card">
          <h3>12</h3>
          <p>Upcoming Tasks</p>
        </div>
        <div className="stat-card">
          <h3>$125K</h3>
          <p>Total Budget</p>
        </div>
        <div className="stat-card">
          <h3>8</h3>
          <p>Subcontractors</p>
        </div>
      </div>
    </div>
  )
}

export default Home
