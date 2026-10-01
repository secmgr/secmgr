import type * as React from "react";

// Icon
/** A Lucide icon at one stroke width. Decorative unless `label` is given. */
export interface IconProps extends Omit<React.SVGAttributes<SVGSVGElement>, "name"> {
  /** Lucide icon name in kebab case, for example "key-round". Must be in the built icon set. */
  name: string;
  /** Rendered size in px. Use 14 in chips and badges, 16 by default, 20 in empty states and callouts. */
  size?: 14 | 16 | 20 | 24 | number;
  /** Stroke width in the 24 unit grid. Leave at 1.75. */
  strokeWidth?: number;
  /** Fills the shape with the current color. Use for on states that need weight, such as a starred project. */
  filled?: boolean;
  /** Accessible name. Omit for decorative icons that sit next to a text label. */
  label?: string;
}
export declare function Icon(props: IconProps): React.ReactElement;
export declare function hasIcon(name: string): boolean;
export declare const iconNames: string[];
/** The icon as an SVG string, for markup rendered outside React. Empty when the name is not in the set. */
export declare function iconMarkup(name: string, size?: number, strokeWidth?: number): string;

// Spinner
/** An indeterminate loading indicator that inherits the text color. */
export interface SpinnerProps {
  /** Size in px. 14 inside small buttons, 16 by default. */
  size?: number;
  /** Accessible name announced to screen readers. */
  label?: string;
  className?: string;
}
export declare function Spinner(props: SpinnerProps): React.ReactElement;

// Kbd
/** A keyboard key or shortcut. Pass `keys` for a shortcut; "mod" becomes ⌘ on macOS and Ctrl elsewhere. */
export interface KbdProps {
  /** A shortcut such as ["mod", "k"] or ["g", "p"]. Rendered as one key cap per entry. */
  keys?: string | string[];
  /** A single key cap when `keys` is not given. */
  children?: React.ReactNode;
  size?: "sm" | "md";
  /** `inverse` sits on `primary` fills, inside buttons and tooltips. */
  tone?: "default" | "inverse";
  className?: string;
}
export declare function Kbd(props: KbdProps): React.ReactElement;

// Button
/** The one control for actions. Quiet by default; `primary` once per view. */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** `primary` for the single most important action in a view, `secondary` for the rest, `ghost` in toolbars and rows, `danger` only for irreversible actions after a confirmation step. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** `sm` 28px in toolbars and rows, `md` 32px by default, `lg` 40px on auth and onboarding. */
  size?: "sm" | "md" | "lg";
  /** Leading Lucide icon name. */
  icon?: string;
  /** Trailing Lucide icon name, for disclosure (chevron-down) or navigation (arrow-right). */
  iconRight?: string;
  /** Shows a spinner in place of the leading icon, keeps the label and width, blocks clicks. */
  loading?: boolean;
  disabled?: boolean;
  /** Shortcut hint shown at the end, for example ["mod", "s"]. */
  kbd?: string | string[];
  fullWidth?: boolean;
  /** Renders an anchor instead of a button. */
  href?: string;
  type?: "button" | "submit" | "reset";
  children?: React.ReactNode;
}
export declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;

// IconButton
/** A square button with one icon. Always has a label, shown as its `Tooltip` and read by screen readers. */
export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Lucide icon name. */
  icon: string;
  /** Required accessible name, written as the action: "Copy value", "Reveal value". Also the tooltip text. */
  label: string;
  /** `ghost` in rows and toolbars, `secondary` when it stands alone beside secondary buttons. */
  variant?: "ghost" | "secondary";
  /** `xs` 24px inside rows and chips, `sm` 28px in toolbars, `md` 32px by default. */
  size?: "xs" | "sm" | "md";
  /** Toggle state for buttons such as "Reveal value". */
  pressed?: boolean;
  /** Shows a spinner in place of the icon and blocks clicks. */
  loading?: boolean;
  disabled?: boolean;
  /** Shortcut shown in the tooltip after the label, for example "c" or ["mod", "c"]. Chords are also exposed as `aria-keyshortcuts`. */
  kbd?: string | string[];
  /** Shows the label as a tooltip on hover and keyboard focus. Set false only when the same words are visible beside the button. */
  tooltip?: boolean;
  /** Side the tooltip opens on. */
  tooltipSide?: "top" | "bottom" | "left" | "right";
  type?: "button" | "submit" | "reset";
}
export declare const IconButton: React.ForwardRefExoticComponent<
  IconButtonProps & React.RefAttributes<HTMLButtonElement>
>;

// ActivityItem
/** What happened in an audit entry. Each action has its own icon: plus, pencil, trash-2, eye, key-round, lock, lock-open, rotate-cw, upload, copy, history. */
export type ActivityAction =
  | "created"
  | "updated"
  | "deleted"
  | "revealed"
  | "read"
  | "protected"
  | "unprotected"
  | "rotated"
  | "imported"
  | "copied"
  | "restored";
/** The old and new value of an update, shown masked when the entry is expanded. */
export interface ActivityDiff {
  /** Value before the change; `undefined` reads "Not set". */
  before?: string;
  /** Value after the change; `undefined` reads "Deleted". */
  after?: string;
  /** Label of the old line, for example "v6". Default "Before". */
  beforeLabel?: string;
  /** Label of the new line, for example "v7". Default "After". */
  afterLabel?: string;
}
/** One audit log entry written as a sentence: who did what to which key in which environment, and when. */
export interface ActivityItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A member's full name ("Priya Raman") or a service token's name ("ci-deploy"). */
  actor?: string;
  /** `token` sets the actor in mono. */
  actorType?: "member" | "token";
  /** The action, which picks the verb and the icon. */
  action?: ActivityAction;
  /** The key or keys acted on. One or two keys are named in mono; more collapse to a count. */
  keys?: string | string[];
  /** Number of secrets for bulk actions: "read 23 secrets", "imported 15 secrets". */
  count?: number;
  /** The environment, shown as an `EnvBadge` at `sm`. */
  env?: Env | string;
  /** The destination environment of a `copied` action. */
  target?: Env | string;
  /** The version a `restored` action went back to, for example "v5". */
  version?: string;
  /** Display time at the right: "4 min ago", "18:32". */
  time?: string;
  /** When it happened; used for `time` through `relativeTime` when `time` is not given. */
  date?: Date | number | string;
  /** Reference time for `date`. Defaults to now. */
  now?: Date | number;
  /** Makes the entry expandable with a masked before and after preview. */
  diff?: ActivityDiff;
  /** Slot before the actor's name. `true` draws an `Avatar` at 20px from `actor` (a bot tile for tokens); a node replaces it. */
  avatar?: React.ReactNode | true;
  /** Overrides the action's icon with another Lucide name. */
  icon?: string;
  /** Controlled expansion of the diff preview. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Custom rendering of the before and after values. Return `undefined` to keep the masked `SecretValue`. */
  valueRenderer?: (value: string, context: { side: "before" | "after"; key?: string; env: string }) => React.ReactNode;
  /** Draws the hairline from this entry's icon down to the next one. `ActivityFeed` sets it. */
  connector?: boolean;
  /** Shows a skeleton line with a spinner in the icon tile. */
  loading?: boolean;
  /** Replaces the generated sentence. */
  children?: React.ReactNode;
}
export declare const ActivityItem: React.ForwardRefExoticComponent<
  ActivityItemProps & React.RefAttributes<HTMLDivElement>
>;
/** An entry of `ActivityFeed`: `ActivityItem` props plus an id and the moment it happened. */
export interface ActivityFeedItem extends ActivityItemProps {
  id?: string;
  /** Groups the entry under "Today", "Yesterday" or a date like "Sep 28". */
  date?: Date | number | string;
}
/** The audit log: entries grouped by day, newest first, their icons joined by a vertical hairline. */
export interface ActivityFeedProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Entries, newest first. */
  items?: ActivityFeedItem[];
  /** Reference time for day groups and relative times. Defaults to now. */
  now?: Date | number;
  /** Shows three skeleton entries. */
  loading?: boolean;
  /** Replaces the empty state "No activity yet. Changes, reveals and reads show up here." */
  empty?: React.ReactNode;
  /** Draws an `Avatar` before every actor that has no `avatar` of its own. */
  avatars?: boolean;
  /** Default value renderer for every entry's diff preview. */
  valueRenderer?: ActivityItemProps["valueRenderer"];
}
export declare const ActivityFeed: React.ForwardRefExoticComponent<
  ActivityFeedProps & React.RefAttributes<HTMLDivElement>
>;
/** "Today", "Yesterday", or a short date such as "Sep 28". */
export declare function dayLabel(date: Date | number | string, now?: Date | number): string;

// AppShell
/** The frame of every signed-in screen: a sidebar on the `bg` ground and an inset panel on `surface` that holds a header row and the page. Only the panel scrolls. */
export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The navigation column, usually a `Sidebar`. It reads the shell's collapsed and drawer state from context. */
  sidebar?: React.ReactNode;
  /** Content of the `--header` row at the top of the panel, usually `Breadcrumbs` on the left and a few actions pushed right. The shell adds the sidebar toggle before it. */
  header?: React.ReactNode;
  /** The page. It scrolls inside the panel; give it its own padding (`PageHeader` brings its own). */
  children?: React.ReactNode;
  /** Draws the panel inset 8px from the top, right and bottom with `--r-12` corners and `shadow-sm`. False runs it full bleed with a hairline on its left. Always full bleed below 768px. */
  inset?: boolean;
  /** Controlled rail state on wide screens: true draws the 56px icon rail. */
  sidebarCollapsed?: boolean;
  /** Initial rail state when uncontrolled. */
  defaultSidebarCollapsed?: boolean;
  /** Called with the next rail state when the header toggle is pressed. */
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  /** Shows the "Collapse sidebar" toggle at the start of the header on wide screens. */
  collapsible?: boolean;
  /** Controlled drawer state below 768px. */
  drawerOpen?: boolean;
  /** Initial drawer state when uncontrolled. */
  defaultDrawerOpen?: boolean;
  /** Called when the drawer opens (menu button) or closes (Escape, the scrim, or choosing a nav item). */
  onDrawerOpenChange?: (open: boolean) => void;
  /** Accessible name of the sidebar region and of the drawer dialog. */
  sidebarLabel?: string;
}
export declare const AppShell: React.ForwardRefExoticComponent<AppShellProps & React.RefAttributes<HTMLDivElement>>;

// Avatar
/** A person or a service token: initials on a hue picked from the environment palette by a stable hash of the name, a photo when there is one, or a bot tile for tokens. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name or email. Gives the initials ("Maya Chen" is MC, 1 letter at 16px) and the hue, which never changes for the same name. */
  name: string;
  /** Photo URL. Falls back to initials if it fails to load. */
  src?: string;
  /** Diameter in px: 16 in dense rows, 20 in activity and lists, 24 by default, 32 in member settings. */
  size?: 16 | 20 | 24 | 32;
  /** `service` draws a square `--r-4` tile with the `bot` icon, for tokens such as `ci-deploy`. */
  kind?: "person" | "service";
  /** Accessible name. Defaults to `name`. */
  alt?: string;
  /** Tooltip. Defaults to `name`; pass `null` to turn it off. */
  title?: string | null;
}
export declare const Avatar: React.ForwardRefExoticComponent<AvatarProps & React.RefAttributes<HTMLSpanElement>>;
export interface AvatarStackPerson {
  /** Full name, or the token slug for a service. */
  name: string;
  /** Photo URL. Falls back to initials if it fails to load. */
  src?: string;
  /** `service` draws the bot tile. */
  kind?: "person" | "service";
}
/** Overlapping avatars with a "+2" chip for the rest, for who edited a secret or who has access. */
export interface AvatarStackProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** People and tokens in order of relevance, most recent first. Strings are names. */
  people: Array<AvatarStackPerson | string>;
  /** Avatars shown before the "+N" chip. Defaults to 3. */
  max?: number;
  /** Diameter in px of every avatar and the chip. Defaults to 24. */
  size?: 16 | 20 | 24 | 32;
  /** The ground token under the stack, used for the 2px separating ring. Defaults to "surface". */
  ground?: "surface" | "surface-raised" | "bg" | "bg-subtle";
  /** Accessible name. Defaults to "Maya Chen, Jonas Weber, Priya Raman and 2 more". */
  label?: string;
}
export declare function AvatarStack(props: AvatarStackProps): React.ReactElement;
/** The hue an avatar uses for a name. */
export declare function avatarHue(name: string): "blue" | "teal" | "green" | "amber" | "orange" | "rose" | "violet";
export declare const AVATAR_HUES: string[];

// Badge
/** A short status or count label. Status tones always pair color with a word, and an icon where space allows. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  /** `soft` fills with the tone's soft ground; `outline` sits quietly in dense tables. */
  variant?: "soft" | "outline";
  /** Leading Lucide icon at 14px. */
  icon?: string;
  /** A 6px dot in the tone color, for live states such as "In sync". */
  dot?: boolean;
  children?: React.ReactNode;
}
export declare function Badge(props: BadgeProps): React.ReactElement;

// Breadcrumbs
export interface BreadcrumbItem {
  /** Visible text: the workspace name, or an exact slug such as `lumen-api` and `staging`. */
  label: React.ReactNode;
  /** Leading Lucide icon name, or a node such as a 16px `AppIcon` for the workspace. */
  icon?: string | React.ReactNode;
  /** An environment hue for a leading `EnvDot`, for environment crumbs. */
  dot?: "gray" | "blue" | "teal" | "green" | "amber" | "orange" | "rose" | "violet";
  /** Renders the crumb as a link. Ignored on the last crumb, which is the current page. */
  href?: string;
  /** Renders the crumb as a button when there is no `href`. Ignored on the last crumb. */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  /** Sets the label in `mono-medium`, for project and environment slugs. */
  mono?: boolean;
  /** `true` adds a `chevrons-up-down` `IconButton` at `xs` beside the crumb (Vercel style) that calls `onSwitch`; a node renders as is, for example a `Menu` with its own trigger. */
  switcher?: boolean | React.ReactNode;
  /** Accessible name of the default switcher, for example "Switch project". */
  switcherLabel?: string;
  /** Called when the default switcher is pressed. */
  onSwitch?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Stable key when labels repeat. */
  key?: string;
  /** Extra class on the crumb, for forced preview states. */
  className?: string;
}
/** Where you are: workspace, project, environment. Thin "/" separators; the last crumb is the current page. */
export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  /** Crumbs from the widest place to the current page, usually workspace, project, environment. */
  items: BreadcrumbItem[];
  /** Accessible name of the navigation landmark. */
  label?: string;
}
export declare const Breadcrumbs: React.ForwardRefExoticComponent<BreadcrumbsProps & React.RefAttributes<HTMLElement>>;

