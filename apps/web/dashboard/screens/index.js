import Activity from "./Activity.jsx";
import Compare from "./Compare.jsx";
import Environments from "./Environments.jsx";
import Health from "./Health.jsx";
import Members from "./Members.jsx";
import NotFound from "./NotFound.jsx";
import ProjectOverview from "./ProjectOverview.jsx";
import Projects from "./Projects.jsx";
import Secrets from "./Secrets.jsx";
import Settings from "./Settings.jsx";
import Tokens from "./Tokens.jsx";

export const SCREENS = {
  projects: Projects,
  project: ProjectOverview,
  secrets: Secrets,
  compare: Compare,
  environments: Environments,
  activity: Activity,
  health: Health,
  tokens: Tokens,
  members: Members,
  settings: Settings,
  notfound: NotFound,
};

export const TITLES = {
  projects: "Projects",
  project: "Overview",
  secrets: "Secrets",
  compare: "Compare",
  environments: "Environments",
  activity: "Activity",
  health: "Health",
  tokens: "Tokens",
  members: "Members",
  settings: "Settings",
  notfound: "Not found",
};
