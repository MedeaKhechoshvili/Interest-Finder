"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return function unsubscribe() {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function useHydrated() {
  // keep controls disabled until react has attached their handlers
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
