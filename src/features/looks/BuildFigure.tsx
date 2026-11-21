import { useId } from 'react';
import type { BuildArchetype } from '@shared/domain/fitness/builds';
import { REGION_LABELS } from '@shared/domain/fitness/builds';
import { AVERAGE_TOP_Y, FIGURE_VIEWBOX, GROUND_Y, TORSO_REGIONS, figureShapes } from '@shared/domain/fitness/figure';

/** A drawing of the build's proportions, with where it carries its muscle highlighted. */
export function BuildFigure({ build, size = 'md' }: { build: BuildArchetype; size?: 'sm' | 'md' }) {
  const uid = useId().replace(/:/g, '');
  const f = figureShapes(build.figure);
  const torsoClip = `torso-${uid}`;
  const bodyClip = `body-${uid}`;
  const label = `Drawing of the ${build.name} build. Highlighted: ${build.emphasis.map((r) => REGION_LABELS[r].toLowerCase()).join(', ')}.`;
  const tall = build.figure.h >= 1.04 ? 'Taller than average' : build.figure.h <= 0.95 ? 'Shorter than average' : null;
  return (
    <figure className={`build-figure build-figure--${size}`}>
      <svg viewBox={`0 0 ${FIGURE_VIEWBOX.width} ${FIGURE_VIEWBOX.height}`} role="img" aria-label={label}>
        <defs>
          <clipPath id={torsoClip}><path d={f.torso} transform={f.transform} /></clipPath>
          <clipPath id={bodyClip}>{f.body.map((d, i) => <path key={i} d={d} transform={f.transform} />)}</clipPath>
        </defs>
        <line x1="14" x2="186" y1={AVERAGE_TOP_Y} y2={AVERAGE_TOP_Y} className="build-figure__avg" />
        <line x1="20" x2="180" y1={GROUND_Y} y2={GROUND_Y} className="build-figure__ground" />
        <g transform={f.transform}>
          <g className="build-figure__outline">{f.body.map((d, i) => <path key={i} d={d} />)}</g>
          <g className="build-figure__fill">{f.body.map((d, i) => <path key={i} d={d} />)}</g>
        </g>
        <g className="build-figure__hi">
          {build.emphasis.map((r) => (
            <g key={r} clipPath={`url(#${TORSO_REGIONS.includes(r) ? torsoClip : bodyClip})`}>
              <g transform={f.transform}>{(f.regions[r] ?? []).map((d, i) => <path key={i} d={d} />)}</g>
            </g>
          ))}
        </g>
        <g transform={f.transform} className="build-figure__detail">{f.details.map((d, i) => <path key={i} d={d} />)}</g>
      </svg>
      {size === 'md' && tall && <figcaption className="xsmall subtle">{tall}</figcaption>}
    </figure>
  );
}
