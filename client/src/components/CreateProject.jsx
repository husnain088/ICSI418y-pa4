import { useEffect, useState } from "react";
import { request, sendJson } from "../Api.js";

const STATUS_OPTIONS = ["Planning", "Active", "Completed"];

function CreateProject() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectStatus, setProjectStatus] = useState("Planning");
  const [leadId, setLeadId] = useState("");
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(""); // "success" | "error"

  // Load the registered users once, when this component first appears.
  useEffect(() => {
    request("/api/users").then(({ ok, data }) => {
      if (ok) {
        setUsers(data);
      } else {
        setStatus("error");
        setMessage(data.message);
      }
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const { ok, data } = await sendJson("/api/projects", "POST", {
      name: name,
      description: description,
      status: projectStatus,
      project_lead_id: leadId
    });

    if (ok) {
      setStatus("success");
      setMessage(data.message);
      setName("");
      setDescription("");
      setProjectStatus("Planning");
      setLeadId("");
    } else {
      setStatus("error");
      setMessage(data.message);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Project name</span>
          <input
            className="field-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Description</span>
          <textarea
            className="field-input"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Status</span>
          <select
            className="field-input"
            value={projectStatus}
            onChange={(event) => setProjectStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Project Lead</span>
          {/* Shows the username, but submits the user's database _id */}
          <select
            className="field-input"
            value={leadId}
            onChange={(event) => setLeadId(event.target.value)}
          >
            <option value="">Select a registered user</option>
            {users.map((user) => (
              <option key={user._id} value={user._id}>
                {user.username}
              </option>
            ))}
          </select>
        </label>

        <button className="submit" type="submit">
          Create project
        </button>
      </form>

      {message && <p className={`status ${status}`}>{message}</p>}
    </div>
  );
}

export default CreateProject;