// Callout
/** A tinted note inside a page that explains a state and offers the fix. Status color always comes with an icon and words. */
export interface CalloutProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** `info` (accent) for guidance, `success` after a completed step, `warning` for something due, `danger` for a real risk, `neutral` for a standing rule such as a protected environment. */
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  /** Lucide icon name or node. Defaults per tone: info, circle-check, triangle-alert, circle-alert, info. `false` hides it. */
  icon?: string | React.ReactNode | false;
  /** One line in `body-medium` that states the fact: "Staging uses a live Stripe key". */
  title?: React.ReactNode;
  /** Detail in `small` `text-secondary`; inline `code` is set in mono. */
  children?: React.ReactNode;
  /** One `sm` button that fixes it, for example "Rotate key". Moves under the text when the callout is narrower than 440px. */
  action?: React.ReactNode;
  /** Shows an `xs` close `IconButton` and calls this when pressed. */
  onDismiss?: () => void;
  /** Accessible name of the close button. */
  dismissLabel?: string;
}
export declare const Callout: React.ForwardRefExoticComponent<CalloutProps & React.RefAttributes<HTMLDivElement>>;

// Card
/** A flat surface with a hairline ring that groups one thing: a project, an environment, a setting group, a snippet. No shadow until an interactive card is hovered. */
export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "onClick"> {
  /** Heading in `heading` (14px, 600). On an interactive card the title is the link, stretched over the whole card. */
  title?: React.ReactNode;
  /** One line under the title in `small` `text-secondary`. */
  description?: React.ReactNode;
  /** Buttons or icon buttons at the top right. They stay clickable on an interactive card. */
  actions?: React.ReactNode;
  /** A strip under a hairline on the `bg-subtle` ground, for a status line or secondary actions. */
  footer?: React.ReactNode;
  /** Inner padding: `sm` 12px, `md` 16px, `lg` 24px, `none` for flush content such as a `Table` or `SettingRow`s (the header keeps 16px and gains a hairline). */
  padding?: "none" | "sm" | "md" | "lg";
  /** Hover draws a `border-hover` ring, `shadow-sm` and a 1px lift. With `href` or `onClick` the whole card is one target with a focus ring. */
  interactive?: boolean;
  /** Makes an interactive card a link. */
  href?: string;
  /** Makes an interactive card a button when there is no `href`. */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  /** Accessible name for the card target when the title alone is not enough, or when there is no title. */
  label?: string;
  /** Heading element for the title. `h3` by default. */
  titleAs?: "h2" | "h3" | "h4" | "p";
  /** Body content, padded by `padding`. */
  children?: React.ReactNode;
}
export declare const Card: React.ForwardRefExoticComponent<CardProps & React.RefAttributes<HTMLDivElement>>;

// ChangesBar
/** Counts of staged changes by kind. */
export interface StagedChanges {
  /** Existing keys with a new value or name. */
  edited?: number;
  /** Keys that do not exist in the environment yet. */
  added?: number;
  /** Keys staged for deletion. */
  deleted?: number;
}
/** The floating bar that collects staged edits: what changed, where it goes, and Discard, Review and Save. */
export interface ChangesBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Staged counts. The bar shows itself when their sum is above 0. */
  changes?: StagedChanges;
  /** Target environment, shown as an `EnvBadge` with its lock when protected. */
  env?: Env | string;
  /** Overrides the automatic visibility. */
  open?: boolean;
  /** Save in progress: the Save button shows a Spinner and "Saving"; Discard and Review are disabled. */
  saving?: boolean;
  /** Save failed: `true` shows "Could not save. 4 changes kept." with Retry; a string replaces the message. */
  error?: boolean | string;
  /** Called by "Save 4 changes" and by mod+s. For a protected environment, open the typed confirmation here. */
  onSave?: () => void;
  /** Called by the ghost Discard button. Hidden when omitted. */
  onDiscard?: () => void;
  /** Called by the secondary Review button (the diff review). Hidden when omitted. */
  onReview?: () => void;
  /** Called by Retry in the error state. Defaults to `onSave`. */
  onRetry?: () => void;
  /** Listens for mod+s on the document while the bar is open and shows the key hint. Default true. */
  shortcut?: boolean;
  /** `sticky` docks to the bottom of the scroll area (default); `static` renders in flow, for previews and docs. */
  position?: "sticky" | "static";
}
export declare function ChangesBar(props: ChangesBarProps): React.ReactElement | null;

// Checkbox
/** A 16px checkbox for selection and settings. Checked fills with `primary`. */
export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "checked" | "defaultChecked" | "onChange"> {
  checked?: boolean;
  defaultChecked?: boolean;
  /** The mixed state of a "select all" box when only some rows are selected. */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** When given, renders a clickable label beside the box. */
  label?: React.ReactNode;
  /** Secondary line under the label. */
  description?: React.ReactNode;
}
export declare const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>>;

// CodeBlock
export interface CodeTab {
  /** Tab label, usually the tool: "brew", "npm", "curl", or a format: ".env", "JSON", "YAML". */
  label: string;
  /** The code shown under this tab. */
  code: string;
  /** Overrides the block's `language` for this tab. */
  language?: "shell" | "dotenv" | "json" | "yaml" | "text";
}
/** A read only code snippet on `bg-subtle` with light, token based highlighting and a copy button. */
export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The code to show. Ignored when `tabs` is given. */
  code?: string;
  /** Alternative snippets under small underline tabs in the header, for install and export options. */
  tabs?: CodeTab[];
  /** `shell`: a non selectable `$` prompt, the command in `text`, flags in `text-secondary`, strings in `code-value`, output lines in `text-secondary`. `dotenv`: keys, `=` in `code-punct`, values in `code-value`, `# comments` in italic, `${REFERENCES}` in `code-ref`. `json` and `yaml`: keys, punctuation and values. */
  language?: "shell" | "dotenv" | "json" | "yaml" | "text";
  /** File name in the hairline header, in `mono-sm`: ".env.production". */
  title?: React.ReactNode;
  /** Shows the copy button: in the header when there is one, otherwise top right on hover. It copies only the commands of a shell snippet, never the prompts or the output. */
  copy?: boolean;
  /** In `shell`, draws a `$` before each command. When the code already starts lines with "$ ", only those lines are commands and the rest are output. */
  prompt?: boolean;
  /** Shows 1 based line numbers in a non selectable gutter. */
  lineNumbers?: boolean;
  /** 1 based line numbers to mark with a `fill-hover` ground and a 2px bar. */
  highlightLines?: number[];
  /** Wraps long lines instead of scrolling sideways. */
  wrap?: boolean;
  /** Controlled selected tab label. */
  tab?: string;
  /** Initial tab label when uncontrolled. */
  defaultTab?: string;
  /** Called with the next tab label. */
  onTabChange?: (label: string) => void;
  /** Maximum height before the code scrolls. */
  maxHeight?: number | string;
  /** Called with the copied text after a successful copy, for a toast such as "Copied install command". */
  onCopy?: (text: string) => void;
}
export declare const CodeBlock: React.ForwardRefExoticComponent<CodeBlockProps & React.RefAttributes<HTMLDivElement>>;

// CommandMenu
/** One entry in the command menu. */
export interface CommandItem {
  /** Stable key. */
  id?: string;
  /** Lucide icon name, or a node such as `<EnvDot color="amber" />`. */
  icon?: string | React.ReactNode;
  /** What the item is or does: "lumen-api", "Add secret", `STRIPE_SECRET_KEY`. Matched characters are highlighted when it is a string. */
  label: React.ReactNode;
  /** Text used for matching when `label` is not a string. */
  textValue?: string;
  /** Sets the label in mono, for keys and slugs. */
  mono?: boolean;
  /** Context after the label in `text-tertiary`: "lumen-labs/lumen-api", "lumen-api/staging", "24 secrets". Also searched. */
  hint?: React.ReactNode;
  /** Shortcut at the right, for example "c" or ["mod", "i"]. */
  kbd?: string | string[];
  /** Extra words that match the item without being shown: ["new", "create"]. */
  keywords?: string[];
  /** Skipped by Enter and dimmed. */
  disabled?: boolean;
  /** Runs on Enter or click. The menu then closes, unless the item has a `page`. */
  onSelect?: (item: CommandItem) => void;
  /** A nested page pushed on select: its title shows as a chip in the input, Backspace on an empty input or Escape goes back. */
  page?: { title?: string; placeholder?: string; items?: CommandItem[]; groups?: CommandGroup[] };
}
/** A labelled group. Groups with no matching items are hidden. */
export interface CommandGroup {
  /** Heading in `caption` `text-tertiary`: "Jump to", "Actions". */
  label?: string;
  items: CommandItem[];
}
/** The ⌘K palette: jump to a project, environment or secret, or run an action, from the keyboard. */
export interface CommandMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the next open state on the hotkey, selection, Escape and an overlay click. */
  onOpenChange?: (open: boolean) => void;
  /** Input placeholder on the root page. */
  placeholder?: string;
  /** The searchable groups on the root page. */
  groups?: CommandGroup[];
  /** Items shown first under "Recent" while the query is empty. */
  recent?: CommandItem[];
  /** Shows a spinner in the input, and "Searching for …" instead of the empty state, while results load. */
  loading?: boolean;
  /** Second line of the empty state under `No results for "…"`. */
  emptyHint?: React.ReactNode;
  /** Query the menu opens with. */
  defaultQuery?: string;
  /** Called on every keystroke, for async search. */
  onQueryChange?: (query: string) => void;
  /** Global shortcut that toggles the menu, ["mod", "k"] by default. Pass false to handle it yourself. */
  hotkey?: string[] | false;
  /** Element to focus on open, the input by default. Pass false for a menu shown open at rest. */
  initialFocus?: React.RefObject<HTMLElement> | false;
  /** Portal target. Defaults to `document.body`. Pass an element with `transform` set to confine the menu to a region, as the previews do. */
  container?: HTMLElement | null;
  /** Accessible name of the dialog. */
  label?: string;
}
export declare function CommandMenu(props: CommandMenuProps): React.ReactElement;
/** The matcher the command menu uses: a substring match scores highest (more at a word start), then an in-order subsequence that starts at a word start ("strpe" finds STRIPE_SECRET_KEY). `strict` allows substrings only. Returns null when there is no match. */
export declare function matchScore(
  text: string,
  query: string,
  strict?: boolean,
): { score: number; indices: number[] } | null;

// CompareMatrix
/** Keys as rows, 2 to 5 environments as columns. Each cell shows whether its value matches the reference environment, through a mark and a 4 character fingerprint, without showing the value. */
export interface CompareMatrixProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The environments to compare, 2 to 5, in column order. */
  envs: Array<Env | string>;
  /** Values by environment name, then by key. A key absent from an environment's map is "Missing"; an empty string is "Empty". */
  values: Record<string, Record<string, string>>;
  /** The environment every other column is compared with. Defaults to the first protected environment, else the first column. */
  reference?: string;
  /** Slot at the end of the toolbar for choosing the reference, for example a `Select` or `SegmentedControl` of environments. */
  referenceSelect?: React.ReactNode;
  /** Hides keys that are identical everywhere. Controlled. */
  onlyDifferences?: boolean;
  /** Initial state of "Only differences" when uncontrolled. */
  defaultOnlyDifferences?: boolean;
  onOnlyDifferencesChange?: (onlyDifferences: boolean) => void;
  /** `prefix` groups keys that share a prefix (`STRIPE_`, `AWS_`, `DATABASE_`) under collapsible rows; `none` lists keys flat. */
  groupBy?: "prefix" | "none";
  /** Collapsed group prefixes, for example ["AWS_"]. Controlled. */
  collapsed?: string[];
  /** Initially collapsed group prefixes when uncontrolled. */
  defaultCollapsed?: string[];
  onCollapsedChange?: (collapsed: string[]) => void;
  /** Extra content after a key, by key: a danger `Badge` "Shared live key" on STRIPE_SECRET_KEY. */
  annotations?: Record<string, React.ReactNode>;
  /** Called when a present cell is clicked or activated with Enter, to open that value. */
  onCellClick?: (key: string, env: string) => void;
  /** Called by the "Add" button of a missing cell. Falls back to `onCellClick`. */
  onAdd?: (key: string, env: string) => void;
  /** Height of the scroll area; the header row and the key column stay pinned while it scrolls. */
  maxHeight?: number | string;
  /** Shows skeleton rows while values load. */
  loading?: boolean;
}
export declare const CompareMatrix: React.ForwardRefExoticComponent<
  CompareMatrixProps & React.RefAttributes<HTMLDivElement>
>;
/** A 4 character hex fingerprint of a value, stable for equal values. Shown instead of the value to prove equality. */
export declare function fingerprint(value: string): string;

// CopyButton
/** Copies a value to the clipboard and confirms in place: the copy icon springs to a check for 1600ms and "Copied" is announced. */
export interface CopyButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "type"> {
  /** The text to copy, or a function (sync or async) that returns it, for values fetched on demand. */
  value: string | number | (() => string | Promise<string>);
  /** Accessible name and tooltip of the icon variant, written as the action. Defaults to "Copy value". Use "Copy command", "Copy token". */
  label?: string;
  /** Announced and shown after copying. Defaults to "Copied". */
  copiedLabel?: string;
  /** `icon` looks like `IconButton`. `text` looks like a small `Button` whose label swaps from "Copy" to "Copied" without changing width. */
  variant?: "icon" | "text";
  /** Icon: `xs` 24px in secret rows, `sm` 28px by default, `md` 32px. Text: `sm` 28px by default, `md` 32px. */
  size?: "xs" | "sm" | "md";
  /** `ghost` by default; `secondary` when it stands alone beside secondary buttons. */
  appearance?: "ghost" | "secondary";
  /** How long the check stays, in ms. Defaults to 1600. */
  timeout?: number;
  /** Forces the copied look, for when something else copied the value (the `c` shortcut) or in previews. */
  copied?: boolean;
  /** Called with the copied value after the clipboard write succeeds. Toast "Copied STRIPE_SECRET_KEY. Clipboard clears in 30s." from here. */
  onCopied?: (value: string) => void;
  /** Blocks copying, for values the person cannot reveal. */
  disabled?: boolean;
  /** Label of the text variant. Defaults to "Copy". */
  children?: React.ReactNode;
}
export declare const CopyButton: React.ForwardRefExoticComponent<
  CopyButtonProps & React.RefAttributes<HTMLButtonElement>
>;

