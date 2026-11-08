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
    const { username, password } = req.body;

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
    const { username, password } = req.body;

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
    const { name, description, status, project_lead_id } = req.body;

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
    const userId = toObjectId(req.body.user_id);

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

app.listen(9000, () => {
  console.log("Server running on port 9000");
});
//