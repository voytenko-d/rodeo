import { useCallback, useRef } from "react";

export default function DiscreteSliders({ min, max, step = "0.1", range = 5, value, onInput, className = "" }) {
  const trackRef = useRef();

  const pv = (x, track) => {
    const r = (max - min) / (range - 1);
    const p = track / (range - 1) * (x + 1);
    const v = min + (r * (x + 1));
    return { p, v }
  };

  const TrackWithDelimiters = useCallback(() => {
    const track = trackRef.current?.offsetWidth;
    if (!track) {
      return null;
    }
    return (
      <div className="discrete-sliders__delimiters" style={{ width: `${track}px` }} onClick={(e) => {
        e.stopPropagation();
        const node = [...e.target?.attributes].find((a) => a.name === 'value');
        onInput(node.value);
      }}>
        <span className={`discrete-sliders__delimiters-element ${value >= min ? 'delimiter-active' : ''}`} value={min}
              style={{ left: `0px` }}></span>
        {Array.from([...Array(range - 2).keys()]).map((x, i, arr) => {
          const { p, v } = pv(x, track);
          return (
            <span
              onInput={(e) => onInput(e.target.value)}
              key={i}
              value={v}
              className={`discrete-sliders__delimiters-element ${value >= v ? 'delimiter-active' : ''}`}
              style={{ left: `${p}px` }}
            ></span>
          );
        })}
        <span className={`discrete-sliders__delimiters-element ${value >= max ? 'delimiter-active' : ''}`} value={max}
              style={{ left: `${track}px` }}></span>
      </div>
    )
  }, [trackRef.current, value]);

  const TrackWithMarkers = useCallback(() => {
    const track = trackRef.current?.offsetWidth;
    if (!track) {
      return null;
    }
    return (
      <div className="discrete-sliders__markers" style={{ width: `${track}px` }}>
        <span className="discrete-sliders__markers-element" value={min}
              style={{ left: `0px` }}>{min.toFixed(1) + 'x'}</span>
        {Array.from([...Array(range - 2).keys()], (x, i) => {
          const { p, v } = pv(x, track);
          return <span className="discrete-sliders__markers-element" key={i} value={v}
                       style={{ left: `${p}px` }}>{v.toFixed(1) + 'x'}</span>
        })}
        <span className="discrete-sliders__markers-element" value={max}
              style={{ left: `${track}px` }}>{max.toFixed(1) + 'x'}</span>
      </div>
    );
  }, [trackRef.current]);

  const TrackSlider = useCallback(() => {
    const track = trackRef.current?.offsetWidth;
    if (!track) {
      return null;
    }
    const w = track / (max - min) * (value - min);
    return <div className="discrete-sliders__slider" style={{ width: `${w}px` }}></div>
  }, [trackRef.current, value]);

  return (
    <div className={`discrete-sliders flex flex-column ${className}`}>
      <input
        ref={trackRef}
        className={`discrete-sliders__track ${className}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onInput(e.target.value)}
        list="discrete-sliders"
      />
      <TrackWithDelimiters/>
      <TrackWithMarkers/>
      <TrackSlider/>
    </div>
  );
}