// Dialog
/** A modal window for a focused task or a decision: a blurred overlay, a trapped focus, Escape to leave. */
export interface DialogProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the next open state on trigger click, the close button, Escape and an overlay click. */
  onOpenChange?: (open: boolean) => void;
  /** Optional element that opens the dialog on click. Focus returns to whatever was focused before opening. */
  trigger?: React.ReactElement;
  /** Heading in `title` type, labelling the dialog: "Add secret to staging", "Delete 4 secrets from production?". */
  title?: React.ReactNode;
  /** One or two sentences under the title in `text-secondary`, describing the dialog: the consequence or what happens next. */
  description?: React.ReactNode;
  /** Width from the `dialog-sm` (400), `dialog-md` (520) or `dialog-lg` (760) tokens. */
  size?: "sm" | "md" | "lg";
  /** Buttons for the footer strip, primary last: `<><Button>Cancel</Button><Button variant="primary">Add secret</Button></>`. */
  footer?: React.ReactNode;
  /** Closes when the overlay is clicked. Turn it off for forms that would lose typed input. */
  closeOnOverlay?: boolean;
  /** Hides the close button in the header. Escape still closes. */
  hideClose?: boolean;
  /** Element to focus on open. By default: an element with `data-autofocus`, else the first focusable element in the body, then in the footer. Pass false to leave focus where it is, for a dialog shown open at rest. */
  initialFocus?: React.RefObject<HTMLElement> | false;
  /** Portal target. Defaults to `document.body`. Pass an element with `transform` set to confine the dialog to a region, as the previews do; the page is then not scroll locked. */
  container?: HTMLElement | null;
  /** The body. It scrolls when taller than the viewport; the header and footer stay put. */
  children?: React.ReactNode;
}
export declare function Dialog(props: DialogProps): React.ReactElement;

/** A dialog that asks for one decision, restating the object and the consequence. */
export interface ConfirmDialogProps extends Omit<DialogProps, "footer" | "children"> {
  /** The action, verb first with the object and count: "Delete 4 secrets", "Discard 3 changes". Never "OK". */
  confirmLabel?: React.ReactNode;
  /** The way back: "Cancel" or "Keep editing". */
  cancelLabel?: React.ReactNode;
  /** `danger` makes the confirm button `danger` and focuses Cancel first. `default` uses `primary` and focuses the confirm button. */
  tone?: "default" | "danger";
  /** Text the person must type exactly before the confirm button enables, for protected environments: "production". Shows "Type production to confirm" above a mono input, which takes focus. */
  requireText?: string;
  /** Shows a spinner in the confirm button, disables Cancel and blocks closing. When given, the parent closes the dialog itself. */
  loading?: boolean;
  /** Runs on confirm (button or Enter in the input). Return a promise to show loading until it settles: the dialog closes when it resolves and stays open when it rejects. Otherwise the dialog closes at once. */
  onConfirm?: () => undefined | Promise<unknown>;
  /** Runs when the person cancels, presses Escape or clicks the overlay. */
  onCancel?: () => void;
  /** Extra content above the typed confirmation, such as the list of keys affected. */
  children?: React.ReactNode;
}
export declare function ConfirmDialog(props: ConfirmDialogProps): React.ReactElement;

// DiffView
/** One row of a two environment comparison. `added` exists only in `compare`, `removed` only in `base`. */
export interface DiffRow {
  key: string;
  status: "added" | "removed" | "changed" | "same";
  /** Value in the base environment; `undefined` when the key is missing there. */
  base?: string;
  /** Value in the compare environment; `undefined` when the key is missing there. */
  compare?: string;
}
/** What a row action asks for: copy the base value over the compare value, or add a missing key to one side. */
export type DiffAction = "copy-to-compare" | "add-to-compare" | "add-to-base";
/** Context handed to `valueRenderer` for each value cell. */
export interface DiffValueContext {
  key: string;
  /** Name of the environment this value belongs to. */
  env: string;
  side: "base" | "compare";
  /** Whether this row is revealed through the header toggle or its own reveal button. */
  revealed: boolean;
  status: DiffRow["status"];
}
/** Two environments side by side: base on the left, compare on the right, differences first, identical keys folded away. */
export interface DiffViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The environment on the left, the one you compare from, for example `staging`. */
  base: Env | string;
  /** The environment on the right, the one you compare against, for example `production`. */
  compare: Env | string;
  /** Values of `base` by key. Ignored when `rows` is given. */
  baseValues?: Record<string, string>;
  /** Values of `compare` by key. Ignored when `rows` is given. */
  compareValues?: Record<string, string>;
  /** Precomputed rows, for example from `diffEnvs(baseValues, compareValues)`. */
  rows?: DiffRow[];
  /** Controlled state of the header "Reveal values" toggle. */
  revealed?: boolean;
  /** Initial state of the header toggle when uncontrolled. */
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** Hides the identical keys, including the "Show 20 identical keys" row. Controlled. */
  onlyDifferences?: boolean;
  /** Initial state of the "Only differences" filter when uncontrolled. */
  defaultOnlyDifferences?: boolean;
  onOnlyDifferencesChange?: (onlyDifferences: boolean) => void;
  /** Whether the folded identical keys are expanded. Controlled. */
  showIdentical?: boolean;
  /** Initial expansion of the identical keys when uncontrolled. */
  defaultShowIdentical?: boolean;
  onShowIdenticalChange?: (open: boolean) => void;
  /** Hides every revealed value after this many milliseconds, following the workspace reveal timeout (10000 by default in settings). Omit to keep values revealed. */
  revealTimeout?: number;
  /** Called by the row actions: "Copy to production", "Use staging value", "Add to production". Row actions render only when this is given. */
  onAction?: (action: DiffAction, row: DiffRow) => void;
  /** Custom value cell. Return `undefined` to fall back to the masked `SecretValue` and the word highlight. */
  valueRenderer?: (value: string, context: DiffValueContext) => React.ReactNode;
  /** Extra controls at the start of the tool group, for example an environment picker. */
  toolbar?: React.ReactNode;
  /** Shows skeleton rows and "Comparing staging and production" while values load. */
  loading?: boolean;
}
export declare const DiffView: React.ForwardRefExoticComponent<DiffViewProps & React.RefAttributes<HTMLDivElement>>;
/** Compares two value maps into sorted rows with a status per key. */
export declare function diffEnvs(base: Record<string, string>, compare: Record<string, string>): DiffRow[];
/** Word level diff of two values, returned as segments with `changed` set on the parts that differ. */
export declare function diffSegments(
  a: string,
  b: string,
): { base: Array<{ text: string; changed: boolean }>; compare: Array<{ text: string; changed: boolean }> };

// DropZone
/** Where a .env file lands. `overlay` covers the page while a file is dragged over the window; `inline` is a dashed box inside empty states and the import sheet. */
export interface DropZoneProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrop"> {
  /** `overlay` listens on the whole window and appears only while a file is dragged over it; `inline` is always visible. */
  variant?: "overlay" | "inline";
  /** The environment the file will be imported into, named in the copy: "Drop .env to import into staging". */
  env?: Env | string;
  /** Called with the accepted file and its text once it is read. Nothing is saved yet: open `ImportPreview` with the parsed lines. */
  onFile?: (file: File, text: string) => void;
  /** Called with pasted text: on the focused inline zone, or anywhere on the page with `pasteAnywhere`. */
  onText?: (text: string) => void;
  /** Called when a drop or a chosen file is refused: not a text file, larger than `maxSize`, or more than one file. */
  onReject?: (file: File | null, reason: "type" | "size" | "multiple") => void;
  /** Largest accepted file in bytes. Default 1 MB. */
  maxSize?: number;
  /** Forces a visual state for documentation and tests. The zone stops listening while forced. */
  state?: "idle" | "drag-over" | "reject";
  /** Overlay only. `true` (default) renders in a portal fixed to the viewport; `false` fills the nearest positioned ancestor. */
  fixed?: boolean;
  /** Overlay only. Forces the overlay to show or hide regardless of dragging. */
  open?: boolean;
  /** Treats a paste of `KEY=value` lines anywhere on the page, outside inputs, as an import and calls `onText`. */
  pasteAnywhere?: boolean;
  /** Ignores drops and pastes. The inline zone dims; the overlay stops listening. */
  disabled?: boolean;
  /** Inline only. Shows a spinner while a dropped file is read or parsed. */
  loading?: boolean;
  /** Inline only. Text beside the spinner, for example "Reading lumen-api.env". */
  loadingLabel?: string;
  /** Overrides the reject title "Only text files up to 1 MB". */
  rejectMessage?: string;
}
export declare const DropZone: React.ForwardRefExoticComponent<DropZoneProps & React.RefAttributes<HTMLDivElement>>;
/** Checks a file against the import rules: text, one file, at most `maxSize` bytes. */
export declare function checkEnvFile(
  file: File,
  maxSize?: number,
): { ok: boolean; reason?: "type" | "size"; message?: string };

// EmptyState
/** What an empty place is for and the one step that fills it. */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Lucide icon name (20px) or a node, drawn in a 40px `bg-subtle` tile with a hairline and `--r-12` corners. */
  icon?: string | React.ReactNode;
  /** `page`: the `display-sm` title (Geist 36px, 500) of a whole page ("Start with one project"). `inline`: a `heading` title inside a table or card ("No secrets match "stripe""). */
  title?: React.ReactNode;
  /** One or two sentences in `text-secondary` that say what fills this place. */
  description?: React.ReactNode;
  /** One `primary` action and at most one more, or a single `sm` button inline ("Clear search"). */
  actions?: React.ReactNode;
  /** A left aligned slot under the actions, for a `CodeBlock` with the CLI way to do the same thing. */
  hint?: React.ReactNode;
  /** `page` has 48px vertical padding and a `display-sm` title; `inline` is compact for tables, cards and menus. */
  variant?: "page" | "inline";
  /** Element for the title: `h2` for `page`, `p` for `inline` by default. */
  titleAs?: "h1" | "h2" | "h3" | "p";
}
export declare const EmptyState: React.ForwardRefExoticComponent<EmptyStateProps & React.RefAttributes<HTMLDivElement>>;

// EnvBadge
/** The identity of an environment: its color, its lowercase name, and a lock when it is protected. */
export type EnvColor = "gray" | "blue" | "teal" | "green" | "amber" | "orange" | "rose" | "violet";
export interface Env {
  /** Lowercase slug: "development", "staging", "production", "preview". */
  name: string;
  /** One of the eight environment hues. Defaults by name: development blue, staging amber, production rose, preview violet, others gray. */
  color?: EnvColor;
  /** Protected environments require a typed confirmation to change and always show a lock. */
  protected?: boolean;
}
export interface EnvBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The environment object, or its name. */
  env?: Env | string;
  /** Overrides the environment's name. */
  name?: string;
  /** Overrides the environment's color. */
  color?: EnvColor;
  /** Overrides `env.protected`. */
  protected?: boolean;
  /** `soft` chip by default; `outline` on busy grounds; `dot` for dense lists, name only with the dot. */
  variant?: "soft" | "outline" | "dot";
  size?: "sm" | "md";
  /** Optional count after the name, for example the number of secrets. */
  count?: number;
}
export declare function EnvBadge(props: EnvBadgeProps): React.ReactElement;
export interface EnvDotProps {
  color?: EnvColor;
  size?: number;
  className?: string;
}
/** The environment's color as a round dot, for tabs, menus and matrix headers. */
export declare function EnvDot(props: EnvDotProps): React.ReactElement;
/** Resolves an environment's hue from its `color` or its name. */
export declare function envColor(env: Env | string): EnvColor;
export declare const ENV_COLORS: EnvColor[];
export declare const DEFAULT_ENV_COLOR: Record<string, EnvColor>;

// EnvEditor
/** One KEY=value pair found by `parseDotenv`. */
export interface DotenvEntry {
  key: string;
  /** The value with quotes removed; escaped \n in double quotes become newlines. */
  value: string;
  /** 1-based line where the entry starts. */
  line: number;
  /** 1-based line where it ends (after a multi-line quoted value). */
  endLine: number;
  /** The quote the value used, or null when unquoted. */
  quote: '"' | "'" | "`" | null;
  /** The line started with `export `. */
  exported: boolean;
  /** Text of a trailing `# comment`, or null. */
  comment: string | null;
  /** The key appears more than once; the last one wins. */
  duplicate: boolean;
}
/** A line `parseDotenv` could not use. */
export interface DotenvError {
  line: number;
  code: "missing-equals" | "invalid-key" | "empty-key" | "unclosed-quote";
  /** What happened and what to do: "No "=" on this line. Write it as OPENAI_API_KEY=value." */
  message: string;
  /** The raw line. */
  raw: string;
  key?: string;
  value?: string;
}
/** One highlighted line, for editors and import previews. Its tokens join back into `text` exactly. */
export interface DotenvLine {
  n: number;
  text: string;
  kind: "blank" | "comment" | "entry" | "continuation" | "invalid";
  tokens: Array<{
    t: "space" | "comment" | "keyword" | "key" | "key-error" | "punct" | "quote" | "value" | "ref" | "error";
    s: string;
    key?: string;
  }>;
  issue: { level: "error" | "warning"; code: string; message: string } | null;
}
export interface DotenvParseResult {
  /** Valid entries in file order, duplicates included. */
  entries: DotenvEntry[];
  errors: DotenvError[];
  /** Keys set more than once, with every line that sets them. */
  duplicates: Array<{ key: string; lines: number[] }>;
  lines: DotenvLine[];
  /** Number of distinct valid keys. */
  keys: number;
  /** Number of lines with an error or a warning. */
  issues: number;
}
/** Parses dotenv text: comments, blank lines, `export KEY=`, single, double and backtick quotes (multi-line allowed, escapes in double quotes), inline `# comments` after unquoted values, `${REF}` tokens, invalid lines and duplicates. Pure. */
export declare function parseDotenv(text: string): DotenvParseResult;

/** The raw .env editor of an environment: a highlighted, line numbered text surface that flags invalid lines and duplicates as you type. */
export interface EnvEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** Controlled text. */
  value?: string;
  /** Initial text when uncontrolled. */
  defaultValue?: string;
  /** Called with the full text on every edit. */
  onValueChange?: (text: string) => void;
  /** Controlled values hidden mode: values show as 12 dots, the editor is read only, and "Reveal values to edit" appears. */
  valuesHidden?: boolean;
  /** Initial values hidden mode when uncontrolled. */
  defaultValuesHidden?: boolean;
  /** Called by "Reveal values to edit" (false) and by the "Hide values" button in the status bar (true). */
  onValuesHiddenChange?: (hidden: boolean) => void;
  /** Keeps the text selectable but not editable, for Viewers. */
  readOnly?: boolean;
  /** Environment, used in the accessible name "Raw .env for staging". */
  env?: Env | string;
  placeholder?: string;
  /** Minimum visible lines. Default 8. */
  minLines?: number;
  /** Height before the editor scrolls, as a CSS length or px number. Default 480. */
  maxHeight?: number | string;
  /** Called with the parse result whenever the text changes. */
  onParsed?: (result: DotenvParseResult) => void;
  "aria-label"?: string;
}
export declare const EnvEditor: React.ForwardRefExoticComponent<
  EnvEditorProps & React.RefAttributes<HTMLTextAreaElement>
>;

