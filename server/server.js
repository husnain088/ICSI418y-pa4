require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

app.use(express.json());
app.use(cors());

// MongoDB setup
const client = new MongoClient(process.env.MONGO_URI);
let users;
let projects;
let projectMemberships;
let userStories;

const PRIORITIES = ["High", "Medium", "Low"];
const STORY_STATUSES = ["To Do", "In Progress", "Done"];

// "As a [user], I want [goal], so that [benefit]." Deliberately lenient: it only
// checks the three parts are present, not that the wording makes sense.
const STORY_FORMAT = /^as an? .+,?\s+i want .+,?\s+so that .+/is;

// The three statuses a project is allowed to have
const VALID_STATUSES = ["Planning", "Active", "Completed"];

// Values that come from a request are strings, but MongoDB stores _id values
// as ObjectIds. This converts a valid 24-character hex string to an ObjectId
// and returns null for anything else, so a bad id gives a 400 response
// instead of crashing the route.
function toObjectId(value) {
  if (typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value)) {
    return new ObjectId(value);
  }
  return null;
}

async function connectDatabase() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("pa2");
    users = db.collection("users");
    projects = db.collection("projects");
    projectMemberships = db.collection("projectMemberships");
    userStories = db.collection("UserStories");
    // Speeds up "all stories of one project" and the member-removal check.
    await userStories.createIndex({ project_id: 1 });
  } catch (error) {
    console.error("Could not connect to MongoDB");
    console.error(error);
  }
}

connectDatabase();

// Basic test route
app.get("/", (req, res) => {
  res.json({
    message: "Server is running"
  });
});

