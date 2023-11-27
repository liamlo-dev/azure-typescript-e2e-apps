import React, { useState } from 'react';
import './LoginPage.css';

function LoginPage({ handleLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showRegister, setShowRegister] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Username and password cannot be empty');
            return;
        }

        const endpoint = '/data-api/rest/users';
        try {
            const response = await fetch(endpoint);
            const data = await response.json();
            const users = data.value;

            const user = users.find(user => user.username === username);
            if (user && user.password === password) {
                handleLogin(username);
            } else {
                setError('Invalid username or password');
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (!newUsername || !newPassword) {
            setError('Username and password cannot be empty');
            return;
        }

        const endpoint = '/data-api/rest/users';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: newUsername,
                    password: newPassword,
                }),
            });

            if (!response.ok) {
                const message = `An error has occurred: ${response.status}`;
                throw new Error(message);
            }

            const data = await response.json();
            if (data?.value[0]?.id) {
                setSuccess('Registration successful! You can now log in.'); // set the success message after successful registration
            } else {
                setError('Failed to create user');
            }
        } catch (error) {
            if (error.message.includes('409')) {
                setError('Username already exists. Please choose a different one.');
            } else {
                setError('An error occurred during registration. Please try again.');
            }
        }
    };

    const switchForm = (e) => {
        e.preventDefault(); // This will prevent the form from being submitted when the button is clicked
        setShowRegister(!showRegister);
        setError('');
        setSuccess('');
    };

    return (
        <div className="login-page">
            {showRegister ? (
                <>
                    <h1>Register</h1>
                    <form onSubmit={handleRegister} className="login-form">
                        <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="New Username" className="login-input" />
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password" className="login-input" />
                        {error && <div className="error-message">{error}</div>}
                        {success && <div className="success-message">{success}</div>}
                        <button type="submit" className="login-button">Register</button>
                        <button onClick={(event) => switchForm(event)} className="switch-button">Back to Login</button>
                    </form>
                </>
            ) : (
                <>
                    <h1>Login</h1>
                    <form onSubmit={handleSubmit} className="login-form">
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" className="login-input" />
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="login-input" />
                        {error && <div className="error-message">{error}</div>}
                        <button type="submit" className="login-button">Login</button>
                        <button onClick={(event) => switchForm(event)} className="switch-button">Create a new account</button>
                    </form>
                </>
            )}
        </div>
    );
}

export default LoginPage;
