import { Button, EmptyState } from "@secmgr/ui";
import { useStore } from "../store";

export default function NotFound() {
  const { state, actions, select } = useStore();
  const params = state.route.params || {};
  const path = typeof window === "undefined" ? "" : window.location.pathname;
  const project = params.projectId ? select.projectById(params.projectId) : null;
  const title =
    params.missing === "project"
      ? "This project does not exist"
      : params.missing === "environment"
        ? `${project ? project.name : "This project"} has no ${params.envName} environment`
        : "This page does not exist";
  const description =
    params.missing === "project" ? (
      <>
        No project called <code className="pg-code nf__path">{params.projectName}</code> in {state.data.workspace.name}.
        It may have been renamed or deleted, or you may not have access to it.
      </>
    ) : params.missing === "environment" ? (
      <>It may have been renamed or deleted, or you may not have access to it.</>
    ) : (
      <>
        Nothing lives at <code className="pg-code nf__path">{path}</code>. Check the address, or start again from your
        projects.
      </>
    );
  return (
    <div className="pg nf">
      <EmptyState
        className="nf__empty"
        variant="page"
        icon="search-x"
        titleAs="h1"
        title={title}
        description={description}
        actions={
          <>
            {project ? (
              <Button
                variant="secondary"
                icon="arrow-left"
                onClick={() => actions.navigate("project", { projectId: project.id })}
              >{`Open ${project.name}`}</Button>
            ) : null}
            <Button variant="primary" iconRight="arrow-right" onClick={() => actions.navigate("projects")}>
              Go to projects
            </Button>
          </>
        }
      />
    </div>
  );
}
