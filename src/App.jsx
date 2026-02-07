import { useEffect, useMemo, useReducer, useRef } from "react";

const modeLabels = {
  work: "Work",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const secondsForMode = (mode, config) => {
  if (mode === "work") return config.workMin * 60;
  if (mode === "shortBreak") return config.shortMin * 60;
  return config.longMin * 60;
};

const clampMin = (v) => Math.max(1, Number(v) || 1);

const formatMMSS = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const initialState = {
  mode: "work", // work | shortBreak | longBreak
  status: "idle", // idle | running | paused
  config: { workMin: 25, shortMin: 5, longMin: 15, longEvery: 4 },
  secondsLeft: 25 * 60,
  workSessionsCompleted: 0,
  announce: "",
  soundEnabled: true,
};

function reducer(state, action) {
  switch (action.type) {
    case "START":
      if (state.status === "running") return state;
      return { ...state, status: "running", announce: "" };

    case "PAUSE":
      if (state.status !== "running") return state;
      return { ...state, status: "paused", announce: "" };

    case "RESUME":
      if (state.status !== "paused") return state;
      return { ...state, status: "running", announce: "" };

    case "RESET_SESSION":
      return {
        ...state,
        status: "idle",
        secondsLeft: secondsForMode(state.mode, state.config),
        announce: "Session reset",
      };

    case "SET_MODE": {
      const mode = action.payload;
      return {
        ...state,
        mode,
        status: "idle",
        secondsLeft: secondsForMode(mode, state.config),
        announce: `Session: ${modeLabels[mode]}`,
      };
    }

    case "TOGGLE_SOUND":
      return { ...state, soundEnabled: !state.soundEnabled, announce: "" };

    case "APPLY_CONFIG": {
      const cfg = {
        workMin: clampMin(action.payload.workMin),
        shortMin: clampMin(action.payload.shortMin),
        longMin: clampMin(action.payload.longMin),
        longEvery: Math.max(1, Number(action.payload.longEvery) || 4),
      };
      return {
        ...state,
        config: cfg,
        status: "idle",
        secondsLeft: secondsForMode(state.mode, cfg),
        announce: "Settings applied",
      };
    }

    case "TICK": {
      if (state.status !== "running") return state;

      const next = state.secondsLeft - 1;
      if (next > 0) return { ...state, secondsLeft: next };

      // Complete current session
      let workCount = state.workSessionsCompleted;
      if (state.mode === "work") workCount += 1;

      let nextMode;
      if (state.mode === "work") {
        nextMode = workCount % state.config.longEvery === 0 ? "longBreak" : "shortBreak";
      } else {
        nextMode = "work";
      }

      return {
        ...state,
        mode: nextMode,
        workSessionsCompleted: workCount,
        secondsLeft: secondsForMode(nextMode, state.config),
        announce: `Session complete. Next: ${modeLabels[nextMode]}`,
      };
    }

    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const audioRef = useRef(null);
  useEffect(() => {
    audioRef.current = new Audio("/ding.mp3");
  }, []);

  // 1 second tick loop while running
  useEffect(() => {
    if (state.status !== "running") return;
    const id = setInterval(() => dispatch({ type: "TICK" }), 1000);
    return () => clearInterval(id);
  }, [state.status]);

  // play sound on session complete
  useEffect(() => {
    if (!state.announce.startsWith("Session complete")) return;
    if (!state.soundEnabled) return;

    const a = audioRef.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {
      // Browser may block until user interaction; Start button usually counts.
    });
  }, [state.announce, state.soundEnabled]);

  const primaryButton = useMemo(() => {
    if (state.status === "running") return { label: "Pause", onClick: () => dispatch({ type: "PAUSE" }) };
    if (state.status === "paused") return { label: "Resume", onClick: () => dispatch({ type: "RESUME" }) };
    return { label: "Start", onClick: () => dispatch({ type: "START" }) };
  }, [state.status]);

  const onHotkeys = (e) => {
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;

    if (e.key === "s" || e.key === "S") {
      if (state.status === "running") dispatch({ type: "PAUSE" });
      else if (state.status === "paused") dispatch({ type: "RESUME" });
      else dispatch({ type: "START" });
    }
    if (e.key === "r" || e.key === "R") dispatch({ type: "RESET_SESSION" });
  };

  useEffect(() => {
    window.addEventListener("keydown", onHotkeys);
    return () => window.removeEventListener("keydown", onHotkeys);
  });

  const onSubmitSettings = (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    dispatch({
      type: "APPLY_CONFIG",
      payload: {
        workMin: fd.get("workMin"),
        shortMin: fd.get("shortMin"),
        longMin: fd.get("longMin"),
        longEvery: fd.get("longEvery"),
      },
    });
  };

  return (
    <main className="container">
      <h1>Pomodoro Timer</h1>

      <section className="card" aria-label="Timer">
        <div className="row">
          <div className="pills">
            <div className="pill" aria-live="polite">
              Session: {modeLabels[state.mode]}
            </div>
            <div className="pill" aria-label="Completed work sessions">
              Work sessions: {state.workSessionsCompleted}
            </div>
          </div>

          <div className="pills">
            <button
              type="button"
              className="tab"
              aria-pressed={state.soundEnabled ? "true" : "false"}
              aria-label="Toggle sound"
              onClick={() => dispatch({ type: "TOGGLE_SOUND" })}
            >
              Sound: {state.soundEnabled ? "On" : "Off"}
            </button>
          </div>
        </div>

        <div className="modeTabs" aria-label="Session type selector">
          {(["work", "shortBreak", "longBreak"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className="tab"
              aria-pressed={state.mode === m ? "true" : "false"}
              onClick={() => dispatch({ type: "SET_MODE", payload: m })}
            >
              {modeLabels[m]}
            </button>
          ))}
        </div>

        <div className="time" role="timer" aria-label="Time remaining">
          {formatMMSS(state.secondsLeft)}
        </div>

        <div className="controls">
          <button type="button" className="btn" onClick={primaryButton.onClick} aria-label={primaryButton.label}>
            {primaryButton.label}
          </button>

          <button
            type="button"
            className="btn secondary"
            onClick={() => dispatch({ type: "RESET_SESSION" })}
            aria-label="Reset session"
          >
            Reset
          </button>
        </div>

        <p className="note">
          Hotkeys: <strong>S</strong> start/pause/resume, <strong>R</strong> reset.
        </p>

        <div className="srOnly" aria-live="assertive">
          {state.announce}
        </div>
      </section>

      <section className="card" aria-label="Settings">
        <h2>Settings</h2>
        <form onSubmit={onSubmitSettings} className="form">
          <label>
            Work (minutes)
            <input name="workMin" type="number" min="1" defaultValue={state.config.workMin} />
          </label>

          <label>
            Short break (minutes)
            <input name="shortMin" type="number" min="1" defaultValue={state.config.shortMin} />
          </label>

          <label>
            Long break (minutes)
            <input name="longMin" type="number" min="1" defaultValue={state.config.longMin} />
          </label>

          <label>
            Long break every (work sessions)
            <input name="longEvery" type="number" min="1" defaultValue={state.config.longEvery} />
          </label>

          <button type="submit" className="btn" aria-label="Apply settings">
            Apply
          </button>

          <p className="note">
            Applying settings resets the timer to the current session length.
          </p>
        </form>
      </section>
    </main>
  );
}