// EnvSwitcher
/** An environment in the switcher: its identity plus the number of secrets in it. */
export interface EnvSwitcherItem extends Env {
  /** Number of secrets, shown after the name in `caption` `text-tertiary`. */
  count?: number;
}
/** Switches between a project's environments: tabs with an underline in the environment's own color, or a compact select for tight headers. */
export interface EnvSwitcherProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** The project's environments in display order, or their names. */
  environments: Array<EnvSwitcherItem | string>;
  /** Controlled active environment name. */
  value?: string;
  /** Initial environment when uncontrolled. Defaults to the first. */
  defaultValue?: string;
  /** Called with the environment name the person switches to. */
  onValueChange?: (name: string) => void;
  /** `tabs` (default) for the environment panel header; `select` renders a ghost trigger (dot, name, lock, chevrons-up-down) with a listbox, for tight headers and toolbars. */
  mode?: "tabs" | "select";
  /** Shows a "+" icon button after the tabs (and an "Add environment" item in the select) that calls this. */
  onAdd?: () => void;
  /** Label of the add action. Default "Add environment". */
  addLabel?: string;
  /** Shows secret counts after the names. Default true. */
  showCounts?: boolean;
  /** `auto` switches as arrow keys move focus; `manual` waits for Enter or Space. Default `auto`. */
  activation?: "auto" | "manual";
  /** Prefix for tab ids. Tab `${idPrefix}-tab-${name}` controls the panel with id `${idPrefix}-panel-${name}`. */
  idPrefix?: string;
  /** Accessible name of the tab list. Default "Environments". */
  "aria-label"?: string;
}
export declare const EnvSwitcher: React.ForwardRefExoticComponent<
  EnvSwitcherProps & React.RefAttributes<HTMLDivElement>
>;

// Field
/** A label, an optional hint or error, and one control, wired together for assistive technology. */
export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The field's name in `small-medium`, sentence case: "Key", "Reveal timeout". */
  label?: React.ReactNode;
  /** Guidance under the control in `caption`, `text-tertiary`. Hidden while there is an `error`. */
  hint?: React.ReactNode;
  /** What went wrong and what to do, in `caption`, `danger`, with a `circle-alert` icon. Replaces the hint and marks the control invalid. */
  error?: React.ReactNode;
  /** A line under the label, for settings rows in the horizontal layout. */
  description?: React.ReactNode;
  /** Adds a quiet asterisk after the label and `aria-required` on the control. */
  required?: boolean;
  /** Adds "Optional" after the label. Use it instead of `required` when most fields in a form are required. */
  optional?: boolean;
  /** A slot at the right of the hint row, for a count such as "42 / 280" or "3 of 24 keys". */
  counter?: React.ReactNode;
  /** `vertical` stacks label over control. `horizontal` puts the label in a 200px column on the left for settings pages, and stacks again when the field is narrower than 640px. */
  layout?: "vertical" | "horizontal";
  /** Dims the label and passes `disabled` to the control. */
  disabled?: boolean;
  /** Id for the control. Defaults to the child's `id`, or a generated one. */
  id?: string;
  /** Exactly one control. Field clones it with `id`, `aria-describedby`, `aria-invalid`, `aria-required`, and for design system components `invalid` and `aria-labelledby`. */
  children: React.ReactElement;
}
export declare function Field(props: FieldProps): React.ReactElement;

// ImportPreview
/** One parsed line of an import, classified against the target environment. */
export interface ImportRow {
  /** Stable id, the line number as a string by default. */
  id: string;
  /** 1 based line number in the pasted or dropped text. */
  line: number;
  key: string;
  value: string;
  status: "new" | "changed" | "unchanged" | "invalid" | "duplicate";
  /** The value already in the target environment, for `changed` and `unchanged` rows. */
  current?: string;
  /** Why an `invalid` line cannot be imported, completing "Line 14: ...". */
  reason?: string;
  /** For `duplicate` rows, the later line with the same key that wins. */
  otherLine?: number;
}
/** A parsed entry before classification, as a dotenv parser returns it. */
export interface ImportEntry {
  line?: number;
  key: string;
  value: string;
  /** A parser error for this line; marks it invalid. */
  error?: string;
}
/** Everything the footer needs to label the import button. */
export interface ImportSummary {
  /** Secrets that will be written: selected new rows plus changed rows set to Overwrite. */
  selected: number;
  selectable: number;
  counts: Record<ImportRow["status"], number>;
  env: string;
  selectedIds: string[];
}
/** The review step of an import: every parsed line of a .env with its status, a per conflict choice, and the count that will be written. */
export interface ImportPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The environment the secrets are imported into. */
  env: Env | string;
  /** Classified rows, for example from `classifyImport(entries, existing)`. */
  rows?: ImportRow[];
  /** Raw .env text, parsed with the shared dotenv parser and classified against `existing` when `rows` and `entries` are not given. */
  text?: string;
  /** Parsed entries to classify against `existing` when `rows` is not given. */
  entries?: ImportEntry[];
  /** Current values of the target environment by key, used with `entries`. */
  existing?: Record<string, string>;
  /** Controlled ids of the rows that will be imported. Changed rows in this list are overwritten, changed rows outside it are skipped. */
  selected?: string[];
  /** Initial selection when uncontrolled. Defaults to every new and changed row. */
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Controlled state of "Reveal values" in the header. */
  revealed?: boolean;
  defaultRevealed?: boolean;
  onRevealedChange?: (revealed: boolean) => void;
  /** The status chip that filters the list, or `null` for every line. Controlled. */
  filter?: ImportRow["status"] | null;
  defaultFilter?: ImportRow["status"] | null;
  onFilterChange?: (status: ImportRow["status"] | null) => void;
  /** Whether the folded unchanged rows are expanded. Controlled. */
  showUnchanged?: boolean;
  defaultShowUnchanged?: boolean;
  onShowUnchangedChange?: (open: boolean) => void;
  /** Footer content, or a function of the live summary that returns it: `(s) => <Button variant="primary">Import {s.selected} secrets into {s.env}</Button>`. */
  footer?: React.ReactNode | ((summary: ImportSummary) => React.ReactNode);
  /** Custom value rendering. Return `undefined` to use the masked `SecretValue`. */
  valueRenderer?: (
    value: string,
    context: { key: string; side: "current" | "new"; revealed: boolean },
  ) => React.ReactNode;
  /** Shows "Parsing .env" and skeleton rows. */
  loading?: boolean;
}
export declare const ImportPreview: React.ForwardRefExoticComponent<
  ImportPreviewProps & React.RefAttributes<HTMLDivElement>
>;
/** Classifies parsed entries against the target environment: invalid keys, earlier duplicates, new, changed and unchanged. */
export declare function classifyImport(entries: ImportEntry[], existing: Record<string, string>): ImportRow[];

// Input
/** A single line text control. The ring, icon and affixes live on a wrapper; every other prop lands on the native input. */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  /** `sm` 28px in toolbars and inline edits, `md` 32px by default, `lg` 40px on auth and onboarding. */
  size?: "sm" | "md" | "lg";
  /** Leading Lucide icon name, drawn in `text-tertiary` and lifted to `text-secondary` on focus. */
  icon?: string;
  /** Text or node before the value, flush with it, for example "https://" or "$". */
  prefix?: React.ReactNode;
  /** Text or node after the value, pinned to the right, for example "MB" or "12 of 24". */
  suffix?: React.ReactNode;
  /** Draws the `danger` ring and sets `aria-invalid`. `Field` sets it for you when it has an `error`. */
  invalid?: boolean;
  /** Sets the value in Geist Mono for keys, values, slugs and tokens. Turns off spellcheck and autocapitalize. */
  mono?: boolean;
  /** Shows an `x` button while there is a value. Clearing fires `onChange` with an empty value and keeps focus. */
  clearable?: boolean;
  /** Accessible name of the clear button. Defaults to "Clear". */
  clearLabel?: string;
  /** Called after the clear button empties the field. */
  onClear?: () => void;
  /** Shortcut hint shown at the right while the field is empty and unfocused, for example "/". */
  kbd?: string | string[];
  /** Shows a `Spinner` at the right, for async checks such as slug availability. */
  loading?: boolean;
  /** Accessible name of the loading spinner. Defaults to "Loading". */
  loadingLabel?: string;
  /** With `type="password"`, adds a "Reveal value" toggle that switches the field to plain text. */
  revealable?: boolean;
  /** Selects the whole value on focus, for read only values people copy (tokens, CLI commands). */
  selectOnFocus?: boolean;
  /** Keeps the value selectable and copyable but not editable, on `bg-subtle`. */
  readOnly?: boolean;
  /** Drops to `fill` with `text-disabled` and ignores input. Say why nearby. */
  disabled?: boolean;
  /** The value. Controlled; pair with `onChange` or `onValueChange`. */
  value?: string | number;
  /** The initial value when uncontrolled. */
  defaultValue?: string | number;
  /** Called with the new string on every change, after `onChange`. */
  onValueChange?: (value: string) => void;
  /** Class name for the wrapper that draws the ring. */
  className?: string;
  /** Inline style for the wrapper, for example a fixed width. */
  style?: React.CSSProperties;
}
export declare const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>;

// InsightRow
/** The fix action of an insight: a label, an optional icon, and what it does. */
export interface InsightAction {
  /** Verb first: "Rotate key", "Add to production", "Review". */
  label: string;
  /** Leading Lucide icon name. */
  icon?: string;
  /** Trailing Lucide icon name, for example "arrow-right" when it navigates. */
  iconRight?: string;
  onClick?: (event: React.MouseEvent) => void;
  /** Renders the action as a link. */
  href?: string;
}
/** A health finding with its evidence and one fix: a live key outside production, a missing key, a rotation that is due, values shared between environments. */
export interface InsightRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `danger` (circle-alert) for exposure, `warning` (triangle-alert) for drift and overdue rotation, `info` for things worth a look. */
  severity?: "danger" | "warning" | "info";
  /** One sentence that names the problem: "Staging uses a live Stripe key". */
  title: React.ReactNode;
  /** What it means and what to do, one or two sentences. Keys inside go in `code`. */
  description?: React.ReactNode;
  /** Affected keys, shown as mono chips. */
  keys?: string[];
  /** Affected environments, shown as `EnvBadge`s (compact: `EnvDot`s). */
  envs?: Array<Env | string>;
  /** The fix: an `InsightAction` rendered as a secondary button (ghost in compact), or any node. */
  action?: InsightAction | React.ReactNode;
  /** Shows the `x` "Dismiss" button. */
  onDismiss?: (event: React.MouseEvent) => void;
  /** Shows the `bell-off` "Snooze for 7 days" button. */
  onSnooze?: (event: React.MouseEvent) => void;
  /** Slot after the buttons, for example a `Menu` with snooze durations. */
  menu?: React.ReactNode;
  /** `default` is the full row on the Health page; `compact` is one line for the project overview. */
  variant?: "default" | "compact";
}
export declare const InsightRow: React.ForwardRefExoticComponent<InsightRowProps & React.RefAttributes<HTMLDivElement>>;

// Logo
/** The secmgr mark: two equal rings, centres one radius apart, woven over and under. Draws in `currentColor`. */
export interface MarkProps extends Omit<React.SVGAttributes<SVGSVGElement>, "stroke"> {
  /** Rendered width and height in px (or any CSS length). 16 in favicons and tight rows, 24 by default, 32 and up in headers and splash screens. */
  size?: number | string;
  /** Accessible name. Omit when the mark sits beside the word "secmgr" or is decorative. */
  title?: string;
  /** Ring stroke in the 32 unit grid. Leave at 2 to match the published logo. */
  stroke?: number;
}
/** The mark as an inline SVG with unique mask ids, safe to render many times on one page. */
export declare function Mark(props: MarkProps): React.ReactElement;

/** The mark followed by "secmgr" set in Geist 500 at -0.035em, proportioned like `secmgr-wordmark.svg`. */
export interface WordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Font size of the word in px. The mark is 1.28 times this size and sits 0.4em before the word, with the x-height centred on the rings. 16 in the sidebar, 20 by default, 24 to 48 on marketing pages. */
  size?: number;
  /** Accessible name for the whole lockup. Defaults to "secmgr". */
  title?: string;
}
export declare function Wordmark(props: WordmarkProps): React.ReactElement;

/** The rings on a `primary` tile with smoothed `--r-12` corners scaled to the tile. */
export interface AppIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Tile size in px. 20 in the workspace switcher, 32 by default, 48 and 96 in onboarding and the homepage. Tiles of 24px and under draw a larger mark with a heavier ring so it stays legible. */
  size?: number;
  /** Accessible name. Omit when the tile sits beside the workspace or product name. */
  title?: string;
}
export declare function AppIcon(props: AppIconProps): React.ReactElement;

// Menu
/** A dropdown menu of actions opened from a trigger. Full keyboard support: arrows with wrap, Home and End, typeahead, Enter and Space, Escape and Tab. */
export interface MenuProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The element that opens the menu: usually an `IconButton` "More actions" or a ghost `Button`. It receives `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` and an id the menu is labelled by. */
  trigger?: React.ReactElement;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the next open state on trigger click, selection, Escape, Tab and outside click. */
  onOpenChange?: (open: boolean) => void;
  /** Side of the trigger to open on. Flips when there is no room. */
  side?: "top" | "bottom";
  /** Alignment along the side: `end` for row actions at the right edge. */
  align?: "start" | "center" | "end";
  /** Gap between the trigger and the menu in px. */
  offset?: number;
  /** Moves focus into the menu on open: the first item when opened from the keyboard, the panel when opened by pointer. Set false for a menu shown open at rest. */
  autoFocus?: boolean;
  /** Items, labels, separators, groups and submenus. */
  children?: React.ReactNode;
}
export declare function Menu(props: MenuProps): React.ReactElement;

/** The event passed to `onSelect`. Call `preventDefault()` to keep the menu open. */
export interface MenuSelectEvent {
  defaultPrevented: boolean;
  preventDefault(): void;
  nativeEvent: Event;
}

export interface MenuItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Leading Lucide icon name, or a node such as `<EnvDot color="amber" />`. */
  icon?: string | React.ReactNode;
  /** The action, verb first: "Copy value", "Show history". Falls back to `children`. */
  label?: React.ReactNode;
  /** A second line in `caption` `text-tertiary` for consequences: "Expires after one view or 24 hours". */
  description?: React.ReactNode;
  /** Shortcut shown at the right, for example "e" or ["mod", "c"] or ["g", "s"]. */
  kbd?: string | string[];
  /** `danger` for destructive actions: `danger` text, `danger-soft` highlight. Put them last, after a separator. */
  tone?: "default" | "danger";
  /** Skipped by the keyboard and not selectable. */
  disabled?: boolean;
  /** Runs on click, Enter or Space. */
  onSelect?: (event: MenuSelectEvent) => void;
  /** Closes the whole menu after `onSelect` unless it called `preventDefault()`. */
  closeOnSelect?: boolean;
  /** Text used by typeahead when `label` is not a string. */
  textValue?: string;
  children?: React.ReactNode;
}
export declare const MenuItem: React.ForwardRefExoticComponent<MenuItemProps & React.RefAttributes<HTMLDivElement>>;

