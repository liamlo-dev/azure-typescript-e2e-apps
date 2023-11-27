import React, { useState } from 'react';
import LoginPage from './LoginPage';
import App from './App';

function Page() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');

    const handleLogin = (user: React.SetStateAction<string>) => {
        setUsername(user);
        setIsAuthenticated(true);
    };

    return (
        isAuthenticated ? <App username={username} /> : <LoginPage handleLogin={handleLogin} />
    );
}

export default Page;