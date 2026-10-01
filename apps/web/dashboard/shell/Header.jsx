import { createContext, useContext } from "react";
import * as ReactDOM from "react-dom";

export const HeaderSlotContext = createContext(null);

export function HeaderActions({ children }) {
  const el = useContext(HeaderSlotContext);
  return el ? ReactDOM.createPortal(children, el) : null;
}