export interface MenuCheckboxItemProps extends Omit<MenuItemProps, "icon" | "tone"> {
  /** Draws a check in the icon slot and sets `aria-checked`. */
  checked?: boolean;
  /** Called with the next checked state on select. */
  onCheckedChange?: (checked: boolean) => void;
}
/** An item that toggles a setting. Keeps the menu open by default so several can be toggled. */
export declare const MenuCheckboxItem: React.ForwardRefExoticComponent<
  MenuCheckboxItemProps & React.RefAttributes<HTMLDivElement>
>;

export interface MenuRadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The selected item's `value`. */
  value?: string;
  /** Called with the chosen item's `value`. */
  onValueChange?: (value: string) => void;
  /** Accessible name of the group; pair it with a visible `MenuLabel`. */
  label?: string;
  children?: React.ReactNode;
}
/** Groups `MenuRadioItem`s so exactly one is chosen. */
export declare function MenuRadioGroup(props: MenuRadioGroupProps): React.ReactElement;

export interface MenuRadioItemProps extends Omit<MenuItemProps, "tone"> {
  /** Value reported to the group. */
  value: string;
}
/** One choice in a `MenuRadioGroup`; the chosen one shows a dot at the right. */
export declare const MenuRadioItem: React.ForwardRefExoticComponent<
  MenuRadioItemProps & React.RefAttributes<HTMLDivElement>
>;

export interface MenuSubProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Leading Lucide icon name or node. */
  icon?: string | React.ReactNode;
  /** Label of the submenu trigger: "Copy to environment". */
  label: React.ReactNode;
  /** Second line under the label. */
  description?: React.ReactNode;
  disabled?: boolean;
  /** Opens the submenu at rest, for documentation. */
  defaultOpen?: boolean;
  /** Text used by typeahead when `label` is not a string. */
  textValue?: string;
  /** The submenu's items. */
  children?: React.ReactNode;
}
/** An item that opens a nested menu on hover after 100ms, ArrowRight, Enter or Space, and closes it on ArrowLeft or Escape. */
export declare function MenuSub(props: MenuSubProps): React.ReactElement;

/** A hairline between groups of items. */
export declare function MenuSeparator(props: React.HTMLAttributes<HTMLDivElement>): React.ReactElement;

/** An overline heading for a group of items: the object the menu acts on, or the group's name. */
export declare function MenuLabel(props: React.HTMLAttributes<HTMLDivElement>): React.ReactElement;

// PageHeader
/** The top of a page inside the panel: title, one line of context, status, actions, and optional tabs on a hairline that runs edge to edge. */
export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Page title in `title-lg`: a noun ("Access tokens") or the exact slug of the thing (`lumen-api`). */
  title: React.ReactNode;
  /** One line in `small` `text-secondary` that says what is here or states the numbers. */
  description?: React.ReactNode;
  /** A Lucide icon name drawn in a 32px `bg-subtle` tile with a hairline, or any leading node (an `AppIcon`, an `Avatar`). */
  icon?: string | React.ReactNode;
  /** Badges beside the title: `EnvBadge`, `Badge` ("Protected", "Rotation due"). */
  meta?: React.ReactNode;
  /** Buttons at the right, `primary` last. They move under the title when the header is narrower than 640px. */
  actions?: React.ReactNode;
  /** A `Tabs` with `variant="underline"`, drawn under the header with its hairline across the full width. */
  tabs?: React.ReactNode;
  /** Drops the 32px side padding when the header sits inside an already padded column. */
  flush?: boolean;
  /** Heading element for the title. `h1` by default. */
  titleAs?: "h1" | "h2" | "h3";
}
export declare const PageHeader: React.ForwardRefExoticComponent<PageHeaderProps & React.RefAttributes<HTMLElement>>;

// Popover
/** A floating panel anchored to a trigger, for small tools that need interaction: filters, a share link, a rotation policy. */
export interface PopoverProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The element that toggles the popover on click. It receives `aria-haspopup`, `aria-expanded` and `aria-controls`. Omit it and pass `anchorRef` with a controlled `open` to anchor anywhere. */
  trigger?: React.ReactElement;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the next open state on trigger click, outside click, Escape and `PopoverClose`. */
  onOpenChange?: (open: boolean) => void;
  /** Element to anchor to when there is no `trigger`, or to anchor somewhere other than the trigger. Focus returns here on close when there is no trigger. */
  anchorRef?: React.RefObject<HTMLElement>;
  /** Side of the anchor to open on. Flips when there is no room. */
  side?: "top" | "bottom" | "left" | "right";
  /** Alignment along the side. */
  align?: "start" | "center" | "end";
  /** Gap between the anchor and the panel in px. */
  offset?: number;
  /** Moves focus to the first focusable element in the panel (or the panel itself) on open. Set false for a popover shown open at rest. */
  autoFocus?: boolean;
  /** Panel content. Keep it to one small task. */
  children?: React.ReactNode;
}
/** Opens and closes one `Popover`. */
export declare function Popover(props: PopoverProps): React.ReactElement;
export interface PopoverCloseProps {
  /** One element; its `onClick` also closes the surrounding popover. */
  children: React.ReactElement;
}
/** Wraps a button inside a popover so that clicking it closes the popover and returns focus to the trigger. */
export declare function PopoverClose(props: PopoverCloseProps): React.ReactElement;
/** Reads the surrounding popover: `{ open, close }`, or null outside one. */
export declare function usePopover(): { open: boolean; close: () => void } | null;

// Progress
/** A 4px bar for work with a known length (determinate) or an unknown one (indeterminate), with an optional label, value text and hint. */
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Current value between 0 and `max`. Leave it out, or set `indeterminate`, when the length is unknown. */
  value?: number;
  /** Defaults to 100. Use the real total, for example 24 lines. */
  max?: number;
  /** Slides a 40 percent bar back and forth instead of filling. */
  indeterminate?: boolean;
  /** What is happening, in `small-medium`: "Importing .env to staging". Tones add their icon. */
  label?: React.ReactNode;
  /** Text at the right in tabular numbers, for example "12 of 24". Also the spoken value when it is a string. */
  valueLabel?: React.ReactNode;
  /** Shows the rounded percent at the right when there is no `valueLabel`. */
  showValue?: boolean;
  /** A line under the bar in `caption`: what happens next, or what went wrong. */
  hint?: React.ReactNode;
  /** `neutral` fills with `text`. `success`, `warning` and `danger` fill with their token and add `circle-check`, `triangle-alert` or `circle-alert` to the label. */
  tone?: "neutral" | "success" | "warning" | "danger";
  /** Accessible name when there is no visible `label`. */
  "aria-label"?: string;
}
export declare function Progress(props: ProgressProps): React.ReactElement;

// ProjectCard
/** An environment summary on a project card: its identity and how many secrets it holds. */
export interface ProjectCardEnv extends Env {
  /** Number of secrets in this environment. */
  count?: number;
}
/** A project in the projects list: name, linked repo, environments with counts, health and the latest change. The whole card opens the project. */
export interface ProjectCardProps extends React.HTMLAttributes<HTMLElement> {
  /** `grid` is a card in the projects grid; `row` is a dense line in the list view. */
  variant?: "grid" | "row";
  /** Project slug, for example `lumen-api`. */
  name: string;
  /** Linked repository as `owner/name`, for example `lumen-labs/lumen-api`. */
  repo?: string;
  /** Environments in their project order, each with a secret count. */
  envs?: ProjectCardEnv[];
  /** Open health issues. `0` shows "Healthy"; more shows "2 issues" in `warning`. */
  issues?: number;
  /** Replaces the health line, for example a danger "Live key in staging". */
  health?: React.ReactNode;
  /** The latest change as a sentence: "Priya changed 3 secrets in staging". */
  activity?: React.ReactNode;
  /** When `activity` happened, relative: "4 min ago". */
  time?: string;
  /** Controlled star state. */
  starred?: boolean;
  /** Initial star state when uncontrolled. */
  defaultStarred?: boolean;
  onStarredChange?: (starred: boolean) => void;
  /** Slot after the star, usually a `Menu` trigger with Rename, Archive and Delete. */
  menu?: React.ReactNode;
  /** Link to the project; the whole card becomes the link. */
  href?: string;
  /** Called when the card is activated, when there is no `href`. */
  onOpen?: (event: React.MouseEvent) => void;
  /** Shows a skeleton of the card while projects load. */
  loading?: boolean;
}
export declare const ProjectCard: React.ForwardRefExoticComponent<ProjectCardProps & React.RefAttributes<HTMLElement>>;

// RadioGroup
/** One choice in a `RadioGroup`. */
export interface RadioOption {
  /** The value passed to `onValueChange`. Unique within the group. */
  value: string;
  /** The choice, written as the outcome: "Overwrite 3 secrets", "Skip conflicts". */
  label: React.ReactNode;
  /** A line under the label in `small`, `text-secondary`, saying what happens. */
  description?: React.ReactNode;
  /** Leading Lucide icon name beside the label. */
  icon?: string;
  /** Not selectable and skipped by the arrow keys. */
  disabled?: boolean;
  /** Class name for the option, for example a forced state class in previews. */
  className?: string;
}
/** A single choice from a short list, as dots or as bordered choice cards. */
export interface RadioGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** Options as objects, or plain strings for simple lists. */
  options: Array<RadioOption | string>;
  /** The selected value, or `null` for none. Controlled. */
  value?: string | null;
  /** The initially selected value when uncontrolled. */
  defaultValue?: string | null;
  /** Called with the new value when a choice is made. */
  onValueChange?: (value: string) => void;
  /** `list` shows dots with labels. `cards` shows bordered choice cards for consequential choices such as import conflicts. */
  variant?: "list" | "cards";
  /** `vertical` stacks the choices. `horizontal` puts them in a row, and cards wrap to one column when narrow. Arrow keys work in both directions either way. */
  orientation?: "vertical" | "horizontal";
  /** Adds a hidden input with this name so the value submits with a form. */
  name?: string;
  /** Disables every choice. */
  disabled?: boolean;
  /** Draws unselected dots and cards with a `danger` ring. `Field` sets it for you when it has an `error`. */
  invalid?: boolean;
}
export declare const RadioGroup: React.ForwardRefExoticComponent<RadioGroupProps & React.RefAttributes<HTMLDivElement>>;

// SearchField
/** A search box: an `Input` with a search icon, a "/" shortcut, a clear button, a result count and a debounced `onSearch`. */
export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix" | "value" | "defaultValue"> {
  /** The query. Controlled; pair with `onValueChange`. */
  value?: string;
  /** The initial query when uncontrolled. */
  defaultValue?: string;
  /** Called with the query on every keystroke, for filtering in place. */
  onValueChange?: (value: string) => void;
  /** Called with the query after typing pauses for `debounce` ms, at once on Enter, and with "" when cleared. */
  onSearch?: (query: string) => void;
  /** Milliseconds to wait before `onSearch`. Defaults to 150; 0 calls it on every keystroke. */
  debounce?: number;
  /** A key that focuses the field from anywhere on the page, shown as a `Kbd` hint while empty. Defaults to "/". Pass `false` to turn it off. */
  hotkey?: string | false;
  /** Number of matches. With a query, shows "12 of 24" (with `total`) or "12 results" at the right and announces it politely. */
  count?: number;
  /** Number of items searched, for "12 of 24". */
  total?: number;
  /** Singular noun for the spoken and fallback count: "secret" gives "3 secrets found". Defaults to "result". */
  noun?: string;
  /** Replaces the visible count with any text or node while there is a query. */
  resultLabel?: React.ReactNode;
  /** Defaults to "Search". Name what is searched: "Search secrets", "Search 5 projects". */
  placeholder?: string;
  /** `sm` 28px in toolbars, `md` 32px by default, `lg` 40px. */
  size?: "sm" | "md" | "lg";
  /** Shows a spinner in place of the clear button while results load. */
  loading?: boolean;
  /** Accessible name of the clear button. Defaults to "Clear search". */
  clearLabel?: string;
  /** Called after the clear button or Escape empties the field. */
  onClear?: () => void;
  /** Class name for the wrapper that draws the ring. */
  className?: string;
  /** Inline style for the wrapper, for example a fixed width in a toolbar. */
  style?: React.CSSProperties;
}
export declare const SearchField: React.ForwardRefExoticComponent<
  SearchFieldProps & React.RefAttributes<HTMLInputElement>
>;

// SecretInput
/** The value editor for a secret: mono, maskable, multiline for certificates and JSON, with `${KEY}` suggestions. */
export interface SecretInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "size" | "onChange"> {
  /** Controlled value. */
  value?: string;
  /** Initial value when uncontrolled. */
  defaultValue?: string;
  /** Called with the next value on every edit and suggestion insert. */
  onValueChange?: (value: string) => void;
  /** Controlled mask state. `false` masks the characters with dots. */
  revealed?: boolean;
  /** Initial mask state when uncontrolled. Default false. `SecretRow` passes the row's reveal state so you edit what you saw. */
  defaultRevealed?: boolean;
  /** Called when the eye toggle changes the mask state. */
  onRevealedChange?: (revealed: boolean) => void;
  /** Controlled multiline preference. A value that contains newlines is always multiline. */
  multiline?: boolean;
  /** Initial multiline preference when uncontrolled. */
  defaultMultiline?: boolean;
  /** Called when the multiline toggle flips. */
  onMultilineChange?: (multiline: boolean) => void;
  /** Keys that `${` can reference, usually every other key in the environment. Strings or objects with a `key`. */
  keys?: Array<string | { key: string }>;
  /** Draws the `danger` ring and sets `aria-invalid`. */
  invalid?: boolean;
  disabled?: boolean;
  /** Keeps the value selectable on a `bg-subtle` ground. */
  readOnly?: boolean;
  /** `md` 32px by default, `sm` 28px inside compact rows. */
  size?: "sm" | "md";
  placeholder?: string;
  /** Rows before a multiline value scrolls. Default 8. */
  maxRows?: number;
}
export declare const SecretInput: React.ForwardRefExoticComponent<
  SecretInputProps & React.RefAttributes<HTMLInputElement | HTMLTextAreaElement>
>;
/** Used by rotation. A random value of `bytes` bytes from `crypto.getRandomValues`, base64url encoded without padding. */
export declare function generateSecretValue(bytes?: number): string;