// Signup route
app.post("/signup", async (req, res) => {
  try {
    const { f_name, l_name, username, password } = req.body ?? {};

    // Check required fields
    if (!username || !password) {
      return res.status(400).json({
        message: "Required information is missing"
      });
    }

    // Check for an existing username
    const existingUser = await users.findOne({ username: username });

    if (existingUser !== null) {
      return res.status(409).json({
        message: "Username already exists"
      });
    }

    // Create the user
    await users.insertOne({
      f_name: typeof f_name === "string" ? f_name.trim() : "",
      l_name: typeof l_name === "string" ? l_name.trim() : "",
      username: username,
      password: password
    });

    return res.status(201).json({
      message: "User created successfully"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    // Check required fields
    if (!username || !password) {
      return res.status(400).json({
        message: "Required information is missing"
      });
    }

    // Search for the username
    const foundUser = await users.findOne({ username: username });

    if (foundUser === null) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    // Compare the password
    if (foundUser.password !== password) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    return res.status(200).json({
      message: "Login successful"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

// ---------------------------------------------------------------------------
// PA3: Users list, Projects, and ProjectMemberships
// ---------------------------------------------------------------------------

// Get the registered users (used for the Project Lead and member dropdowns).
// The password field is left out so it is never sent to the browser.
app.get("/api/users", async (req, res) => {
  try {
    const allUsers = await users
      .find({}, { projection: { password: 0 } })
      .sort({ username: 1 })
      .toArray();

    return res.status(200).json(allUsers);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

// Create a project. The Project Lead is also added as its first member.
app.post("/api/projects", async (req, res) => {
  try {
    const { name, description, status, project_lead_id } = req.body ?? {};

    // Check required fields
    if (
      typeof name !== "string" || name.trim() === "" ||
      typeof description !== "string" || description.trim() === "" ||
      typeof status !== "string" || status === "" ||
      typeof project_lead_id !== "string" || project_lead_id === ""
    ) {
      return res.status(400).json({
        message: "Name, description, status, and Project Lead are all required"
      });
    }

    // Check that the status is one of the allowed values
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Status must be Planning, Active, or Completed"
      });
    }

    // Validate the Project Lead id and convert it to an ObjectId
    const leadId = toObjectId(project_lead_id);

    if (leadId === null) {
      return res.status(400).json({
        message: "Project Lead id is not valid"
      });
    }

    // Verify that the selected Project Lead exists
    const lead = await users.findOne({ _id: leadId });

    if (lead === null) {
      return res.status(404).json({
        message: "Selected Project Lead does not exist"
      });
    }

    // Insert the project
    const project = {
      name: name.trim(),
      description: description.trim(),
      status: status,
      project_lead_id: leadId
    };

    const result = await projects.insertOne(project);
    const projectId = result.insertedId;

    // Use the new project's _id to add the lead as a member.
    // If that fails, remove the project again so we never keep a project
    // without its lead as a member.
    try {
      await projectMemberships.insertOne({
        project_id: projectId,
        user_id: leadId
      });
    } catch (membershipError) {
      await projects.deleteOne({ _id: projectId });
      throw membershipError;
    }

    return res.status(201).json({
      message: "Project created successfully",
      project: { _id: projectId, ...project }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

// Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    const allProjects = await projects.find({}).toArray();
    return res.status(200).json(allProjects);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

// Get the memberships of one project
app.get("/api/projects/:projectId/members", async (req, res) => {
  try {
    const projectId = toObjectId(req.params.projectId);

    if (projectId === null) {
      return res.status(400).json({
        message: "Project id is not valid"
      });
    }

    const project = await projects.findOne({ _id: projectId });

    if (project === null) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    const memberships = await projectMemberships
      .find({ project_id: projectId })
      .toArray();

    return res.status(200).json(memberships);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

// Add a member to a project
app.post("/api/projects/:projectId/members", async (req, res) => {
  try {
    const projectId = toObjectId(req.params.projectId);
    const userId = toObjectId(req.body?.user_id);

    if (projectId === null) {
      return res.status(400).json({
        message: "Project id is not valid"
      });
    }

    if (userId === null) {
      return res.status(400).json({
        message: "Please select a valid user to add"
      });
    }

    // The project and the user must both exist
    const project = await projects.findOne({ _id: projectId });

    if (project === null) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    const user = await users.findOne({ _id: userId });

    if (user === null) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // A user can only be a member of the same project once
    const existingMembership = await projectMemberships.findOne({
      project_id: projectId,
      user_id: userId
    });

    if (existingMembership !== null) {
      return res.status(409).json({
        message: "User is already a member of this project."
      });
    }

    const membership = {
      project_id: projectId,
      user_id: userId
    };

    const result = await projectMemberships.insertOne(membership);

    return res.status(201).json({
      message: "Member added successfully",
      membership: { _id: result.insertedId, ...membership }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

// Remove a member from a project (the Project Lead cannot be removed)
app.delete("/api/projects/:projectId/members/:userId", async (req, res) => {
  try {
    const projectId = toObjectId(req.params.projectId);
    const userId = toObjectId(req.params.userId);

    if (projectId === null || userId === null) {
      return res.status(400).json({
        message: "Project id or user id is not valid"
      });
    }

    const project = await projects.findOne({ _id: projectId });

    if (project === null) {
      return res.status(404).json({
        message: "Project not found"
      });
    }

    // Reject the request if this user is the current Project Lead
    if (project.project_lead_id.equals(userId)) {
      return res.status(400).json({
        message: "The Project Lead cannot be removed from the project."
      });
    }

    // PA4: a member cannot be removed while any story in THIS project is
    // assigned to them. Done stories count, so there is no status filter.
    const assignedStory = await userStories.findOne({
      project_id: projectId,
      assigned_user_id: userId
    });

    if (assignedStory) {
      return res.status(409).json({
        message: "Reassign, unassign, or delete this member's stories before removing them from the project."
      });
    }

    const result = await projectMemberships.deleteOne({
      project_id: projectId,
      user_id: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "That user is not a member of this project"
      });
    }

    return res.status(200).json({
      message: "Member removed successfully"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Server error"
    });
  }
});

// PA4: validate relationships before reading or changing a story.
async function storyProject(req, res, next) {
  try {
    const projectId = toObjectId(req.params.projectId);
    if (!projectId) {
      return res.status(400).json({ message: "Invalid project identifier." });
    }
    if (!await projects.findOne({ _id: projectId })) {
      return res.status(404).json({ message: "Project not found." });
    }
    req.projectId = projectId;
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}

async function validateStory(body, editing) {
  if (!body || typeof body.title !== "string" || !body.title.trim() ||
      typeof body.description !== "string" || !body.description.trim()) {
    return { error: "Title and description are required.", code: 400 };
  }
  if (body.title.trim().length > 100) {
    return { error: "Title must be 100 characters or fewer.", code: 400 };
  }
  if (body.description.trim().length > 1000) {
    return { error: "Description must be 1000 characters or fewer.", code: 400 };
  }
  if (!STORY_FORMAT.test(body.description.trim())) {
    return { error: "Description must use the format: As a [type of user], I want [goal], so that [benefit].", code: 400 };
  }
  if (!PRIORITIES.includes(body.priority)) {
    return { error: "Priority must be High, Medium, or Low.", code: 400 };
  }
  if (editing && !STORY_STATUSES.includes(body.status)) {
    return { error: "Status must be To Do, In Progress, or Done.", code: 400 };
  }
  const assignedId = body.assigned_user_id === null ? null : toObjectId(body.assigned_user_id);
  if (body.assigned_user_id !== null && !assignedId) {
    return { error: "Select a valid assigned member or Unassigned.", code: 400 };
  }
  if (assignedId && !await users.findOne({ _id: assignedId })) {
    return { error: "Assigned user not found.", code: 404 };
  }
  return { values: {
    title: body.title.trim(), description: body.description.trim(),
    priority: body.priority, status: editing ? body.status : "To Do",
    assigned_user_id: assignedId
  } };
}

async function validAssignment(projectId, userId) {
  return userId === null || Boolean(await projectMemberships.findOne({
    project_id: projectId, user_id: userId
  }));
}

app.get("/api/projects/:projectId/stories", storyProject, async (req, res) => {
  try {
    const stories = await userStories.find({ project_id: req.projectId }).toArray();
    res.json(stories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/projects/:projectId/stories", storyProject, async (req, res) => {
  try {
    const checked = await validateStory(req.body, false);
    if (checked.error) return res.status(checked.code).json({ message: checked.error });
    if (!await validAssignment(req.projectId, checked.values.assigned_user_id)) {
      return res.status(400).json({ message: "Assigned user must be a member of this project." });
    }
    // Never insert the request body directly. Status and project come from the server.
    const story = { project_id: req.projectId, ...checked.values };
    const result = await userStories.insertOne(story);
    res.status(201).json({ message: "Story created successfully", story: { ...story, _id: result.insertedId } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/projects/:projectId/stories/:storyId", storyProject, async (req, res) => {
  try {
    const storyId = toObjectId(req.params.storyId);
    if (!storyId) return res.status(400).json({ message: "Invalid story identifier." });
    const query = { _id: storyId, project_id: req.projectId };
    if (!await userStories.findOne(query)) {
      return res.status(404).json({ message: "Story not found in this project." });
    }
    if (req.body && Object.hasOwn(req.body, "project_id") && req.body.project_id !== req.params.projectId) {
      return res.status(400).json({ message: "A story cannot be moved to another project." });
    }
    const checked = await validateStory(req.body, true);
    if (checked.error) return res.status(checked.code).json({ message: checked.error });
    if (!await validAssignment(req.projectId, checked.values.assigned_user_id)) {
      return res.status(400).json({ message: "Assigned user must be a member of this project." });
    }
    const result = await userStories.updateOne(query, { $set: checked.values });
    if (!result.matchedCount) return res.status(404).json({ message: "Story not found in this project." });
    res.json({ message: "Story updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/projects/:projectId/stories/:storyId", storyProject, async (req, res) => {
  try {
    const storyId = toObjectId(req.params.storyId);
    if (!storyId) return res.status(400).json({ message: "Invalid story identifier." });
    const result = await userStories.deleteOne({ _id: storyId, project_id: req.projectId });
    if (!result.deletedCount) return res.status(404).json({ message: "Story not found in this project." });
    res.json({ message: "Story deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Keep malformed JSON errors readable as well.
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must be valid JSON." });
  }
  next(error);
});

app.listen(9000, () => {
  console.log("Server running on port 9000");
});