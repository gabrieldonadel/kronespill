import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { boardGeometry } from '../board';
import {
  CHANNEL_INNER_X,
  CHANNEL_MOUTH_Y,
  CHANNEL_TURN_Y,
  TURN_CX,
  TURN_CY,
  TURN_R_IN,
  TURN_R_OUT,
  RAMP_APEX_Y,
  RAMP_OUT_Y,
  PAYOUT_CHUTE_BOTTOM,
  PAYOUT_CHUTE_X,
  COL_BOTTOM,
  COL_COUNT,
  COL_TOP,
  GLASS_H,
  GLASS_W,
  POCKET_DEPTH,
  RAIL_X_L,
  RAIL_X_R,
  SLOT_VALUES,
  SLOT_XS,
  TUNE,
  WALL_L,
  WALL_R,
  railY,
} from '../engine';
import { C } from '../theme';
import { CrownShield } from './CrownShield';
import { Starburst } from './Starburst';

export const CHUTE_HALF = 3.4;
export const TUBE_PITCH = (RAIL_X_R - RAIL_X_L) / COL_COUNT;
export const tubeX = (i: number) => RAIL_X_L + TUBE_PITCH * (i + 0.5);

/**
 * The tube channels are cut in a shallow V, tallest at the outside, the way
 * they are on the cabinet. The red backplate shows through above them.
 */
export const tubeTop = (i: number) =>
  COL_TOP + 5 - Math.abs(i - (COL_COUNT - 1) / 2) * 0.62;

const ry = (x: number) => railY(x, TUNE.railDrop);
const halfOf = (k: number) => (k === 4 ? TUNE.jackpotHalf : TUNE.slotHalf);

/**
 * Everything on the board that never moves: airbrushed backplate, arch, pins,
 * bumpers, crown shields, the pocket rail, the chute and the tube channels.
 */
