import { useEffect, useState } from "react";
import { request, findUsername } from "../Api.js";

function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch the projects and the users together. The users are needed so the
  // Project Lead can be shown by name instead of by database id.
  useEffect(() => {
    Promise.all([request("/api/projects"), request("/api/users")]).then(
      ([projectResult, userResult]) => {
        if (!projectResult.ok) {
          setError(projectResult.data.message);
        } else if (!userResult.ok) {
          setError(userResult.data.message);
        } else {
          setProjects(projectResult.data);
          setUsers(userResult.data);
        }
        setLoading(false);
      }
    );
  }, []);

  if (loading) {
    return <p className="empty">Loading projects...</p>;
  }

  if (error) {
    return <p className="status error">{error}</p>;
  }

  if (projects.length === 0) {
    return <p className="empty">No projects yet. Create one first.</p>;
  }

  return (
    <ul className="project-list">
      {projects.map((project) => (
        <li key={project._id} className="project">
          <div className="project-top">
            <h2 className="project-name">{project.name}</h2>
            <span className={`badge badge-${project.status.toLowerCase()}`}>
              {project.status}
            </span>
          </div>
          <p className="project-description">{project.description}</p>
          <p className="project-lead">
            Project Lead:{" "}
            <strong>{findUsername(users, project.project_lead_id)}</strong>
          </p>
        </li>
      ))}
    </ul>
  );
}

export default ProjectList;