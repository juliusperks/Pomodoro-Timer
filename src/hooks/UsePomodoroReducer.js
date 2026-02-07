import { clampMin } from "../utils/time";

const modes = {
  work: "Work",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const secondsForMode = (mode, config) => {
  if (mode === "work") return config.workMin * 60;
  if (mode === "shortBreak") return config.shortMin * 60;
  return config.longMin * 60;
};

const nextMode = (currentMode, nextWorkCount, config) => {
  if (currentMode === "work") {
    return nextWorkCount % config.longEvery === 0 ? "longBreak" : "shortBreak";
  }
  return "work";
};

export const initialState = {
  mode: "work",
  status: "idle",
  config: { workMin: 25, shortMin: 5, longMin: 15, longEvery: 4 },
  secondsLeft: 25 * 60,
  workSessionsCompleted: 0,
  announce: "", // for aria-live messages
};

export function reducer(state, action) {
  switch (action.type) {
    case "START": {
      if (state.status === "running") return state;
      return { ...state, status: "running", announce: "" };
    }
    case "PAUSE": {
      if (state.status !== "running") return state;
      return { ...state, status: "paused", announce: "" };
    }
    case "RESUME": {
      if (state.status !== "paused") return state;
      return { ...state, status: "running", announce: "" };
    }
    case "RESET_SESSION": {
      return {
        ...state,
        status: "idle",
        secondsLeft: secondsForMode(state.mode, state.config),
        announce: "Session reset",
      };
    }
    case "TICK": {
      if (state.status !== "running") return state;
      const next = state.secondsLeft - 1;
      if (next > 0) return { ...state, secondsLeft: next };
      // session complete
      let nextWorkCount = state.workSessionsCompleted;
      if (state.mode === "work") nextWorkCount += 1;
      const mode2 = nextMode(state.mode, nextWorkCount, state.config);
      return {
        ...state,
        mode: mode2,
        workSessionsCompleted: nextWorkCount,
        secondsLeft: secondsForMode(mode2, state.config),
        announce: `Session complete. Next: ${modes[mode2]}`,
      };
    }
    case "APPLY_CONFIG": {
      const config = {
        workMin: clampMin(action.payload.workMin),
        shortMin: clampMin(action.payload.shortMin),
        longMin: clampMin(action.payload.longMin),
        longEvery: Math.max(1, Number(action.payload.longEvery) || 4),
      };
      return {
        ...state,
        config,
        secondsLeft: secondsForMode(state.mode, config),
        status: "idle",
        announce: "Settings applied",
      };
    }
    default:
      return state;
  }
}

export const modeLabel = (mode) => modes[mode];
