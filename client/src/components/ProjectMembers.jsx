import { useEffect, useState } from "react";
import { request, sendJson, findUsername } from "../Api.js";

function ProjectMembers() {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [memberships, setMemberships] = useState([]);
  const [userToAdd, setUserToAdd] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(""); // "success" | "error"

  // Load the projects and users once, when this component first appears.
  useEffect(() => {
    Promise.all([request("/api/projects"), request("/api/users")]).then(
      ([projectResult, userResult]) => {
        if (projectResult.ok && userResult.ok) {
          setProjects(projectResult.data);
          setUsers(userResult.data);
        } else {
          setStatus("error");
          setMessage((projectResult.ok ? userResult : projectResult).data.message);
        }
      }
    );
  }, []);

  // Load the memberships whenever a different project is selected, and again
  // whenever reloadCount changes (after a member is added or removed).
  useEffect(() => {
    if (selectedProjectId === "") {
      return;
    }

    // If the user switches projects before this request finishes, the old
    // answer is ignored so it cannot overwrite the newer one.
    let ignore = false;

    request(`/api/projects/${selectedProjectId}/members`).then(
      ({ ok, data }) => {
        if (ignore) {
          return;
        }
        if (ok) {
          setMemberships(data);
        } else {
          setMemberships([]);
          setStatus("error");
          setMessage(data.message);
        }
      }
    );

    return () => {
      ignore = true;
    };
  }, [selectedProjectId, reloadCount]);

  const selectedProject = projects.find((p) => p._id === selectedProjectId);

  function handleSelectProject(event) {
    setSelectedProjectId(event.target.value);
    setMemberships([]);
    setUserToAdd("");
    setMessage("");
  }

  async function handleAdd(event) {
    event.preventDefault();

    const { ok, data } = await sendJson(
      `/api/projects/${selectedProjectId}/members`,
      "POST",
      { user_id: userToAdd }
    );

    setStatus(ok ? "success" : "error");
    setMessage(data.message);

    if (ok) {
      setUserToAdd("");
      setReloadCount(reloadCount + 1); // fetch the updated member list
    }
  }

  async function handleRemove(userId) {
    const { ok, data } = await request(
      `/api/projects/${selectedProjectId}/members/${userId}`,
      { method: "DELETE" }
    );

    setStatus(ok ? "success" : "error");
    setMessage(data.message);

    if (ok) {
      setReloadCount(reloadCount + 1); // fetch the updated member list
    }
  }

  return (
    <div>
      <label className="field">
        <span className="field-label">Project</span>
        <select
          className="field-input"
          value={selectedProjectId}
          onChange={handleSelectProject}
        >
          <option value="">Select a project</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      {projects.length === 0 && (
        <p className="empty">No projects yet. Create one first.</p>
      )}

      {selectedProject && (
        <>
          <h2 className="section-title">
            Members of {selectedProject.name}
          </h2>

          <ul className="member-list">
            {memberships.map((membership) => {
              const isLead = membership.user_id === selectedProject.project_lead_id;

              return (
                <li key={membership._id} className="member">
                  <span className="member-name">
                    {findUsername(users, membership.user_id)}
                  </span>
                  {isLead ? (
                    <span className="badge badge-lead">Project Lead</span>
                  ) : (
                    <button
                      type="button"
                      className="remove"
                      onClick={() => handleRemove(membership.user_id)}
                    >
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <form className="add-member" onSubmit={handleAdd}>
            <label className="field">
              <span className="field-label">Add a registered user</span>
              <select
                className="field-input"
                value={userToAdd}
                onChange={(event) => setUserToAdd(event.target.value)}
              >
                <option value="">Select a user</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </label>

            <button className="submit" type="submit">
              Add to project
            </button>
          </form>
        </>
      )}

      {message && <p className={`status ${status}`}>{message}</p>}
    </div>
  );
}

export default ProjectMembers;