// SecretKeyInput
/** The key field: mono, normalises as you type (letters uppercase; spaces, dashes and dots to underscores; everything else dropped), validates, and hands a pasted .env block to the import flow. */
export interface SecretKeyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "size" | "onChange"> {
  /** Controlled key. Always normalised. */
  value?: string;
  /** Initial key when uncontrolled. */
  defaultValue?: string;
  /** Called with the normalised key on every edit. */
  onValueChange?: (key: string) => void;
  /** Keys already in the environment, for the duplicate check. */
  existingKeys?: string[];
  /** Environment slug named in the duplicate message: "DATABASE_URL already exists in staging." */
  env?: string;
  /** The key being renamed. It does not count as a duplicate of itself. */
  original?: string;
  /** An external error that replaces the built in validation message. */
  error?: string;
  /** Shows the "empty" error before the field has been blurred, for example after a Save attempt. */
  showErrors?: boolean;
  /** Called with the visible error message, or null when the key is valid. */
  onErrorChange?: (message: string | null) => void;
  /** Called when a multi-line KEY=value block is pasted; the paste is cancelled so the app can open the import sheet. */
  onPasteEnv?: (text: string, parsed: DotenvParseResult) => void;
  /** Called when a single `KEY=value` line is pasted; the key fills this field and the app fills the value. */
  onPastePair?: (pair: { key: string; value: string }) => void;
  /** Forces the `danger` ring without a message. */
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** `md` 32px by default, `sm` 28px inside compact rows. */
  size?: "sm" | "md";
  placeholder?: string;
  /** `inline` puts the hint or error under the field (forms and dialogs); `floating` lays it over the content below (table rows). */
  messagePlacement?: "inline" | "floating";
  /** Milliseconds the "Converted to DATABASE_URL" hint stays after the last change. Default 2400. */
  hintDuration?: number;
}
export declare const SecretKeyInput: React.ForwardRefExoticComponent<
  SecretKeyInputProps & React.RefAttributes<HTMLInputElement>
>;
/** Uppercases letters, turns spaces, dashes and dots into underscores and drops everything else. */
export declare function normalizeKey(raw: string): string;
/** Returns null for a valid key, or the problem with its message: empty, starts with a digit, invalid characters, or a duplicate. */
export declare function validateKey(
  key: string,
  options?: { existingKeys?: string[]; env?: string; original?: string },
): { code: "empty" | "digit" | "invalid" | "duplicate"; message: string } | null;

// SecretRow
/** One secret as the table holds it. */
export interface Secret {
  /** Stable row id. Defaults to `key`; give new unsaved rows an id so they survive a rename. */
  id?: string;
  /** Uppercase key, for example "DATABASE_URL". Empty for a new row being typed. */
  key: string;
  /** The plain value. May contain newlines and `${KEY}` references. */
  value?: string;
  /** A short note shown as a sticky-note icon after the key, with the text as its tooltip. */
  note?: string;
  /** `false` for plain config (LOG_LEVEL, AWS_REGION): shown unmasked and never auto hidden. Default true. */
  sensitive?: boolean;
  /** Name of the member who last changed it, or an object with `name`. Rows show the first name. */
  updatedBy?: string | { name: string };
  /** When it last changed: a Date, a timestamp, an ISO string ("4 min ago", "yesterday at 18:32", "Sep 12"), or preformatted text shown as is. */
  updatedAt?: Date | number | string;
  /** Rotation due: `true`, or `{ age: 214, every: 90 }` to explain it in the badge tooltip. */
  rotationDue?: boolean | { age: number; every?: number };
  /** Environment slugs where this key is missing: shows "Missing in production" in `danger`. */
  missingIn?: string[];
  /** Keys this value references, for the detail sheet and health checks. */
  references?: string[];
  /** Staged state: `added` (green mark and "New"), `modified` (amber mark and "Edited"), `deleted` (struck through, dimmed, Undo). */
  status?: "unchanged" | "added" | "modified" | "deleted";
}

/** One row of the secrets table: checkbox, key with badges, masked value, who and when, and hover actions. Edits inline. */
export interface SecretRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onCopy"> {
  /** Blocks inline editing: no double click, no `e`. Use when the viewer cannot write to the environment. */
  readOnly?: boolean;
  /** Hides the value entirely: no reveal, no copy. Use when the viewer can see key names but not values. */
  locked?: boolean;
  secret: Secret;
  /** Environment slug, used in messages such as "DATABASE_URL already exists in staging." Inherited inside `SecretTable`. */
  env?: string;
  /** Shows the selection checkbox. Default true. */
  selectable?: boolean;
  /** Controlled selection. */
  selected?: boolean;
  defaultSelected?: boolean;
  /** Called when the checkbox, `x` or Space toggles selection. */
  onSelectedChange?: (selected: boolean) => void;
  /** Controlled edit mode. Leave undefined to let the row manage it. */
  editing?: boolean;
  defaultEditing?: boolean;
  /** Called when the row asks to enter edit mode (Enter, `e`, double click on the value). */
  onEdit?: (secret: Secret) => void;
  /** Called with the validated key and value when Save is pressed (or Enter, or mod+Enter in a multiline value). Not called when nothing changed. */
  onSave?: (next: { key: string; value: string }, secret: Secret) => void;
  /** Called when Cancel or Escape leaves edit mode. */
  onCancel?: (secret: Secret) => void;
  /** Called by the Undo button (or `u`) on a deleted row. */
  onUndo?: (secret: Secret) => void;
  /** Controlled reveal state of the value. */
  revealed?: boolean;
  /** Initial reveal state. Defaults to revealed for `sensitive: false` secrets. */
  defaultRevealed?: boolean;
  /** Called with the next reveal state, including the auto hide after `revealTimeout`. */
  onReveal?: (revealed: boolean, secret: Secret) => void;
  /** Milliseconds a revealed value stays visible. Default 10000. */
  revealTimeout?: number;
  /** Called when the row is clicked outside its controls; open the detail sheet here. */
  onOpen?: (secret: Secret) => void;
  /** Called after the value is copied (copy button, `c` or mod+c). Show the toast "Copied STRIPE_SECRET_KEY. Clipboard clears in 30s." */
  onCopy?: (secret: Secret) => void;
  /** Shows the history action and is called by it. */
  onHistory?: (secret: Secret) => void;
  /** Shows a "More actions" button when no `menu` is given. */
  onMore?: (secret: Secret, event: React.MouseEvent) => void;
  /** Slot for the more actions menu, for example a `Menu` with a more-horizontal xs `IconButton` trigger. Replaces the `onMore` button. */
  menu?: React.ReactNode;
  /** Slot before "Priya · 4 min ago", for example an xs `Avatar`. */
  avatar?: React.ReactNode;
  /** Extra badges after the built in ones, for example `<Badge tone="danger">Live key</Badge>`. */
  badges?: React.ReactNode;
  /** Keys in the environment for the duplicate check. Inherited inside `SecretTable`. */
  existingKeys?: string[];
  /** Keys offered after `${` while editing. Defaults to `existingKeys`. */
  keys?: string[];
  /** Resolves references for the hover tooltip. Inherited inside `SecretTable`. */
  resolve?: (key: string) => string | undefined | null;
  /** `comfortable` uses `--row` (44px), `compact` uses `--row-compact` (36px). Inherited inside `SecretTable`. */
  density?: "comfortable" | "compact";
  /** Reference time for "4 min ago". Defaults to now. */
  now?: Date | number;
}
export declare const SecretRow: React.ForwardRefExoticComponent<SecretRowProps & React.RefAttributes<HTMLDivElement>>;

/** The sticky header row: select all, Key with the count, Value, Updated. Turns into a bulk action bar while rows are selected. */
export interface SecretTableHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  selectable?: boolean;
  /** Every row is selected. */
  checked?: boolean;
  /** Some rows are selected. */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Number of selected rows. Above 0 the labels give way to "3 secrets selected", `actions` and Clear. */
  selectedCount?: number;
  /** Bulk actions shown while rows are selected: "Copy to…", "Export", "Delete". */
  actions?: React.ReactNode;
  /** Shows a ghost "Clear" button in bulk mode. */
  onClearSelection?: () => void;
  /** Number shown after "Key". */
  count?: number;
  density?: "comfortable" | "compact";
}
export declare function SecretTableHeader(props: SecretTableHeaderProps): React.ReactElement;

/** The secrets table of one environment: sticky header, roving keyboard focus, groups by prefix, inline edit, staged states. */
export interface SecretTableProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onCopy"> {
  /** Every row is read only. */
  readOnly?: boolean;
  /** Every row hides its value. */
  locked?: boolean;
  /** The rows, in display order. */
  secrets?: Secret[];
  /** Extra rows rendered after the data rows, for example a custom `SecretRow`. */
  children?: React.ReactNode;
  /** Environment slug for messages and the grid's accessible name ("Secrets in staging"). */
  env?: string;
  /** `comfortable` (44px rows) or `compact` (36px rows). */
  density?: "comfortable" | "compact";
  /** `true` groups keys that share a prefix (STRIPE_, AWS_) under collapsible headers, with the rest under "Other". A function returns each secret's group label. */
  groups?: boolean | ((secret: Secret) => string | null);
  /** Smallest prefix group. Default 2. */
  minGroupSize?: number;
  selectable?: boolean;
  /** Controlled selection, as row ids. */
  selected?: string[];
  defaultSelected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Controlled id of the row in edit mode, or null. */
  editingId?: string | null;
  defaultEditingId?: string | null;
  onEditingIdChange?: (id: string | null) => void;
  /** Controlled collapsed group ids (the prefix, for example "STRIPE_"). */
  collapsedGroups?: string[];
  defaultCollapsedGroups?: string[];
  onCollapsedGroupsChange?: (ids: string[]) => void;
  onSave?: (secret: Secret, next: { key: string; value: string }) => void;
  onCancel?: (secret: Secret) => void;
  onUndo?: (secret: Secret) => void;
  onOpen?: (secret: Secret) => void;
  onReveal?: (secret: Secret, revealed: boolean) => void;
  onCopy?: (secret: Secret) => void;
  onHistory?: (secret: Secret) => void;
  onMore?: (secret: Secret, event: React.MouseEvent) => void;
  /** Returns the `menu` slot for a row. */
  renderMenu?: (secret: Secret) => React.ReactNode;
  /** Returns the `avatar` slot for a row. */
  renderAvatar?: (secret: Secret) => React.ReactNode;
  /** Returns extra badges for a row. */
  renderBadges?: (secret: Secret) => React.ReactNode;
  /** Resolves `${KEY}` references. Defaults to the values in `secrets`. */
  resolve?: (key: string) => string | undefined | null;
  revealTimeout?: number;
  now?: Date | number;
  /** Renders the sticky header. Default true. */
  header?: boolean;
  /** Bulk actions for the header while rows are selected, or a function of the selected secrets. */
  bulkActions?: React.ReactNode | ((selected: Secret[]) => React.ReactNode);
  /** Shown in the body when `secrets` is empty. */
  empty?: React.ReactNode;
  /** Shown under the rows, for example an "Add secret" ghost button. */
  footer?: React.ReactNode;
}
export declare const SecretTable: React.ForwardRefExoticComponent<
  SecretTableProps & React.RefAttributes<HTMLDivElement>
>;

// SecretValue
/** A secret's value: 12 fixed dots while hidden, the real value in mono when revealed, auto hidden again after `revealTimeout`. */
export interface SecretValueProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The plain value. Newlines are allowed; `${OTHER_KEY}` references are highlighted. */
  value?: string;
  /** Controlled reveal state. */
  revealed?: boolean;
  /** Initial reveal state when uncontrolled. Defaults to `!sensitive`. */
  defaultRevealed?: boolean;
  /** Called with the next reveal state, including `false` when the timeout hides the value. */
  onRevealedChange?: (revealed: boolean) => void;
  /** Milliseconds before a revealed sensitive value hides itself, with a countdown line under it. `0` keeps it revealed. Default 10000. */
  revealTimeout?: number;
  /** `false` for plain config such as LOG_LEVEL: shown unmasked by default and never auto hidden. Default true. */
  sensitive?: boolean;
  /** `truncate` keeps one line with an ellipsis and a "+3 lines" chip (rows); `wrap` shows every line and breaks anywhere (detail views). */
  layout?: "truncate" | "wrap";
  /** Resolves a referenced key to its value in the current environment. Hovering a `${KEY}` token then shows the value, or "Not set in this environment" when it returns undefined. */
  resolve?: (key: string) => string | undefined | null;
  /** Shows an xs eye toggle after the value. */
  revealable?: boolean;
  /** Shows an xs copy button after the value that flips to a check for 1.6s. */
  copyable?: boolean;
  /** Called with the copied text after the clipboard write succeeds. */
  onCopied?: (value: string) => void;
  /** The key this value belongs to, used in the hidden state's accessible name ("STRIPE_SECRET_KEY is hidden"). */
  secretKey?: string;
}
export declare const SecretValue: React.ForwardRefExoticComponent<
  SecretValueProps & React.RefAttributes<HTMLSpanElement>
>;

// SegmentedControl
/** One segment of a `SegmentedControl`. */
export interface SegmentOption {
  /** The value passed to `onValueChange`. Unique within the control. */
  value: string;
  /** Visible text. Leave it out for an icon only segment and give `aria-label` instead. */
  label?: React.ReactNode;
  /** Leading Lucide icon name. */
  icon?: string;
  /** A count after the label in `text-tertiary` and tabular numbers: "Missing 3". */
  count?: number | string;
  /** Not selectable and skipped by the arrow keys. */
  disabled?: boolean;
  /** Accessible name and tooltip, required for icon only segments: "Grid view". */
  "aria-label"?: string;
  /** Class name for the segment, for example a forced state class in previews. */
  className?: string;
}
/** 2 to 5 mutually exclusive views or filters with a sliding thumb. Every segment is as wide as the widest. */
export interface SegmentedControlProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** 2 to 5 segments as objects, or plain strings for text only segments. */
  options: Array<SegmentOption | string>;
  /** The selected value. Controlled. */
  value?: string;
  /** The initially selected value when uncontrolled. Defaults to the first enabled option. */
  defaultValue?: string;
  /** Called with the new value on click or arrow keys. */
  onValueChange?: (value: string) => void;
  /** `sm` 28px in toolbars and table headers, `md` 32px by default. */
  size?: "sm" | "md";
  /** Stretches to the container width, sharing it equally. */
  fullWidth?: boolean;
  /** Disables every segment. */
  disabled?: boolean;
}
export declare const SegmentedControl: React.ForwardRefExoticComponent<
  SegmentedControlProps & React.RefAttributes<HTMLDivElement>
>;

