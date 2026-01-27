import { useState, useEffect } from 'react';
import Dashboard from '../src/components/Dashboard';
import Login from '../src/components/Login';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');

  useEffect(() => {
    // Check if user is already logged in
    const loggedInUser = localStorage.getItem('loggedInUser');
    if (loggedInUser) {
      setUsername(loggedInUser);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (user: string) => {
    setUsername(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setUsername('');
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <Dashboard username={username} onLogout={handleLogout} />;
}
