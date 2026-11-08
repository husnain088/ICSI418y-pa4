import { useState } from "react";
import Signup from "./components/Signup.jsx";
import Login from "./components/Login.jsx";
import CreateProject from "./components/CreateProject.jsx";
import ProjectList from "./components/ProjectList.jsx";
import ProjectMembers from "./components/ProjectMembers.jsx";
import "./App.css";

const TABS = [
  { id: "login", label: "Log in" },
  { id: "signup", label: "Sign up" },
  { id: "create", label: "Create project" },
  { id: "projects", label: "Projects" },
  { id: "members", label: "Members" }
];

function App() {
  const [activeTab, setActiveTab] = useState("login");

  return (
    <main className="app-shell">
      <div className="card">
        <div className="tabs" role="tablist" aria-label="Application sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="tab"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {activeTab === "signup" && <Signup />}
          {activeTab === "login" && <Login />}
          {activeTab === "create" && <CreateProject />}
          {activeTab === "projects" && <ProjectList />}
          {activeTab === "members" && <ProjectMembers />}
        </div>
      </div>
    </main>
  );
}

export default App;