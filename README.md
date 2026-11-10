# ICSI 418Y – Programming Assignment 4: User Stories and Project Backlog

This continues my PA3 application (projects and project members). Each project now has a backlog of user stories. A story belongs to one project, has a priority and a status, and can be assigned to one member of that project or left unassigned. The stack is the same as before: a React frontend (Vite), an Express backend, and MongoDB Atlas.

```
React (localhost:5173)  →  fetch / JSON  →  Express (localhost:9000)  →  MongoDB Atlas (database: pa2)
```

## Features

- **Signup and Login** (from PA2). Signup stores first name, last name, username and password.
- **Create project** with a name, description, status (Planning, Active, Completed) and a Project Lead. The lead is added as the first member automatically.
- **Projects** list showing each project and its lead.
- **Members** tab to add and remove project members. The lead cannot be removed, and the same user cannot be added to a project twice.
- **Backlog** tab (new in PA4):
  - Select a project to see only that project's stories, including `Done` stories. Each story shows its title, priority, status, assigned member (or "Unassigned") and description.
  - Create a story. The server always starts it as `To Do`.
  - Edit a story: title, description, priority, status and assignee. Any status change is allowed, including reopening a `Done` story. Cancel discards the changes.
  - Delete a story after a confirmation dialog.
  - The assignment dropdown lists only members of the selected project.
- **Member removal rule:** a member cannot be removed from a project while any story in that project is assigned to them, including `Done` stories. Stories assigned to them in other projects do not block the removal.

## Technologies

- React 19 with Vite
- Node.js and Express
- MongoDB Atlas with the official `mongodb` driver
- `dotenv` for configuration and `cors` for local development

## Project structure

```
ICSI418y-pa4/
├── .gitignore
├── README.md
├── client/
│   └── src/
│       ├── components/
│       │   ├── Signup.jsx
│       │   ├── Login.jsx
│       │   ├── CreateProject.jsx
│       │   ├── ProjectList.jsx
│       │   ├── ProjectMembers.jsx
│       │   └── ProjectBacklog.jsx     (new in PA4)
│       ├── Api.js                     shared fetch helper and username lookup
│       ├── App.jsx                    tabs
│       └── App.css / index.css
└── server/
    ├── .env.example
    ├── package.json
    └── server.js                      all Express routes and the MongoDB connection
```

## Setup and running

You need Node.js 22.12 or newer, two terminals, and a MongoDB Atlas connection string. In Atlas, allow your IP address under Network Access.

**Server**

```bash
cd server
npm install
cp .env.example .env
node server.js
```

Put your connection string in `server/.env`:

```
MONGO_URI=your-connection-string-here
```

The server prints `Connected to MongoDB` and `Server running on port 9000`. It uses the database `pa2`.

**Client**

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173.

`.env` and `node_modules` are listed in `.gitignore` and are not committed.

## Data model

| Collection | Fields |
| --- | --- |
| `users` | `_id`, `f_name`, `l_name`, `username`, `password` |
| `projects` | `_id`, `name`, `description`, `status`, `project_lead_id` |
| `projectMemberships` | `_id`, `project_id`, `user_id` |
| `UserStories` | `_id`, `project_id`, `title`, `description`, `priority`, `status`, `assigned_user_id` |

All `*_id` references are stored as MongoDB `ObjectId` values, never as names. `assigned_user_id` is `null` for an unassigned story. A story's `project_id` is taken from the URL when it is created and never changes afterwards. One membership document means one user in one project.

Example `UserStories` document:

```
{
  _id: ObjectId("..."),
  project_id: ObjectId("..."),
  title: "View campus event details",
  description: "As a student, I want to view details of a campus event, so that I can decide whether to attend.",
  priority: "High",
  status: "To Do",
  assigned_user_id: ObjectId("...")
}
```

## API

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/signup` | Create a user |
| POST | `/login` | Check a username and password |
| GET | `/api/users` | List users (passwords are never sent) |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create a project and add its lead as a member |
| GET | `/api/projects/:projectId/members` | List a project's memberships |
| POST | `/api/projects/:projectId/members` | Add a member |
| DELETE | `/api/projects/:projectId/members/:userId` | Remove a member |
| GET | `/api/projects/:projectId/stories` | List a project's stories |
| POST | `/api/projects/:projectId/stories` | Create a story |
| PUT | `/api/projects/:projectId/stories/:storyId` | Save an edited story (all editable fields) |
| DELETE | `/api/projects/:projectId/stories/:storyId` | Delete a story |

Status codes: `200` for reads, updates and deletes; `201` when something is created; `400` for invalid input or identifiers, removing the lead, or assigning someone who is not a member of the project; `401` for a failed login; `404` when a project, story or user is not found; `409` for a duplicate username or membership, or when removing a member is blocked by assigned stories; `500` for unexpected server errors.

## How it works

### Backend

- **Identifiers.** Values from the browser are strings, but MongoDB stores `ObjectId`s. A `toObjectId()` helper accepts only 24-character hex strings and converts them, so a bad identifier returns `400` instead of crashing a route. `null` (unassigned) is handled before any conversion.
- **Story validation.** The server checks everything again, even though the React form has required fields. Title and description must be non-blank strings (up to 100 and 1000 characters), the description must follow "As a … I want … so that …", priority must be High, Medium or Low, and status (on edit) must be To Do, In Progress or Done.
- **Creating a story.** The server checks that the project exists, validates the fields, and builds the document explicitly instead of inserting `req.body`. It sets `project_id` from the route and `status` to `To Do`, so a request cannot supply its own `_id`, status or project.
- **Assignment rule.** An assignee must exist in `users` and have a matching document in `projectMemberships` for the same project. The check runs on both create and edit.
- **Editing and deleting.** Both queries use the story id and the project id together, so a story from one project cannot be changed or deleted through another project's URL. Editing checks `matchedCount` rather than `modifiedCount`, so saving unchanged values still succeeds. Deleting returns `404` if nothing was removed.
- **Removing a member.** After the existing PA3 checks (valid ids, project exists, not the lead), the server looks for any story with this `project_id` and `assigned_user_id`, with no status filter, and returns `409` with a clear message if one exists.

### Frontend

- `App.jsx` switches tabs with a single `activeTab` state. Backlog is the new tab.
- `ProjectBacklog.jsx` holds a project selector and a `Backlog` component rendered with `key={projectId}`. Changing the project throws away the previous project's stories, form and messages, and a cleanup flag in the effect stops a slow response from an old project from overwriting the new one.
- Selecting a project loads its stories, memberships and the user list together. The assignee dropdown is built from the project's members only. Its "Unassigned" option has an empty value that is sent to the server as `null`.
- `Api.js` has one `request()` helper that checks `response.ok` and returns the server's message, so success is only shown when the server really succeeded. Error and empty states are shown on the page.
- Editing uses separate form state, so typing does not change the saved story on screen, and Cancel sends no request. The project's members are reloaded before the edit form opens.

## Notes and limitations

- Passwords are stored as plain text because the assignment does not ask for hashing. A real project would use `bcrypt`.
- Login only returns a success or failure message. There are no sessions or tokens, and the API has no authentication.
- `cors()` is open to every origin, which is only suitable for local development.
- The member-removal check is written for normal sequential use; it does not guard against two requests arriving at the same instant.