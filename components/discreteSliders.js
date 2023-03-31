import { useCallback, useState } from "react";

export default function DiscreteSliders({
  min,
  max,
  step = "0.1",
  range = 5,
  value,
  onInput,
  className = "",
}) {
  const [trackRef, setTrackRef] = useState({});
  const clampedValue = Math.min(max, Math.max(min, parseFloat(value)));

  const pv = (x, track) => {
    const r = (max - min) / (range - 1);
    const p = (track / (range - 1)) * (x + 1);
    const v = min + r * (x + 1);
    const pers = p / track * 100;
    return { p, v, pers };
  };

  const TrackWithDelimiters = useCallback(() => {
    const track = trackRef.current?.offsetWidth;
    if (!track) {
      return null;
    }
    return (
      <div
        className="discrete-sliders__delimiters"
        style={{ width: `${track}px` }}
      >
        <span
          className={`discrete-sliders__delimiters-element ${
            value >= min ? "delimiter-active" : ""
          }`}
          onClick={()=> onInput(`${min}`)}
          style={{ left: `0%` }}
        ></span>
        {Array.from([...Array(range - 2).keys()]).map((x, i, arr) => {
          const { p, v, pers } = pv(x, track);
          return (
            <span
              key={i}
              className={`discrete-sliders__delimiters-element ${
                value >= v && min !== max ? "delimiter-active" : ""
              }`}
              style={{ left: `${pers}%` }}
              onClick={()=> onInput(`${v}`)}
            ></span>
          );
        })}
        <span
          className={`discrete-sliders__delimiters-element ${
            value >= max && min !== max ? "delimiter-active" : ""
          }`}
          onClick={()=> onInput(`${max}`)}
          style={{ left: `100%` }}
        ></span>
      </div>
    );
  }, [trackRef.current, value, min, max]);

  const TrackWithMarkers = useCallback(() => {
    const track = trackRef.current?.offsetWidth;
    if (!track) {
      return null;
    }
    return (
      <div
        className="discrete-sliders__markers"
        style={{ width: `${track}px` }}
      >
        <span
          className="discrete-sliders__markers-element"
          style={{ left: `0%` }}
        >
          {min.toFixed(0) + "x"}
        </span>
        {Array.from([...Array(range - 2).keys()], (x, i) => {
          const { p, v, pers } = pv(x, track);
          return (
            <span
              className="discrete-sliders__markers-element"
              key={i}
              style={{ left: `${pers}%` }}
            >
              {v.toFixed(0) + "x"}
            </span>
          );
        })}
        <span
          className="discrete-sliders__markers-element"
          style={{ left: `100%` }}
        >
          {max.toFixed(0) + "x"}
        </span>
      </div>
    );
  }, [trackRef.current, value, min, max]);

  const TrackSlider = useCallback(() => {
    const track = trackRef.current?.offsetWidth;
    if (!track) {
      return null;
    }
    const w = (track / (max - min)) * (clampedValue - min);
    const pers = w / track * 100;
    return (
      <div
        className="discrete-sliders__slider"
        style={{ width: `${pers}%` }}
      ></div>
    );
  }, [trackRef.current, value, min, max]);

  return (
    <div className={`discrete-sliders flex flex-column ${className}`}>
      <input
        ref={(ref) => {
          if (trackRef.current !== ref) {
            setTrackRef({ current: ref });
          }
        }}
        className={`discrete-sliders__track ${className}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampedValue}
        onInput={(e) => onInput(e.target.value)}
        list="discrete-sliders"
      />
      <TrackWithDelimiters />
      <TrackWithMarkers />
      <TrackSlider />
    </div>
  );
}