// Select
/** One option in a `Select`. */
export interface SelectOption {
  /** The value passed to `onValueChange`. Unique within the list. */
  value: string | number;
  /** What people read. Defaults to the value. */
  label?: React.ReactNode;
  /** Text used for filtering and type to select when `label` is not a string. */
  textValue?: string;
  /** Leading Lucide icon name. */
  icon?: string;
  /** A second line in `caption`, `text-tertiary`: "24 secrets, protected". */
  description?: React.ReactNode;
  /** Skipped by the keyboard and not selectable. */
  disabled?: boolean;
  /** Group heading. Options with the same group should be adjacent. */
  group?: string;
  /** A node before the label, for example `<EnvDot color="rose" />`. Also shown in the trigger when selected. */
  prefix?: React.ReactNode;
  /** Shortcut hint at the right of the option, for example ["g", "s"]. */
  kbd?: string | string[];
}
/** A trigger styled like `Input` that opens a listbox of options in a popover. */
export interface SelectProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "value" | "defaultValue" | "onChange" | "type" | "prefix"
  > {
  /** Options as objects, or plain strings for simple lists. */
  options: Array<SelectOption | string>;
  /** The selected value, or `null` for none. Controlled. */
  value?: string | number | null;
  /** The initially selected value when uncontrolled. */
  defaultValue?: string | number | null;
  /** Called with the new value when an option is chosen. */
  onValueChange?: (value: string | number) => void;
  /** Shown in `text-tertiary` when nothing is selected: "Select environment". */
  placeholder?: string;
  /** `sm` 28px, `md` 32px by default, `lg` 40px. Matches `Input`. */
  size?: "sm" | "md" | "lg";
  /** Draws the `danger` ring. `Field` sets it for you when it has an `error`. */
  invalid?: boolean;
  /** Drops the trigger to `fill` with `text-disabled`; the menu cannot open. */
  disabled?: boolean;
  /** Renders the selected option in the trigger, for example as an `EnvBadge`. */
  renderValue?: (option: SelectOption) => React.ReactNode;
  /** Shows a filter input at the top of the menu. Defaults to on when there are more than 8 options. */
  searchable?: boolean;
  /** Placeholder of the filter input. Defaults to "Filter <noun>s". */
  searchPlaceholder?: string;
  /** What the options are, singular or plural, for the filter placeholder and the empty text: "environment" gives "No environments match 'prod-eu'". */
  noun?: string;
  /** Replaces the empty text shown when the filter matches nothing. */
  emptyText?: React.ReactNode | ((query: string) => React.ReactNode);
  /** Leading Lucide icon in the trigger. */
  icon?: string;
  /** Sets the value and option labels in Geist Mono, for keys. */
  mono?: boolean;
  /** Adds a hidden input with this name so the value submits with a form. */
  name?: string;
  /** Controls whether the menu is open. */
  open?: boolean;
  /** Opens the menu on mount when uncontrolled. */
  defaultOpen?: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Where the menu opens. It flips when there is no room. Defaults to "bottom-start". */
  placement?: "bottom-start" | "bottom-end" | "top-start" | "top-end";
  /** Class name for the menu surface. */
  menuClassName?: string;
}
export declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLButtonElement>>;

// SettingRow
/** One setting: what it is and what it does on the left, its control on the right. Rows stack their control under the text when narrower than 520px. */
export interface SettingRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The setting's name in `body-medium`, sentence case: "Theme", "Hide revealed values after". */
  label: React.ReactNode;
  /** What changes, in `small` `text-secondary`, with the number that matters. */
  description?: React.ReactNode;
  /** The control: a `SegmentedControl`, `Select`, `Switch` or `Button`s. */
  children?: React.ReactNode;
  /** Sets the label in `danger` for irreversible actions such as "Delete project". */
  danger?: boolean;
  /** Id of the control, which turns the label into a `<label>` for it. */
  htmlFor?: string;
}
export declare const SettingRow: React.ForwardRefExoticComponent<SettingRowProps & React.RefAttributes<HTMLDivElement>>;

/** A titled set of `SettingRow`s inside a flush `Card`, separated by hairlines. */
export interface SettingsGroupProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Group title in `heading`: "Appearance", "Danger zone". */
  title?: React.ReactNode;
  /** One line under the title in `small` `text-secondary`. */
  description?: React.ReactNode;
  /** `SettingRow`s. */
  children?: React.ReactNode;
  /** Tints the title and the card ring with `danger`, for the danger zone. */
  danger?: boolean;
}
export declare function SettingsGroup(props: SettingsGroupProps): React.ReactElement;

// Sheet
/** A panel that slides in from the right (from the bottom under 640px) for detail views and longer tasks: a secret's values per environment, the import preview, member settings. */
export interface SheetProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the next open state on trigger click, the close button, Escape and an overlay click. */
  onOpenChange?: (open: boolean) => void;
  /** Optional element that toggles the sheet on click. */
  trigger?: React.ReactElement;
  /** Heading in `title` type that labels the sheet: a key such as `STRIPE_SECRET_KEY`, or a task such as "Import .env into staging". */
  title?: React.ReactNode;
  /** One line under the title in `small` `text-secondary`: project, counts, last change. */
  description?: React.ReactNode;
  /** Header slot before the close button, for `sm` `IconButton`s and a "More actions" `Menu`. */
  actions?: React.ReactNode;
  /** Buttons for the sticky footer strip, primary last. */
  footer?: React.ReactNode;
  /** `true` dims the page with an overlay, traps focus and locks scroll. `false` is a side peek: no overlay, the page stays usable, focus moves in but is not trapped. */
  modal?: boolean;
  /** Closes when the overlay is clicked (modal only). */
  closeOnOverlay?: boolean;
  /** Hides the close button. Escape still closes. */
  hideClose?: boolean;
  /** Element to focus on open. Defaults to an element with `data-autofocus`, else the sheet itself. Pass false to leave focus where it is, for a sheet shown open at rest. */
  initialFocus?: React.RefObject<HTMLElement> | false;
  /** Portal target. Defaults to `document.body`. Pass an element with `transform` set to confine the sheet to a region, as the previews do. */
  container?: HTMLElement | null;
  /** The scrolling body. */
  children?: React.ReactNode;
}
export declare function Sheet(props: SheetProps): React.ReactElement;

// Sidebar
/** The app's navigation column. Sits on the `bg` ground beside the inset panel; `AppShell` sizes it, collapses it to a rail and turns it into a drawer on small screens. */
export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pinned above the scrolling list, usually a `SidebarHeader` with the `WorkspaceButton`. */
  header?: React.ReactNode;
  /** Pinned below the scrolling list, usually a `SidebarUser` and a help `IconButton`. */
  footer?: React.ReactNode;
  /** `NavItem`s and `SidebarSection`s. Arrow Up and Down move between visible items, Home and End jump to the ends. */
  children?: React.ReactNode;
  /** Draws the 56px icon rail. Defaults to the `AppShell` state, so leave it unset inside a shell. */
  collapsed?: boolean;
  /** Accessible name of the navigation landmark. */
  label?: string;
}
export declare const Sidebar: React.ForwardRefExoticComponent<SidebarProps & React.RefAttributes<HTMLDivElement>>;

/** The row at the top of the sidebar: the workspace switcher and up to two icon actions. */
export interface SidebarHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Usually a `WorkspaceButton`. */
  children?: React.ReactNode;
  /** `IconButton`s at `sm`, for example "Search" and "Add secret". Hidden in the rail. */
  actions?: React.ReactNode;
}
export declare function SidebarHeader(props: SidebarHeaderProps): React.ReactElement;

/** The workspace switcher trigger: a 20px app tile, the workspace name and a chevrons-up-down hint. Wrap it in a `Menu` to open the switcher. */
export interface WorkspaceButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Workspace name as the members typed it: "Lumen Labs". */
  name: string;
  /** Replaces the default 20px `AppIcon`, for a workspace that uploaded its own tile. */
  tile?: React.ReactNode;
}
export declare const WorkspaceButton: React.ForwardRefExoticComponent<
  WorkspaceButtonProps & React.RefAttributes<HTMLButtonElement>
>;

/** A titled group of nav items, collapsible from its overline label. */
export interface SidebarSectionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onToggle"> {
  /** Overline label, for example "Projects". */
  label: React.ReactNode;
  /** Items inside the section. */
  children?: React.ReactNode;
  /** A node at the right of the label, shown on hover and focus, typically an `IconButton` "plus" at `xs` labelled "Create project". */
  action?: React.ReactNode;
  /** When false the label is static and the items always show. */
  collapsible?: boolean;
  /** Controlled open state. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the next open state when the label is clicked. */
  onOpenChange?: (open: boolean) => void;
}
export declare function SidebarSection(props: SidebarSectionProps): React.ReactElement;

/** One 30px navigation row: an icon or environment dot, a label, and optional count, shortcut and trailing node. Rows with `children` expand like a tree. */
export interface NavItemProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** Leading Lucide icon name at 16px. */
  icon?: string;
  /** An environment hue for a leading `EnvDot` instead of an icon: "blue", "amber", "rose", "violet" and so on. */
  dot?: "gray" | "blue" | "teal" | "green" | "amber" | "orange" | "rose" | "violet";
  /** The destination, sentence case, or the exact slug for projects and environments. */
  label: React.ReactNode;
  /** A number after the label in tabular `text-tertiary`, for example secrets in an environment. */
  count?: number | string;
  /** `warning`, `danger` or `accent` draw the count as a soft chip, and as a 6px dot in the rail. Use `warning` for "Health 3". */
  countTone?: "neutral" | "warning" | "danger" | "accent";
  /** Shortcut shown on hover and focus, for example ["mod", "k"]. */
  kbd?: string | string[];
  /** The current page: `fill-hover` ground, `text` label, `aria-current="page"`. */
  active?: boolean;
  /** Nested `NavItem`s. The row becomes a disclosure: click, Enter or Arrow Right opens it, Arrow Left closes it or returns to the parent. */
  children?: React.ReactNode;
  /** Controlled open state of the nested items. */
  open?: boolean;
  /** Initial open state of the nested items when uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the next open state. */
  onOpenChange?: (open: boolean) => void;
  /** A node before the count, for example a 12px `lock` icon on a protected environment, so counts stay in one column. Hidden in the rail. */
  trailing?: React.ReactNode;
  /** Renders an anchor instead of a button. Ignored when the item has `children`. */
  href?: string;
  /** Called on click. Inside an `AppShell` drawer, clicking a leaf item also closes the drawer. */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  /** Greys the item to `text-disabled`, ignores clicks and skips it in arrow key movement. */
  disabled?: boolean;
}
export declare const NavItem: React.ForwardRefExoticComponent<NavItemProps & React.RefAttributes<HTMLElement>>;

/** The signed-in member at the foot of the sidebar: initials on a round `env-blue-soft` tile, name and one detail line. Wrap it in a `Menu` for the account menu. */
export interface SidebarUserProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Full name: "Maya Chen". Initials are derived from it. */
  name: string;
  /** Second line in `caption` `text-tertiary`: the email or the role. */
  detail?: React.ReactNode;
  /** Replaces the initials tile, for example an `Avatar` at 24px. */
  avatar?: React.ReactNode;
}
export declare const SidebarUser: React.ForwardRefExoticComponent<
  SidebarUserProps & React.RefAttributes<HTMLButtonElement>
>;

// Skeleton
/** A placeholder shaped like the content that is loading, pulsing in opacity. Decorative: announce loading on the region instead. */
export interface SkeletonProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** `text` draws lines on a 20px rhythm, `block` a rectangle (40px tall by default), `circle` a disc (24px by default). */
  variant?: "text" | "block" | "circle";
  /** Number of text lines. The last of several is 62 percent wide. */
  lines?: number;
  /** Width as px (number) or any CSS length. Text and block default to 100 percent. */
  width?: number | string;
  /** Height as px (number) or any CSS length. For text, the bar height inside each line (10px by default). */
  height?: number | string;
}
export declare function Skeleton(props: SkeletonProps): React.ReactElement;
/** Placeholder secret rows: selection box, key, masked value dots, avatar and time. */
export interface SkeletonRowsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of rows. Match the expected count when you know it. Defaults to 5. */
  count?: number;
  /** `comfortable` 44px rows or `compact` 36px rows, matching the table setting. */
  density?: "comfortable" | "compact";
  /** Announced to screen readers while loading. Defaults to "Loading secrets". */
  label?: string;
}
export declare function SkeletonRows(props: SkeletonRowsProps): React.ReactElement;

// StatTile
/** One headline number with its label, an optional change line and an optional 96 by 32 sparkline. */
export interface StatTileProps extends Omit<React.HTMLAttributes<HTMLElement>, "onClick"> {
  /** Sentence case, no colon: "Secrets", "Environments", "Changes this week", "Issues". */
  label: React.ReactNode;
  /** The number, already formatted: 89, "1,284". Rendered in `title-lg` with tabular figures. */
  value: React.ReactNode;
  /** The change against a named period: "+3 this week", "2 new since Monday". */
  delta?: React.ReactNode;
  /** Color of `delta`: `success` when the change is good, `warning` or `danger` when it is not, `neutral` otherwise. */
  deltaTone?: "neutral" | "success" | "warning" | "danger";
  /** Values for the sparkline, oldest first, for example changes per day over 12 days. */
  series?: number[];
  /** A label per point ("Sep 19"), read on hover in place of the delta line. */
  seriesLabels?: string[];
  /** Unit after a hovered value and in the sparkline summary: "changes". */
  unit?: string;
  /** Lucide icon before the label. */
  icon?: string;
  /** Makes the whole tile a link, with a hover lift and an `arrow-up-right` hint. */
  href?: string;
  /** Makes the whole tile a button. */
  onClick?: (event: React.MouseEvent) => void;
  /** Shows a skeleton. */
  loading?: boolean;
}
export declare const StatTile: React.ForwardRefExoticComponent<StatTileProps & React.RefAttributes<HTMLElement>>;

// Switch
/** An on and off toggle for settings that apply the moment they change. */
export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "type"> {
  /** On or off. Controlled; pair with `onCheckedChange`. */
  checked?: boolean;
  /** The initial state when uncontrolled. */
  defaultChecked?: boolean;
  /** Called with the new state on click, Space or Enter. */
  onCheckedChange?: (checked: boolean) => void;
  /** `sm` 26 by 16 in dense rows and filters, `md` 32 by 18 by default. */
  size?: "sm" | "md";
  /** Drops the track to `fill` and ignores clicks. Say why in the description. */
  disabled?: boolean;
  /** Shows a spinner in the thumb while the change saves, and ignores clicks. */
  loading?: boolean;
  /** When given, renders a clickable label beside the switch. */
  label?: React.ReactNode;
  /** Secondary line under the label in `small`, `text-secondary`. */
  description?: React.ReactNode;
  /** `end` puts the label after the switch, like `Checkbox`. `start` puts the label first and the switch at the right edge, for settings rows. */
  labelPosition?: "start" | "end";
  /** Adds a hidden input with this name while the switch is on, so it submits with a form. */
  name?: string;
  /** Value submitted with `name` while on. Defaults to "on". */
  value?: string;
}
export declare const Switch: React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLButtonElement>>;

