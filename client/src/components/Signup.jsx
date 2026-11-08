import { useState } from "react";

function Signup() {
  const [form, setForm] = useState({
    f_name: "",
    l_name: "",
    username: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setMessage("");
    setStatus("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const cleanedForm = {
      f_name: form.f_name.trim(),
      l_name: form.l_name.trim(),
      username: form.username.trim(),
      password: form.password,
    };

    if (
      !cleanedForm.f_name ||
      !cleanedForm.l_name ||
      !cleanedForm.username ||
      !cleanedForm.password
    ) {
      setStatus("error");
      setMessage("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    setStatus("");

    try {
      const response = await fetch("http://localhost:9000/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cleanedForm),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        setMessage(data.message);
        setForm({
          f_name: "",
          l_name: "",
          username: "",
          password: "",
        });
      } else {
        setStatus("error");
        setMessage(data.message || "Signup failed.");
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
        <h2>Create your account</h2>
        <p>Enter your information to get started.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="name-row">
          <label className="field">
            <span className="field-label">First name</span>
            <input
              className="field-input"
              name="f_name"
              type="text"
              value={form.f_name}
              onChange={handleChange}
              autoComplete="given-name"
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Last name</span>
            <input
              className="field-input"
              name="l_name"
              type="text"
              value={form.l_name}
              onChange={handleChange}
              autoComplete="family-name"
              required
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Username</span>
          <input
            className="field-input"
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="field-input"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            required
          />
        </label>

        <button className="submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
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

export default Signup;