export const Playfield = React.memo(function Playfield({ scale }: { scale: number }) {
  const { edges, pegs } = boardGeometry();
  const rails = edges.filter((e) => e.surface === 'rail');
  return (
    <Svg
      width={GLASS_W * scale}
      height={GLASS_H * scale}
      viewBox={`0 0 ${GLASS_W} ${GLASS_H}`}
    >
      <Defs>
        {/*
          The airbrush: hot orange over the pocket row, falling away to deep red
          at the edges and near black across the top, as on the cabinet.
          User space rather than the bounding box, and no alpha stops: both are
          places where the web and native renderers disagree.
        */}
        <RadialGradient
          id="field"
          gradientUnits="userSpaceOnUse"
          cx="50"
          cy="38"
          r="72"
        >
          <Stop offset="0" stopColor={C.fieldHot} />
          <Stop offset="0.34" stopColor={C.fieldOrange} />
          <Stop offset="0.6" stopColor={C.fieldRed} />
          <Stop offset="0.84" stopColor="#8E0714" />
          <Stop offset="1" stopColor={C.fieldDark} />
        </RadialGradient>
        <LinearGradient id="tube" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={C.aluDark} />
          <Stop offset="0.3" stopColor={C.aluLight} />
          <Stop offset="0.75" stopColor={C.alu} />
          <Stop offset="1" stopColor={C.aluShadow} />
        </LinearGradient>
        <LinearGradient id="chute" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={C.crownYellowDeep} />
          <Stop offset="0.5" stopColor={C.fieldHot} />
          <Stop offset="1" stopColor={C.crownYellowDeep} />
        </LinearGradient>
      </Defs>

      {/* Flat backstop, so a renderer that drops the gradient still shows a
          board rather than a black hole. */}
      <Rect x="0" y="0" width={GLASS_W} height={GLASS_H} fill={C.fieldRed} />
      <Rect x="0" y="0" width={GLASS_W} height={GLASS_H} fill="url(#field)" />

      {/* Ceiling and arch, drawn from the same geometry the coin collides with. */}
      <Path
        d={edges
          .filter((e) => e.surface === 'arch')
          .map((e) => `M${e.x1} ${e.y1} L${e.x2} ${e.y2}`)
          .join(' ')}
        fill="none"
        stroke={C.ink}
        strokeWidth={2.6}
        strokeLinecap="round"
      />

      {/* Launch channel down the right edge, and the turn at its head. The
          black cover over it is visible on the cabinet. */}
      <Path
        d={`M${CHANNEL_INNER_X} ${CHANNEL_MOUTH_Y} L${CHANNEL_INNER_X} ${CHANNEL_TURN_Y} A ${TURN_R_IN} ${TURN_R_IN} 0 0 0 ${TURN_CX} ${TURN_CY - TURN_R_IN} L${TURN_CX} ${TURN_CY - TURN_R_OUT} A ${TURN_R_OUT} ${TURN_R_OUT} 0 0 1 ${TURN_CX + TURN_R_OUT} ${TURN_CY} L${WALL_R} ${CHANNEL_MOUTH_Y} Z`}
        fill={C.plate}
        opacity={0.92}
      />
      <Path
        d={`M${CHANNEL_INNER_X} ${CHANNEL_MOUTH_Y} L${CHANNEL_INNER_X} ${CHANNEL_TURN_Y} A ${TURN_R_IN} ${TURN_R_IN} 0 0 0 ${TURN_CX} ${TURN_CY - TURN_R_IN}`}
        fill="none"
        stroke={C.aluMid}
        strokeWidth={0.5}
        opacity={0.7}
      />
      {[10, 20, 30].map((y) => (
        <Circle key={`cscrew${y}`} cx={(CHANNEL_INNER_X + WALL_R) / 2} cy={y} r={0.55} fill={C.aluMid} />
      ))}

      {/* Pins and bumpers. */}
      {pegs.map((peg, i) => {
        const { x, y, r } = peg;
        const isBumper = peg.surface === 'bumper';
        return (
          <G key={`peg${i}`}>
            <Circle cx={x} cy={y + 0.35} r={r} fill={C.ink} opacity={0.4} />
            <Circle
              cx={x}
              cy={y}
              r={r}
              fill={isBumper ? C.inkSoft : C.alu}
              stroke={isBumper ? C.ink : C.aluShadow}
              strokeWidth={isBumper ? 0.35 : 0.18}
            />
            <Circle
              cx={x - r * 0.3}
              cy={y - r * 0.32}
              r={r * 0.32}
              fill={C.aluLight}
              opacity={isBumper ? 0.35 : 0.95}
            />
            {isBumper && (
              <>
                <Circle cx={x - r - 1.6} cy={y + 0.4} r={0.5} fill={C.aluMid} />
                <Circle cx={x + r + 1.6} cy={y + 0.4} r={0.5} fill={C.aluMid} />
              </>
            )}
          </G>
        );
      })}

      {/* Crown shields, and the starburst over the jackpot. */}
      {SLOT_XS.map((c, k) =>
        k === 4 ? null : (
          <G key={`shield${k}`} x={c - 3.5} y={ry(c) - 10.6}>
            <CrownShield size={7} value={SLOT_VALUES[k]} />
          </G>
        ),
      )}
      <G x={50 - 6.5} y={ry(50) - 12.6}>
        <Starburst size={13} />
      </G>

      {/* Pocket rail and the holes themselves. */}
      {rails.map((s, i) => (
        <Path
          key={`rail${i}`}
          d={`M${s.x1} ${s.y1} L${s.x2} ${s.y2}`}
          stroke={C.ink}
          strokeWidth={1}
          strokeLinecap="round"
        />
      ))}
      {SLOT_XS.map((c, k) => {
        const h = halfOf(k);
        return (
          <Rect
            key={`hole${k}`}
            x={c - h}
            y={ry(c) - 0.5}
            width={h * 2}
            height={1.7}
            rx={0.4}
            fill="#0B0908"
          />
        );
      })}

      {/* The rails under the holes form a flattened diamond. The lower V is
          what the coin actually runs on, so it is drawn from the collision
          geometry; the upper one is the moulding above it. */}
      <Path
        d={`M6 ${RAMP_OUT_Y} L50 ${RAMP_OUT_Y - 4.5} L94 ${RAMP_OUT_Y}`}
        fill="none"
        stroke={C.ink}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d={edges
          .filter((e) => e.surface === 'ramp')
          .map((e) => `M${e.x1} ${e.y1} L${e.x2} ${e.y2}`)
          .join(' ')}
        fill="none"
        stroke={C.ink}
        strokeWidth={2.2}
        strokeLinecap="round"
      />

      {/* Coin tube channels. */}
      {Array.from({ length: COL_COUNT }, (_, i) => {
        const x = RAIL_X_L + TUBE_PITCH * i;
        const top = tubeTop(i);
        return (
          <G key={`tube${i}`}>
            <Rect
              x={x + 0.25}
              y={top}
              width={TUBE_PITCH - 0.5}
              height={COL_BOTTOM - top}
              fill="url(#tube)"
            />
            <Rect
              x={x + TUBE_PITCH - 0.42}
              y={top}
              width={0.34}
              height={COL_BOTTOM - top}
              fill={C.aluShadow}
              opacity={0.8}
            />
            {/* Chrome pin on each channel head. */}
            <Circle cx={x + TUBE_PITCH / 2} cy={top - 0.7} r={0.55} fill={C.alu} />
          </G>
        );
      })}

      {/* Launch chute: striped cover with the starred crown at its head. */}
      <Rect
        x={PAYOUT_CHUTE_X - CHUTE_HALF}
        y={RAMP_APEX_Y + 2.5}
        width={CHUTE_HALF * 2}
        height={PAYOUT_CHUTE_BOTTOM - RAMP_APEX_Y - 2.5}
        fill="url(#chute)"
      />
      {Array.from({ length: 7 }, (_, i) => (
        <Rect
          key={`stripe${i}`}
          x={PAYOUT_CHUTE_X - CHUTE_HALF + 0.7 + i * 0.85}
          y={RAMP_APEX_Y + 3.5}
          width={0.34}
          height={PAYOUT_CHUTE_BOTTOM - RAMP_APEX_Y - 4.5}
          fill={C.ink}
        />
      ))}
      <G>
        <Path
          d={`M${PAYOUT_CHUTE_X - 3.6} ${RAMP_APEX_Y - 3.4} L${PAYOUT_CHUTE_X - 3.6} ${RAMP_APEX_Y - 5.4} L${PAYOUT_CHUTE_X - 1.8} ${RAMP_APEX_Y - 4.2} L${PAYOUT_CHUTE_X - 1.8} ${RAMP_APEX_Y - 6.2} L${PAYOUT_CHUTE_X} ${RAMP_APEX_Y - 4.8} L${PAYOUT_CHUTE_X + 1.8} ${RAMP_APEX_Y - 6.2} L${PAYOUT_CHUTE_X + 1.8} ${RAMP_APEX_Y - 4.2} L${PAYOUT_CHUTE_X + 3.6} ${RAMP_APEX_Y - 5.4} L${PAYOUT_CHUTE_X + 3.6} ${RAMP_APEX_Y - 3.4} Z`}
          fill={C.crownYellow}
        />
        <Path
          d={`M${PAYOUT_CHUTE_X - 3.6} ${RAMP_APEX_Y - 3.4} H${PAYOUT_CHUTE_X + 3.6} V${RAMP_APEX_Y + 1.4} L${PAYOUT_CHUTE_X} ${RAMP_APEX_Y + 4.2} L${PAYOUT_CHUTE_X - 3.6} ${RAMP_APEX_Y + 1.4} Z`}
          fill={C.crownYellow}
        />
        <SvgText
          x={PAYOUT_CHUTE_X}
          y={RAMP_APEX_Y + 0.9}
          textAnchor="middle"
          fontSize="3"
          fill={C.ink}
        >
          ★★★
        </SvgText>
      </G>

      {/* Payout strip along the bottom of the glass. */}
      <Rect x="0" y={COL_BOTTOM} width={GLASS_W} height={GLASS_H - COL_BOTTOM} fill={C.fieldRed} />
      {Array.from({ length: 8 }, (_, i) => (
        <Rect
          key={`exit${i}`}
          x={12 + i * 10}
          y={COL_BOTTOM + 2.2}
          width={6}
          height={1.1}
          rx={0.55}
          fill={C.ink}
        />
      ))}

      {/* Glass reflections. */}
      <Path d={`M6 4 L34 4 L14 40 L6 40 Z`} fill="#FFFFFF" opacity={0.07} />
      <Path d={`M40 4 L52 4 L26 46 L18 46 Z`} fill="#FFFFFF" opacity={0.045} />
    </Svg>
  );
});