// Table
export interface TableColumn<Row = Record<string, unknown>> {
  /** Unique key; also the row field shown when there is no `render`. */
  key: string;
  /** Header label in sentence case: "Name", "Last used". */
  header: React.ReactNode;
  /** Track width: a number in px, any CSS track ("minmax(160px, 2fr)"), or unset for a flexible `minmax(0, 1fr)` column. */
  width?: number | string;
  /** Minimum width in px for a flexible column; also counts toward the width at which the table starts to scroll sideways. */
  minWidth?: number;
  /** `right` for numbers and dates that should line up (tabular numerals), `center` for icons. */
  align?: "left" | "right" | "center";
  /** Custom cell content. Strings and numbers returned here are truncated with an ellipsis. */
  render?: (row: Row, index: number) => React.ReactNode;
  /** Sets the cell in `mono`, for keys, token names and values. */
  mono?: boolean;
  /** Extra class on every cell of the column. */
  className?: string;
}
export interface TableGroup<Row = Record<string, unknown>> {
  /** Unique key of the group. */
  key: string;
  /** Group label, for example "Active" or an environment slug. */
  label: React.ReactNode;
  /** Leading Lucide icon name or node, such as an `EnvDot`. */
  icon?: string | React.ReactNode;
  /** Rows in the group. */
  rows: Row[];
  /** Overrides the count shown after the label (defaults to `rows.length`). */
  count?: number;
  /** Starts folded. */
  defaultCollapsed?: boolean;
}
/** A dense, keyboard first data table: sticky header, row hover, optional selection, groups, loading and empty states. */
export interface TableProps<Row = Record<string, unknown>>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Column definitions, left to right. */
  columns: TableColumn<Row>[];
  /** Rows to show. Ignored when `groups` is given. */
  rows?: Row[];
  /** Rows split under collapsible group headers (label and count, Linear style) that stick under the table header. */
  groups?: TableGroup<Row>[];
  /** Field name or function that returns a unique key for a row. Defaults to "id". */
  rowKey?: string | ((row: Row) => string);
  /** Readable name of a row for its selection checkbox: "Select ci-deploy". Defaults to the row key. */
  rowLabel?: (row: Row) => string;
  /** Adds a 32px checkbox column and a select all box in the header that shows the mixed state when some rows are selected. */
  selectable?: boolean;
  /** Controlled list of selected row keys. */
  selected?: string[];
  /** Initial selection when uncontrolled. */
  defaultSelected?: string[];
  /** Called with the next list of selected keys, in row order. */
  onSelectedChange?: (keys: string[]) => void;
  /** `comfortable` rows are `--row` (44px), `compact` rows are `--row-compact` (36px). */
  density?: "comfortable" | "compact";
  /** Called when a row is clicked or Enter is pressed on it. Clicks on buttons, links and inputs inside the row are ignored. */
  onRowClick?: (row: Row, event: React.SyntheticEvent) => void;
  /** Shown in place of the rows when there are none, typically an inline `EmptyState`. */
  empty?: React.ReactNode;
  /** Draws skeleton rows that match the columns and sets `aria-busy`. */
  loading?: boolean;
  /** Number of skeleton rows. */
  loadingRows?: number;
  /** Keeps the header (and group headers) pinned while the table scrolls. Give the table a height (`maxHeight` or a flex parent) for it to scroll. */
  stickyHeader?: boolean;
  /** Maximum height before the table scrolls inside itself. */
  maxHeight?: number | string;
  /** Draws a `border` ring with `--r-8` corners, for a table that stands alone on a page. */
  framed?: boolean;
  /** Accessible name of the grid, for example "Access tokens". */
  label?: string;
}
export declare const Table: React.ForwardRefExoticComponent<TableProps & React.RefAttributes<HTMLDivElement>>;

// Tabs
export interface TabItem {
  /** Unique value reported by `onValueChange`. */
  value: string;
  /** Visible label: a sentence case noun ("Secrets") or an exact slug ("staging"). */
  label: React.ReactNode;
  /** Leading Lucide icon name. */
  icon?: string;
  /** Tabular count after the label in `text-tertiary`, for example secrets in an environment. */
  count?: number | string;
  /** An environment hue for a leading `EnvDot`; takes the place of `icon`. */
  dot?: "gray" | "blue" | "teal" | "green" | "amber" | "orange" | "rose" | "violet";
  /** Greys the tab and skips it with the arrow keys. */
  disabled?: boolean;
  /** Extra class on the tab, for forced preview states such as `is-hover`. */
  className?: string;
}
/** A row of tabs that switch views in place. Arrow keys move and select at once; Home and End jump to the ends. */
export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  /** The tabs, in order. */
  items: TabItem[];
  /** Controlled selected value. */
  value?: string;
  /** Initial value when uncontrolled. Defaults to the first enabled item. */
  defaultValue?: string;
  /** Called with the next value on click and on arrow keys (automatic activation). */
  onValueChange?: (value: string) => void;
  /** `underline` for page level views, with a 2px `text` indicator that slides to the selection and a `border` hairline under the row. `pills` for filters inside a view, with a `fill` ground behind the selection. */
  variant?: "underline" | "pills";
  /** `md` 40px row with `small-medium` labels; `sm` 36px row for card and code block headers. */
  size?: "sm" | "md";
  /** Accessible name of the tab list, for example "Environments". */
  label?: string;
  /** Optional `TabPanel`s. When present, each tab points at its panel with `aria-controls`. */
  children?: React.ReactNode;
}
export declare const Tabs: React.ForwardRefExoticComponent<TabsProps & React.RefAttributes<HTMLDivElement>>;
/** The content for one tab. Render inside `Tabs`; only the selected panel mounts its children. */
export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The `value` of the tab this panel belongs to. */
  value: string;
  /** Panel content, mounted only while its tab is selected. */
  children?: React.ReactNode;
}
export declare function TabPanel(props: TabPanelProps): React.ReactElement | null;

// Textarea
/** A multi line text control for notes and raw .env text. The ring and counter live on a wrapper; every other prop lands on the native textarea. */
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> {
  /** Grows with its content between `minRows` and `maxRows`, then scrolls. Turns off the resize handle. */
  autoGrow?: boolean;
  /** Visible rows when empty. Defaults to 3. */
  minRows?: number;
  /** Rows before an auto growing textarea starts to scroll. Defaults to 12. */
  maxRows?: number;
  /** Fixed row count when `autoGrow` is off. Defaults to `minRows`. */
  rows?: number;
  /** Sets the text in Geist Mono, for raw .env text and values. Turns off spellcheck and autocapitalize. */
  mono?: boolean;
  /** Draws the `danger` ring and sets `aria-invalid`. `Field` sets it for you when it has an `error`. */
  invalid?: boolean;
  /** `true` shows "142 / 280" against `maxLength` in the bottom right corner. A number sets a soft limit that turns the count `danger` when passed without blocking typing. */
  counter?: boolean | number;
  /** Hard limit enforced by the browser; also the counter's limit when `counter` is `true`. */
  maxLength?: number;
  /** Keeps the text selectable but not editable, on `bg-subtle`, with no resize handle. */
  readOnly?: boolean;
  /** Drops to `fill` with `text-disabled` and ignores input. */
  disabled?: boolean;
  /** The text. Controlled; pair with `onChange` or `onValueChange`. */
  value?: string;
  /** The initial text when uncontrolled. */
  defaultValue?: string;
  /** Called with the new string on every change, after `onChange`. */
  onValueChange?: (value: string) => void;
  /** Class name for the wrapper that draws the ring. */
  className?: string;
  /** Inline style for the wrapper. */
  style?: React.CSSProperties;
}
export declare const Textarea: React.ForwardRefExoticComponent<
  TextareaProps & React.RefAttributes<HTMLTextAreaElement>
>;

// Toast
/** Options for one toast. */
export interface ToastOptions {
  /** Reuse an id to update a toast in place (the promise helper does this). */
  id?: string;
  /** The result, stating the count, the key and the environment: "Saved 3 changes to staging". */
  title?: React.ReactNode;
  /** A second line in `text-secondary`: the consequence or what happens next. */
  description?: React.ReactNode;
  /** `success`, `warning` and `danger` color the leading icon only; the card stays neutral. */
  tone?: "neutral" | "success" | "warning" | "danger";
  /** Leading Lucide icon. Defaults to `circle-check`, `triangle-alert` or `circle-alert` by tone, none for `neutral`. */
  icon?: string;
  /** One follow up action as a small secondary button: { label: "Undo", onClick }. Clicking it also dismisses the toast. */
  action?: { label: React.ReactNode; onClick?: () => void };
  /** Time on screen in ms: 5000 by default, 10000 with an action, `Infinity` to stay until dismissed. Paused while the stack is hovered or focused and while the window is in the background. */
  duration?: number;
  /** Shows a spinner in place of the icon and never times out. Set by `toast.promise`. */
  loading?: boolean;
  /** Set false to hide the close button. */
  dismissible?: boolean;
  /** Extra class on the toast card. */
  className?: string;
}
export interface ToastFn {
  /** Shows a toast and returns its id. A string is taken as the title. */
  (options: ToastOptions | string): string;
  /** Shorthand for a `success` toast. */
  success(title: React.ReactNode, options?: ToastOptions): string;
  /** Shorthand for a `warning` toast. */
  warning(title: React.ReactNode, options?: ToastOptions): string;
  /** Shorthand for a `danger` toast. */
  danger(title: React.ReactNode, options?: ToastOptions): string;
  /** Dismisses one toast with its exit animation, or all of them when no id is given. */
  dismiss(id?: string): void;
  /** Shows `loading` until the promise settles, then turns the same toast into `success` or `danger`. Each state is a title, an options object, or a function of the result. Returns the id. */
  promise<T>(
    promise: Promise<T>,
    states: {
      loading?: React.ReactNode | ToastOptions;
      success?: React.ReactNode | ToastOptions | ((value: T) => React.ReactNode | ToastOptions);
      error?: React.ReactNode | ToastOptions | ((error: unknown) => React.ReactNode | ToastOptions);
    },
  ): string;
}
/** Imperative API backed by a module level store: call it from anywhere, render one `Toaster`. */
export declare const toast: ToastFn;

/** Renders the toast stack: bottom right, bottom centre under 640px. Render it once near the root. */
export interface ToasterProps {
  /** How many toasts show in the stack; older ones wait behind and resume when there is room. */
  visible?: number;
  /** Keeps the stack expanded instead of collapsing it behind the newest toast. Timers still run unless hovered. */
  expand?: boolean;
  /** Portal target. Defaults to `document.body`. Pass an element with `transform` set to confine the stack to a region, as the preview does. */
  container?: HTMLElement | null;
  /** Shortcut that moves focus to the newest toast, ["alt", "t"] by default. Pass false to turn it off. */
  hotkey?: string[] | false;
  /** Accessible name of the live region; the hotkey is appended. */
  label?: string;
  className?: string;
}
export declare function Toaster(props: ToasterProps): React.ReactElement;

// Tooltip
/** A short label for one trigger, shown after a hover delay or at once on keyboard focus. Ink on paper: `primary` fill, `on-primary` text, no arrow. */
export interface TooltipProps {
  /** The text to show, written as the action or the name: "Copy value", "Protected by Maya Chen". Empty content renders no tooltip. */
  content?: React.ReactNode;
  /** Shortcut shown after the text as inverse `Kbd` caps, for example ["mod", "c"] or ["g", "p"]. */
  kbd?: string | string[];
  /** Side of the trigger to open on. Flips to the opposite side when there is no room. */
  side?: "top" | "bottom" | "left" | "right";
  /** Alignment along the side. */
  align?: "start" | "center" | "end";
  /** Gap between the trigger and the tooltip in px. */
  offset?: number;
  /** Hover delay in ms before opening. Skipped when another tooltip closed less than 300ms ago, and on keyboard focus. */
  delay?: number;
  /** Controlled open state. Use it to show a tooltip at rest in documentation. */
  open?: boolean;
  /** Initial open state when uncontrolled. */
  defaultOpen?: boolean;
  /** Called with the next open state on hover, focus, blur, Escape and scroll. */
  onOpenChange?: (open: boolean) => void;
  /** Never opens while true. */
  disabled?: boolean;
  /** Adds `aria-describedby` on the trigger while open. Turn it off when the trigger's accessible name already says the same thing, as `IconButton` does. */
  describe?: boolean;
  /** Class for the floating tooltip. */
  className?: string;
  /** Exactly one element that accepts a ref and pointer and focus handlers: a DOM element or a component that forwards them. */
  children: React.ReactElement;
}
export declare function Tooltip(props: TooltipProps): React.ReactElement;

// VersionTimeline
/** One saved version of a secret. */
export interface SecretVersion {
  /** Version number; shown as "v7". */
  version: number;
  /** Who made it: "Jonas Weber", or a token such as "ci-deploy". */
  author: string;
  /** What changed: "Rotated", "Edited value", "Created", "Restored v5", "Imported from .env". */
  summary: string;
  /** The value at this version; `undefined` for a deletion. */
  value?: string;
  /** Display time: "4 min ago", "Sep 12". */
  time?: string;
  /** When it was saved, used through `relativeTime` when `time` is not given. */
  date?: Date | number | string;
  /** Marks the live version. Defaults to the first entry. */
  current?: boolean;
  /** `token` draws the author's avatar as a service tile. */
  authorType?: "member" | "token";
  /** Slot before the author, for example an `Avatar` at 16px. */
  avatar?: React.ReactNode;
}
/** The version history of one secret, newest first, with reveal, restore, and a two version comparison. */
export interface VersionTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Versions, newest first. */
  versions: SecretVersion[];
  /** The secret's key, shown in the header in mono. */
  secretKey?: string;
  /** The environment, shown in the header as an `EnvBadge`. */
  env?: Env | string;
  /** Controlled compare selection: up to two version numbers. */
  selected?: number[];
  /** Initial compare selection when uncontrolled. */
  defaultSelected?: number[];
  onSelectedChange?: (versions: number[]) => void;
  /** Called with the older and newer version when a second version is picked. */
  onCompare?: (older: number, newer: number) => void;
  /** Shows "Restore v5" on hover for older versions. Restoring stages a new version; it never rewrites history. */
  onRestore?: (version: number) => void;
  /** Draws a 16px `Avatar` before every author that has no `avatar` of its own. */
  avatars?: boolean;
  /** Custom value cell. Return `undefined` to keep the masked `SecretValue` and the reveal button. */
  valueRenderer?: (value: string | undefined, context: { version: number; revealed: boolean }) => React.ReactNode;
  /** Hides revealed values after this many milliseconds. */
  revealTimeout?: number;
  /** Reference time for `date`. Defaults to now. */
  now?: Date | number;
  /** Shows three skeleton versions. */
  loading?: boolean;
}
export declare const VersionTimeline: React.ForwardRefExoticComponent<
  VersionTimelineProps & React.RefAttributes<HTMLDivElement>
>;

export declare function cx(...parts: Array<string | false | null | undefined | Record<string, boolean>>): string;
export declare function n(count: number, word: string, plural?: string): string;
export declare function copyText(text: string): Promise<boolean>;
export declare function relativeTime(date: number | string | Date, now?: number): string;
export declare const isMac: boolean;
export declare function formatShortcut(keys: string[]): string[];
export declare function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [T, (next: T | ((current: T) => T)) => void];
export declare function Portal(props: {
  children?: React.ReactNode;
  container?: Element | null;
}): React.ReactElement | null;
