import { useEffect, useState } from "react";
import { request, sendJson, findUsername } from "../Api.js";

const PRIORITIES = ["High", "Medium", "Low"];
const STATUSES = ["To Do", "In Progress", "Done"];
const emptyForm = () => ({ title: "", description: "", priority: "Medium", assigned_user_id: "", status: "To Do" });

function ProjectBacklog() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    request("/api/projects").then(({ ok, data }) => {
      if (ignore) return;
      if (ok) setProjects(data);
      else setError(data.message);
      setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  return (
    <div className="panel">
      <div className="form-heading">
        <h2>Project backlog</h2>
        <p>Create and manage your project’s user stories.</p>
      </div>
      <label className="field">
        <span className="field-label">Project</span>
        <select className="field-input" value={projectId} disabled={loading}
          onChange={(event) => setProjectId(event.target.value)}>
          <option value="">Select a project</option>
          {projects.map((project) => <option key={project._id} value={project._id}>{project.name}</option>)}
        </select>
      </label>
      {loading && <p className="muted">Loading projects...</p>}
      {error && <p className="status error" role="alert">{error}</p>}
      {!loading && !error && projects.length === 0 && <p className="muted">No projects yet. Create one first.</p>}
      {!projectId && projects.length > 0 && <p className="muted">Select a project to view its stories.</p>}
      {/* A new key discards the previous project's form, messages, and saved data. */}
      {projectId && <Backlog key={projectId} projectId={projectId} />}
    </div>
  );
}

function Backlog({ projectId }) {
  const [stories, setStories] = useState([]);
  const [users, setUsers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const base = `/api/projects/${projectId}`;

  useEffect(() => {
    let ignore = false;
    Promise.all([request(`${base}/stories`), request(`${base}/members`), request("/api/users")])
      .then(([storyResult, memberResult, userResult]) => {
        if (ignore) return;
        const failed = [storyResult, memberResult, userResult].find((result) => !result.ok);
        if (failed) {
          setLoadFailed(true);
          setStatus("error");
          setMessage(failed.data.message);
        } else {
          setStories(storyResult.data);
          setMemberships(memberResult.data);
          setUsers(userResult.data);
        }
        setLoading(false);
      });
    return () => { ignore = true; };
  }, [base]);

  async function refresh() {
    const result = await request(`${base}/stories`);
    if (!result.ok) throw new Error(result.data.message);
    setStories(result.data);
  }

  // The write already succeeded, so a failed reload must not look like a failed save.
  async function reloadAfterWrite() {
    try {
      await refresh();
    } catch {
      setStatus("error");
      setMessage("Your change was saved, but the backlog could not be reloaded. Refresh the page.");
    }
  }

  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
    setMessage("");
  }

  function cancel() {
    setEditingId(null);
    setForm(emptyForm());
    setMessage("");
  }

  async function edit(story) {
    setBusy(true);
    setMessage("");
    // Reload current eligibility before opening an edit form.
    const result = await request(`${base}/members`);
    if (result.ok) {
      setMemberships(result.data);
      setEditingId(story._id);
      setForm({ ...story, assigned_user_id: story.assigned_user_id || "" });
    } else {
      setStatus("error");
      setMessage(result.data.message);
    }
    setBusy(false);
  }

  async function save(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setStatus("error");
      setMessage("Title and description are required.");
      return;
    }
    setBusy(true);
    setMessage("");
    const body = {
      title: form.title.trim(), description: form.description.trim(),
      priority: form.priority, assigned_user_id: form.assigned_user_id || null
    };
    if (editingId) body.status = form.status;
    try {
      const result = await sendJson(`${base}/stories${editingId ? `/${editingId}` : ""}`,
        editingId ? "PUT" : "POST", body);
      if (!result.ok) throw new Error(result.data.message);
      setEditingId(null);
      setForm(emptyForm());
      setStatus("success");
      setMessage(result.data.message);
      await reloadAfterWrite();
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(story) {
    if (!window.confirm(`Delete the story "${story.title}"?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await request(`${base}/stories/${story._id}`, { method: "DELETE" });
      if (!result.ok) throw new Error(result.data.message);
      if (editingId === story._id) cancel();
      setStatus("success");
      setMessage(result.data.message);
      await reloadAfterWrite();
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const members = users.filter((user) => memberships.some((membership) => membership.user_id === user._id));

  if (loading) return <p className="muted">Loading stories and members...</p>;

  if (loadFailed) return <p className="status error" role="alert">{message}</p>;

  return (
    <>
      <h3>{editingId ? "Edit story" : "Create story"}</h3>
      <form onSubmit={save}>
        <fieldset className="story-fields" disabled={busy}>
          <label className="field">
            <span className="field-label">Title</span>
            <input className="field-input" name="title" value={form.title} maxLength={100} onChange={change} required />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <textarea className="field-input" name="description" rows={4} value={form.description} maxLength={1000}
              placeholder="As a [type of user], I want [goal], so that [benefit]." onChange={change} required />
          </label>
          <label className="field">
            <span className="field-label">Priority</span>
            <select className="field-input" name="priority" value={form.priority} onChange={change} required>
              {PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
            </select>
          </label>
          {editingId && <label className="field">
            <span className="field-label">Story status</span>
            <select className="field-input" name="status" value={form.status} onChange={change}>
              {STATUSES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>}
          <label className="field">
            <span className="field-label">Assigned member</span>
            <select className="field-input" name="assigned_user_id" value={form.assigned_user_id} onChange={change}>
              <option value="">Unassigned</option>
              {members.map((user) => <option key={user._id} value={user._id}>{user.username}</option>)}
            </select>
          </label>
          <button className="submit" type="submit">{busy ? "Saving..." : editingId ? "Save story" : "Create story"}</button>
          {editingId && <button type="button" className="story-cancel" onClick={cancel}>Cancel</button>}
        </fieldset>
      </form>
      {message && <p className={`status ${status}`} role="status">{message}</p>}
      <div className="memberships">
        <h3>Stories</h3>
        {stories.length === 0 && <p className="muted">This project has no stories yet.</p>}
        {stories.map((story) => <article className="project-item" key={story._id}>
          <h3>{story.title}</h3>
          <p className="muted">Priority: {story.priority} · Status: {story.status}</p>
          <p className="muted">Assigned member: {story.assigned_user_id ? findUsername(users, story.assigned_user_id) : "Unassigned"}</p>
          <p className="description">{story.description}</p>
          <div className="story-actions">
            <button type="button" disabled={busy} onClick={() => edit(story)}>Edit</button>
            <button type="button" disabled={busy} onClick={() => remove(story)}>Delete</button>
          </div>
        </article>)}
      </div>
    </>
  );
}

export default ProjectBacklog;