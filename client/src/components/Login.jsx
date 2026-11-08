import { useState } from "react";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanedUsername = username.trim();

    if (!cleanedUsername || !password) {
      setStatus("error");
      setMessage("Please enter your username and password.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setStatus("");

    try {
      const response = await fetch("http://localhost:9000/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanedUsername,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message);
        setUsername("");
        setPassword("");
      } else {
        setStatus("error");
        setMessage(data.message || "Login failed.");
      }
    } catch {
      setStatus("error");
      setMessage("Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="form-heading">
        <h2>Welcome back</h2>
        <p>Log in with your account information.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Username</span>
          <input
            className="field-input"
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setMessage("");
              setStatus("");
            }}
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="field-input"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setMessage("");
              setStatus("");
            }}
            autoComplete="current-password"
            required
          />
        </label>

        <button className="submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Logging in..." : "Log in"}
        </button>
      </form>

      {message && (
        <p className={`status ${status}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}

export default Login;