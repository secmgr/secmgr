import AddSecretsDialog from "../overlays/AddSecretsDialog.jsx";
import CreateEnvironmentDialog from "../overlays/CreateEnvironmentDialog.jsx";
import CreateProjectDialog from "../overlays/CreateProjectDialog.jsx";
import CreateTokenDialog from "../overlays/CreateTokenDialog.jsx";
import ExportDialog from "../overlays/ExportDialog.jsx";
import ImportSheet from "../overlays/ImportSheet.jsx";
import InviteDialog from "../overlays/InviteDialog.jsx";
import ReviewChangesDialog from "../overlays/ReviewChangesDialog.jsx";
import SecretSheet from "../overlays/SecretSheet.jsx";
import ShareDialog from "../overlays/ShareDialog.jsx";
import ShortcutsDialog from "../overlays/ShortcutsDialog.jsx";
import { useStore } from "../store";

export const SHEETS = { secret: SecretSheet, import: ImportSheet };
export const DIALOGS = {
  "add-secrets": AddSecretsDialog,
  review: ReviewChangesDialog,
  export: ExportDialog,
  share: ShareDialog,
  shortcuts: ShortcutsDialog,
  "create-project": CreateProjectDialog,
  "create-environment": CreateEnvironmentDialog,
  "create-token": CreateTokenDialog,
  invite: InviteDialog,
};

export function Overlays() {
  const { state, actions } = useStore();
  const { sheet, dialog } = state.ui;
  const Sheet = sheet ? SHEETS[sheet.kind] : null;
  const Dialog = dialog ? DIALOGS[dialog.kind] : null;
  return (
    <>
      {Sheet ? <Sheet {...sheet.props} onClose={actions.closeSheet} /> : null}
      {Dialog ? <Dialog {...dialog.props} onClose={actions.closeDialog} /> : null}
    </>
  );
}
