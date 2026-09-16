import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  COIN_R,
  COL_BOTTOM,
  COL_COUNT,
  COL_MAX,
  GLASS_H,
  GLASS_W,
  LAUNCH_X,
  LAUNCH_Y,
  RAIL_X_L,
  SLOT_VALUES,
  SLOT_XS,
  TUNE,
} from './engine';
import {
  coinState,
  createBoard,
  launchBoard,
  stepBoard,
  takeImpact,
  RESULT_FLYING,
  type Board,
} from './physics';
import { keepPlayed, takeOne } from './payout';
import {
  initSound,
  playImpact,
  playInsert,
  playLaunch,
  playLost,
  playPayout,
  setSoundEnabled,
} from './sound';
import { C } from './theme';
import { Playfield, TUBE_PITCH, tubeX } from './components/Playfield';
import { TubeBank } from './components/TubeBank';
import { SidePlate } from './components/SidePlate';
import { Coin } from './components/Coin';

// ------------------------------------------------------------ cabinet layout

const FRAME = 4;
const PLATE_W = 8;
const SILL_H = 6;
const TRAY_H = 16;
const MW = FRAME + GLASS_W + PLATE_W;
const MH = FRAME + GLASS_H + SILL_H + TRAY_H;
const TRAY_Y = FRAME + GLASS_H + SILL_H;
const TRAY_X = 18;
const TRAY_W = 76;

const HEADER_H = 44;
const CONTROLS_H = 118;
const STATS_H = 30;

/**
 * Development smoke test: the machine inserts and flicks on its own and logs
 * every outcome, which is how the whole loop gets exercised without a pair of
 * hands. Switch it on with EXPO_PUBLIC_AUTOPLAY=1, or ?autoplay on web.
 */
const AUTOPLAY =
  process.env.EXPO_PUBLIC_AUTOPLAY === '1' ||
  (typeof window !== 'undefined' &&
    typeof window.location?.search === 'string' &&
    window.location.search.includes('autoplay'));

const START_BANK = 20;
const REFILL = 20;
const PAY_POOL = 10;
/** One coin leaves the stack every STEP_MS, and falls for FLY_MS. */
const PAY_STEP_MS = 95;
const PAY_FLY_MS = 430;

/** Tube stock starts in the V the cabinet is photographed with. */
function initialTubes() {
  return Array.from({ length: COL_COUNT }, (_, i) =>
    Math.min(COL_MAX, Math.round(6 + Math.abs(i - (COL_COUNT - 1) / 2) * 0.72)),
  );
}

type Phase = 'idle' | 'loaded' | 'flying' | 'settling';

