# ICSI 418Y – Programming Assignment 3: Projects and Project Memberships

For this assignment I built on my PA2 login and signup app. Users can now create software projects, choose a project lead from the registered users, and add or remove the people on each project. It is the same stack as PA2: a React frontend, an Express backend, and MongoDB Atlas.

```
React (localhost:5173)  →  HTTP requests  →  Express (localhost:9000)  →  MongoDB Atlas
```

## What I Built

- A **Create project** form with a name, description, status (Planning, Active, or Completed), and a project lead picked from the registered users
- A **project list** that shows each project's name, description, status, and the lead's full name and username
- A **membership manager** where I select a project, see its members, add a registered user, and remove a member
- The project lead is added to the project automatically and cannot be removed
- A user can be in many projects, and a project can have many users, but the same user cannot be added to the same project twice
- My PA2 Login and Signup still work the same way

## How I Set It Up

I kept working in my PA2 repository instead of starting over, so all of my existing users are still available as project leads and members.

**Environment files.** `server/.env` holds `MONGO_URI`. I also added optional `MONGO_DB` (defaults to `pa2`) and `PORT` (defaults to `9000`). I added `server/.env.example` and `client/.env.example` so the setup is documented without committing my real credentials. `.gitignore` keeps `.env` and `node_modules` out of GitHub.

**Collection names.** The assignment asks for collections named `Users`, `Projects`, and `ProjectMemberships`. In PA2 my collection was called `users` in lowercase, and MongoDB collection names are case sensitive. So when the server starts it renames `users` to `Users` if `Users` does not exist yet. A rename keeps every user's `_id` and password, so nothing from PA2 is lost.

**Transactions.** When a project is created, the project and its lead's membership are saved in one transaction. Transactions need a replica set, which MongoDB Atlas is, so this works with my Atlas cluster but would not work on a plain standalone MongoDB.

**Demo data.** I added `server/seed.js`. It adds three demo users and two demo projects for recording the video, and it can be run again without creating duplicates.

## Project Structure

```
icsi418y-pa3/
├── .gitignore
├── README.md
├── client/
│   ├── .env.example
│   └── src/
│       ├── components/
│       │   ├── Login.jsx        Login form (from PA2)
│       │   ├── Signup.jsx       Signup form (from PA2)
│       │   ├── Projects.jsx     Create project form, project list, selected project
│       │   └── Memberships.jsx  Member list, add and remove
│       ├── api.js               Shared request helper and user label
│       ├── App.jsx              Tabs: Projects, Log in, Sign up
│       └── App.css / index.css
└── server/
    ├── .env.example
    ├── server.js                Express routes and MongoDB connection
    ├── seed.js                  Demo users and projects
    └── test/                    Validation and integration tests
```

## How I Built the Frontend

**Tabs and components.** `App.jsx` still switches between views with one piece of state, `activeTab`. I added a Projects tab next to Log in and Sign up. I kept Login and Signup as they were, and the only change is that they read the server address from `api.js`. I split the new work into two components: `Projects.jsx` for creating and listing projects, and `Memberships.jsx` for the members of whichever project is selected.

**Talking to the backend.** `api.js` has one `request()` function that sends JSON with `fetch`. If the response is not ok it throws an error with the server's message, and if the server cannot be reached it throws a "could not connect" message. That way every component just uses `try/catch` and shows the message in the page.

**Dropdowns.** When `Projects.jsx` loads, it fetches the users and the projects together with `Promise.all`. The lead dropdown shows each person's name, but the value it submits is their database `_id`. The same idea is used for the "add a registered user" dropdown.

**Showing the lead's name.** The backend sends each project with its lead's details already attached, so the project card can show the lead's name and username instead of an id.

**Keeping the list correct.** After every add or remove, `Memberships.jsx` asks the server for the saved member list again instead of guessing what changed. The remove button for the lead is disabled, and the backend also refuses that request.

## How I Built the Backend

**IDs.** Values from a form are strings, but MongoDB `_id` values are `ObjectId`s. My `objectId()` helper checks that a value is a valid 24 character hex string and converts it. A bad id returns a `400` instead of crashing the route.

