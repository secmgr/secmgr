"use client";

import { useEffect } from "react";
import { mountHome } from "./home-script.js";

export function HomeScript() {
  useEffect(() => {
    mountHome();
  }, []);
  return null;
}