export function Game() {
  const insets = useSafeAreaInsets();

  // The cabinet is sized from the space it actually gets, so nothing is ever
  // clipped on a narrow phone or in landscape.
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const onStage = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage((prev) =>
      Math.abs(prev.w - width) < 0.5 && Math.abs(prev.h - height) < 0.5
        ? prev
        : { w: width, h: height },
    );
  }, []);
  // The window gives a usable size on the first frame; the measured stage then
  // corrects it, which matters in landscape and on very short screens.
  const win = useWindowDimensions();
  const availW = stage.w || win.width - 16;
  const availH =
    stage.h || win.height - insets.top - insets.bottom - HEADER_H - CONTROLS_H - STATS_H;
  const scale = Math.max(1.4, Math.min(availW / MW, availH / MH));
  const u = useCallback((v: number) => v * scale, [scale]);
  const coinPx = COIN_R * 2 * scale;

  const [phase, setPhase] = useState<Phase>('idle');
  const [bank, setBank] = useState(START_BANK);
  const [tray, setTray] = useState(0);
  const [tubes, setTubes] = useState(initialTubes);
  const [played, setPlayed] = useState(0);
  const [won, setWon] = useState(0);
  const [best, setBest] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The solver owns the coin's state; these carry it to the UI thread so the
  // sprite keeps moving smoothly across React renders.
  const cx = useSharedValue(LAUNCH_X);
  const cy = useSharedValue(LAUNCH_Y);
  const spin = useSharedValue(0);
  const coinShown = useSharedValue(0);

  const boardRef = useRef<Board | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastAtRef = useRef(0);
  const [soundOn, setSoundOn] = useState(true);

  if (boardRef.current === null) boardRef.current = createBoard(TUNE);

  useEffect(() => {
    initSound();
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      payTimers.current.forEach(clearTimeout);
    };
  }, []);

  // Flick strength, 0 to 1, driven by the lever.
  const power = useSharedValue(0);
  const payMs = useSharedValue(0);
  const payTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [payout, setPayout] = useState<{ x: number; y: number; n: number }>({
    x: 50,
    y: COL_BOTTOM,
    n: 0,
  });

  const say = useCallback((msg: string) => {
    setBanner(msg);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 1800);
  }, []);

  const tubeFor = (x: number) =>
    Math.max(0, Math.min(COL_COUNT - 1, Math.floor((x - RAIL_X_L) / TUBE_PITCH)));

  /** Pays out of the two tubes behind a pocket, and keeps the coin played. */
  const settle = useCallback(
    (result: number, x: number) => {
      const winning = result > 0;
      const value = winning ? SLOT_VALUES[result - 1] : 0;
      const dropTube = winning ? tubeFor(SLOT_XS[result - 1]) : tubeFor(x);

      // The coin played is always kept by the machine.
      setTubes((prev) => keepPlayed(prev, dropTube));

      if (AUTOPLAY) {
        console.log(
          `[autoplay] ${winning ? `WIN ${value} kr pocket ${result}` : `lost x=${x.toFixed(1)}`}`,
        );
      }

      if (winning) {
        setTray((t) => t + value);
        setWon((w) => w + value);
        setBest((bst) => Math.max(bst, value));
        // A win is paid out of the stock behind that hole: one coin leaves the
        // bottom of a tube at a time, and the stack steps down as it goes.
        const shown = Math.min(PAY_POOL, value);
        setPayout({ x: tubeX(dropTube), y: COL_BOTTOM, n: shown });
        const total = PAY_STEP_MS * (shown - 1) + PAY_FLY_MS;
        payMs.value = 0;
        payMs.value = withTiming(total, {
          duration: total,
          easing: Easing.linear,
        });
        payTimers.current.forEach(clearTimeout);
        payTimers.current = [];
        for (let i = 0; i < value; i++) {
          payTimers.current.push(
            setTimeout(
              () => setTubes((prev) => takeOne(prev, dropTube)),
              i * PAY_STEP_MS,
            ),
          );
        }
        say(value === 10 ? 'JACKPOT · 10 KRONER' : `${value} KRONER`);
        playPayout();
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      } else {
        playLost();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }

      // Drop the played coin out of sight into the tube bank.
      cy.value = withTiming(COL_BOTTOM - 6, { duration: 260 }, (done) => {
        'worklet';
        if (done) {
          coinShown.value = 0;
          runOnJS(setPhase)('idle');
        }
      });
    },
    [cy, coinShown, payMs, say],
  );

  const onResolved = useCallback(
    (result: number, x: number) => {
      setPhase('settling');
      settle(result, x);
    },
    [settle],
  );

  /** One frame of solver, then the result is carried to the UI thread. */
  const tick = useCallback(
    (now: number) => {
      const board = boardRef.current;
      if (!board) return;
      const prev = lastAtRef.current || now;
      lastAtRef.current = now;
      const result = stepBoard(board, (now - prev) / 1000 || 1 / 60);

      const c = coinState(board);
      cx.value = c.x;
      cy.value = c.y;
      spin.value = c.angle;

      const impact = takeImpact(board);
      if (impact.strength > 0) playImpact(impact.strength, impact.on);

      if (result !== RESULT_FLYING) {
        frameRef.current = null;
        onResolved(result, c.x);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    },
    [cx, cy, spin, onResolved],
  );

  const insert = useCallback(() => {
    if (phase !== 'idle' || bank <= 0) return;
    setBank((b) => b - 1);
    setPhase('loaded');
    cx.value = LAUNCH_X;
    cy.value = LAUNCH_Y;
    spin.value = 0;
    coinShown.value = 1;
    playInsert();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
  }, [bank, phase, cx, cy, spin, coinShown]);

  const flick = useCallback(
    (p: number) => {
      const board = boardRef.current;
      if (!board) return;
      setPlayed((n) => n + 1);
      setPhase('flying');
      playLaunch();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      launchBoard(board, p);
      lastAtRef.current = 0;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(tick);
    },
    [tick],
  );

  const sweepTray = useCallback(() => {
    if (tray <= 0) return;
    setBank((b) => b + tray);
    setTray(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
  }, [tray]);

  const refill = useCallback(() => {
    setBank((b) => b + REFILL);
    say(`NY RULL · ${REFILL} KRONER`);
  }, [say]);

  // Drive the machine on its own when the smoke test is on.
  useEffect(() => {
    if (!AUTOPLAY) return;
    if (phase === 'idle') {
      if (bank <= 0) {
        const t = setTimeout(() => {
          setBank((b) => b + REFILL);
          if (tray > 0) setTray(0);
        }, 400);
        return () => clearTimeout(t);
      }
      const t = setTimeout(insert, 700);
      return () => clearTimeout(t);
    }
    if (phase === 'loaded') {
      const t = setTimeout(() => flick(0.25 + Math.random() * 0.7), 320);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, bank, tray, insert, flick]);

  const loaded = phase === 'loaded';
  const pull = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          'worklet';
          power.value = 0;
        })
        .onUpdate((e) => {
          'worklet';
          const p = e.translationY / (26 * scale);
          power.value = p < 0 ? 0 : p > 1 ? 1 : p;
        })
        .onEnd(() => {
          'worklet';
          const p = power.value;
          power.value = withTiming(0, { duration: 260 });
          if (p > 0.06) runOnJS(flick)(p);
        })
        .enabled(loaded),
    [flick, loaded, power, scale],
  );

  // ------------------------------------------------------------------ styles

  const coinStyle = useAnimatedStyle(() => ({
    opacity: coinShown.value,
    transform: [
      { translateX: (FRAME + cx.value - COIN_R) * scale },
      { translateY: (FRAME + cy.value - COIN_R) * scale },
      { rotate: `${spin.value}deg` },
    ],
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: power.value * 26 * scale }],
  }));

  const meterStyle = useAnimatedStyle(() => ({
    height: `${Math.round(power.value * 100)}%`,
  }));

  const emptied = bank <= 0 && tray <= 0 && phase === 'idle';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>KRONESPILL</Text>
        <Text style={styles.subtitle}>knipsekasse · 1 krone</Text>
      </View>

      <View style={styles.stage} onLayout={onStage}>
      <View style={[styles.machine, { width: u(MW), height: u(MH), borderRadius: u(1.5) }]}>
        <View
          style={[
            styles.glass,
            { left: u(FRAME), top: u(FRAME), width: u(GLASS_W), height: u(GLASS_H) },
          ]}
        >
          <Playfield scale={scale} />
          <View style={StyleSheet.absoluteFill}>
            <TubeBank counts={tubes} scale={scale} />
          </View>
        </View>

        <View style={{ position: 'absolute', left: u(FRAME + GLASS_W), top: u(FRAME) }}>
          <SidePlate width={u(PLATE_W)} height={u(GLASS_H)} />
        </View>

        {/* Aluminium sill under the glass. */}
        <View
          style={[
            styles.sill,
            { left: u(FRAME - 2), top: u(FRAME + GLASS_H), width: u(GLASS_W + 4), height: u(SILL_H) },
          ]}
        />

        {/* Coin bowl. */}
        <Pressable
          onPress={sweepTray}
          style={[
            styles.tray,
            { left: u(TRAY_X), top: u(TRAY_Y), width: u(TRAY_W), height: u(TRAY_H - 3) },
          ]}
        >
          {Array.from({ length: Math.min(tray, 22) }, (_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: u(4 + ((i * 29) % (TRAY_W - 14))),
                top: u(3 + ((i * 17) % 8)),
                width: coinPx * 0.8,
                height: coinPx * 0.8,
              }}
            >
              <Coin size={coinPx * 0.8} detail={false} face={i % 3 === 0 ? 'obverse' : 'reverse'} />
            </View>
          ))}
          {tray > 0 && (
            <Text style={[styles.trayHint, { fontSize: Math.max(8, u(2.6)) }]}>
              {tray} kr · trykk for å ta
            </Text>
          )}
        </Pressable>

        {/* Coins in flight, above the glass. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Animated.View
            style={[{ position: 'absolute', width: coinPx, height: coinPx }, coinStyle]}
          >
            <Coin size={coinPx} face="reverse" />
          </Animated.View>
          {Array.from({ length: payout.n }, (_, i) => (
            <PayoutCoin
              key={i}
              index={i}
              elapsed={payMs}
              from={payout}
              scale={scale}
              size={coinPx}
            />
          ))}
        </View>

        {banner && (
          <View style={[styles.banner, { top: u(24) }]}>
            <Text style={[styles.bannerText, { fontSize: Math.max(13, u(5)) }]}>{banner}</Text>
          </View>
        )}
      </View>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={insert}
          disabled={phase !== 'idle' || bank <= 0}
          style={({ pressed }) => [
            styles.button,
            (phase !== 'idle' || bank <= 0) && styles.buttonOff,
            pressed && styles.buttonDown,
          ]}
        >
          <Text style={styles.buttonLabel}>LEGG PÅ MYNT</Text>
          <Text style={styles.buttonValue}>{bank} kr</Text>
        </Pressable>

        <GestureDetector gesture={pull}>
          <View style={[styles.lever, !loaded && styles.leverOff]}>
            <View style={styles.meterTrack}>
              <Animated.View style={[styles.meterFill, meterStyle]} />
            </View>
            <Animated.View style={[styles.knob, knobStyle]} />
            <Text style={styles.leverLabel}>{loaded ? 'DRA NED · SLIPP' : 'KNIPS'}</Text>
          </View>
        </GestureDetector>
      </View>

      <View style={styles.stats}>
        <Text style={styles.stat}>SPILT {played}</Text>
        <Text style={styles.stat}>VUNNET {won} kr</Text>
        <Text style={styles.stat}>BESTE {best} kr</Text>
        {emptied ? (
          <Pressable onPress={refill} hitSlop={8}>
            <Text style={[styles.stat, styles.refill]}>TOM · NY RULL</Text>
          </Pressable>
        ) : (
          <Text style={styles.stat}>SKÅL {tray} kr</Text>
        )}
        <Pressable
          onPress={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundEnabled(next);
          }}
          hitSlop={8}
        >
          <Text style={[styles.stat, soundOn && styles.refill]}>
            LYD {soundOn ? 'PÅ' : 'AV'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** One coin of a payout, hopping from the tube bank into the bowl. */
function PayoutCoin({
  index,
  elapsed,
  from,
  scale,
  size,
}: {
  index: number;
  elapsed: SharedValue<number>;
  from: { x: number; y: number };
  scale: number;
  size: number;
}) {
  const targetX = TRAY_X + 6 + ((index * 31) % (TRAY_W - 18));
  const targetY = TRAY_Y + 4 + ((index * 13) % 7);
  const style = useAnimatedStyle(() => {
    const raw = (elapsed.value - index * PAY_STEP_MS) / PAY_FLY_MS;
    const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    const x = from.x + (targetX - from.x) * t;
    // Falls out of the tube, then drops into the bowl.
    const y = from.y + (targetY - from.y) * (t * t * 0.7 + t * 0.3);
    return {
      opacity: raw > 0 && t < 1 ? 1 : 0,
      transform: [
        { translateX: (FRAME + x - COIN_R) * scale },
        { translateY: (FRAME + y - COIN_R) * scale },
        { rotate: `${t * 220 * (index % 2 ? 1 : -1)}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Coin size={size} detail={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.screenBg,
    alignItems: 'center',
  },
  header: { alignItems: 'center', height: HEADER_H, justifyContent: 'center' },
  stage: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  title: {
    color: C.crownYellow,
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 4,
  },
  subtitle: { color: C.textDim, fontSize: 10, letterSpacing: 2, marginTop: 1 },
  machine: {
    backgroundColor: C.alu,
    borderWidth: 1,
    borderColor: C.aluShadow,
    overflow: 'hidden',
  },
  glass: { position: 'absolute', overflow: 'hidden', backgroundColor: C.fieldDark },
  sill: {
    position: 'absolute',
    backgroundColor: C.aluLight,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.aluDark,
  },
  tray: {
    position: 'absolute',
    backgroundColor: '#1C1A18',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.aluDark,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  trayHint: { color: C.textDim, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(10,8,8,0.82)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.crownYellow,
  },
  bannerText: { color: C.crownYellow, fontWeight: '900', letterSpacing: 2 },
  controls: {
    flexDirection: 'row',
    gap: 12,
    height: CONTROLS_H,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  button: {
    flex: 1,
    height: 92,
    borderRadius: 6,
    backgroundColor: C.aluLight,
    borderWidth: 1,
    borderColor: C.aluShadow,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  buttonOff: { opacity: 0.45 },
  buttonDown: { backgroundColor: C.alu },
  buttonLabel: { color: C.plate, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  buttonValue: { color: C.inkSoft, fontSize: 19, fontWeight: '800' },
  lever: {
    width: 118,
    height: 92,
    borderRadius: 6,
    backgroundColor: C.plate,
    borderWidth: 1,
    borderColor: C.aluShadow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leverOff: { opacity: 0.45 },
  meterTrack: {
    position: 'absolute',
    left: 10,
    top: 10,
    bottom: 10,
    width: 8,
    borderRadius: 4,
    backgroundColor: '#2A2725',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  meterFill: { backgroundColor: C.crownYellow, width: '100%' },
  knob: {
    width: 44,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.aluLight,
    borderWidth: 1,
    borderColor: C.aluShadow,
  },
  leverLabel: {
    position: 'absolute',
    bottom: 8,
    color: C.plateText,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  stats: {
    flexDirection: 'row',
    gap: 14,
    height: STATS_H,
    alignItems: 'center',
  },
  stat: { color: C.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  refill: { color: C.crownYellow },
});