**`POST /projects`.**
1. Check that name, description, status, and project lead are all provided, otherwise `400`.
2. Check that the status is Planning, Active, or Completed, otherwise `400`.
3. Look up the selected lead in `Users`. If they do not exist, return `404`.
4. In a transaction, insert the project and insert a membership for the lead, then return `201`.

**Membership routes.** Each one first checks that the project exists and, where needed, that the user exists (`404` if not).
- `GET /projects/:projectId/members` returns the memberships with each user's details and a flag for whether they are the lead.
- `POST /projects/:projectId/members` inserts a membership. A unique index on `project_id` + `user_id` rejects duplicates, and the server turns that MongoDB duplicate key error into a `409` with a clear message. The index also protects against two requests arriving at the same moment.
- `DELETE /projects/:projectId/members/:userId` returns `403` if that user is the project lead. Otherwise it deletes the membership, or returns `404` if the user was not a member.

**Names without copying them.** I use `$lookup` in an aggregation to join the memberships and projects to `Users` for display. The password field is removed from everything the server sends back.

**Errors.** All the project routes go through one wrapper that catches errors and sends back JSON. Real database errors are logged on the server, and the browser only gets a generic message, the same way I did in PA2.

## MongoDB Collections

| Collection | Fields |
| --- | --- |
| `Users` | `_id`, `f_name`, `l_name`, `username`, `password` |
| `Projects` | `_id`, `name`, `description`, `status`, `project_lead_id` |
| `ProjectMemberships` | `_id`, `project_id`, `user_id` |

`project_lead_id`, `project_id`, and `user_id` are all `ObjectId` references. I never store usernames or project names in a membership. One membership document means one user in one project, so a user in three projects has three membership documents.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/signup` | Create a user |
| POST | `/login` | Check a username and password |
| GET | `/users` | List users (no passwords) |
| GET | `/projects` | List projects with their lead |
| POST | `/projects` | Create a project and add its lead as a member |
| GET | `/projects/:projectId/members` | List a project's members |
| POST | `/projects/:projectId/members` | Add a member |
| DELETE | `/projects/:projectId/members/:userId` | Remove a non-lead member |

## Status Codes I Used

| Status | Used for |
| --- | --- |
| `200` | Successful read, login, or member removal |
| `201` | User, project, or membership created |
| `400` | Missing or invalid input, or a bad id |
| `401` | Invalid login credentials |
| `403` | Trying to remove the project lead |
| `404` | Project, user, or membership not found |
| `409` | Username already exists, or user already in the project |
| `500` | Server or database error |

## How to Run It

You need two terminals, Node.js, and a MongoDB Atlas connection string.

**Server**
```bash
cd server
npm install
cp .env.example .env
```
Put my connection string in `server/.env` as `MONGO_URI`, then run:
```bash
npm start
```
You should see `Connected to MongoDB` and `Server running on port 9000`.

**Client**
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173`.

**Optional demo data**
```bash
cd server
npm run seed
```
This adds the users `pa3_alice`, `pa3_bob`, and `pa3_carol` (password `PA3demo123!`) and two demo projects.

## How I Tested It

I tested each feature as I added it, in the same order I built it:

1. Signed up a new user and logged in, then tried a wrong password.
2. Confirmed the lead dropdown listed my registered users.
3. Created a project and checked the `Projects` collection in Atlas.
4. Checked that the lead also appeared in `ProjectMemberships` and in the member list.
5. Created a second project and confirmed both showed up with the lead's name.
6. Added a user to a project, then added the same user to a second project.
7. Tried to add the same user to the same project again and got the duplicate message.
8. Removed a non-lead member and confirmed the list updated.
9. Confirmed the lead's remove button is disabled and that the server rejects removing the lead.
10. Looked at the three collections in Atlas to confirm the ids are `ObjectId` values.

I also wrote tests for the server. `npm test` in `server` checks the validation rules without needing a database. `npm run test:integration` runs the whole flow against MongoDB using a temporary database that it deletes afterward.

## Notes

- Passwords are still stored as plain text because the assignment does not ask for hashing. In a real project I would use `bcrypt`.
- Login only shows a success or failure message, like in PA2. There are no sessions.
- `cors()` is open to every origin, which is fine for local development only.
- My `.env` file is not in the repository because it contains my database credentials.