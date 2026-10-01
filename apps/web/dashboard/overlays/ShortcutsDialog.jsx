import { Button, Dialog, Kbd } from "@secmgr/ui";
import { useLatch } from "../shell/format.js";

const GROUPS = [
  {
    title: "Anywhere",
    items: [
      [["mod", "k"], "Open the command menu"],
      [["/"], "Search this page"],
      [["c"], "Add secret"],
      [["i"], "Import .env"],
      [["?"], "Show keyboard shortcuts"],
      [["mod", "v"], "Paste a .env outside a field to import it"],
    ],
  },
  {
    title: "Go to",
    items: [
      [["g", "p"], "Projects"],
      [["g", "a"], "Activity"],
      [["g", "h"], "Health"],
      [["g", "t"], "Tokens"],
      [["g", "m"], "Members"],
      [["g", "s"], "Settings"],
    ],
  },
  {
    title: "Secrets table",
    items: [
      [["j"], "Next row"],
      [["k"], "Previous row"],
      [["e"], "Edit the focused secret"],
      [["r"], "Reveal the focused value"],
      [["c"], "Copy the focused value"],
      [["x"], "Select the focused row"],
      [["u"], "Undo a staged delete"],
      [["esc"], "Cancel an edit or close the side panel"],
    ],
  },
  {
    title: "Changes",
    items: [
      [["mod", "s"], "Save staged changes, or stage raw .env edits"],
      [["mod", "enter"], "Save from a dialog"],
    ],
  },
];

export default function ShortcutsDialog({ onClose }) {
  const [open, close] = useLatch(onClose, 200);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
      size="lg"
      title="Keyboard shortcuts"
      description="Every screen works from the keyboard. Letter shortcuts pause while you type in a field."
      footer={<Button onClick={close}>Close</Button>}
    >
      <div className="app-keys">
        {GROUPS.map((g) => (
          <section key={g.title} className="app-keys__group" aria-label={g.title}>
            <h3 className="app-keys__title">{g.title}</h3>
            <dl className="app-keys__list">
              {g.items.map(([keys, label]) => (
                <div key={label} className="app-keys__row">
                  <dt className="app-keys__label">{label}</dt>
                  <dd className="app-keys__keys">
                    {keys.length === 2 && keys[0] === "g" ? (
                      <>
                        <Kbd keys="g" />
                        <span className="app-keys__then">then</span>
                        <Kbd keys={keys[1]} />
                      </>
                    ) : (
                      <Kbd keys={keys} />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
