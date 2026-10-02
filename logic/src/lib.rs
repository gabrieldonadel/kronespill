#![forbid(unsafe_code)]

use exact_game::audio::{self, AudioListener, Sample};
use exact_game::*;
use exact_game_physics::{self as physics, Body, Collider, Physics, Shape};

pub const PHASE_IDLE: u32 = 0;
pub const PHASE_LOADED: u32 = 1;
pub const PHASE_FLYING: u32 = 2;

const HZ: u32 = 240;
const BOARD_SCALE: f32 = 10.0;
const GLASS_H: f32 = 122.0;
const COIN_R: f32 = 2.2;
const COL_COUNT: usize = 18;
const COL_MAX: u32 = 12;
const COL_BOTTOM: f32 = 106.0;
const COL_TOP: f32 = 58.0;
const RAIL_X_L: f32 = 7.6;
const RAIL_X_R: f32 = 92.4;
const CHUTE_W: f32 = 4.7;
const TUBE_PITCH: f32 = (RAIL_X_R - RAIL_X_L - CHUTE_W) / COL_COUNT as f32;
const CHUTE_X0: f32 = RAIL_X_L + (COL_COUNT as f32 / 2.0) * TUBE_PITCH;
const CHUTE_X1: f32 = CHUTE_X0 + CHUTE_W;
const SLOT_VALUES: [u32; 9] = [3, 2, 3, 2, 10, 3, 2, 3, 2];
const SLOT_XS: [f32; 9] = [10., 20., 30., 40., 50., 60., 70., 80., 90.];
const LAUNCH_X: f32 = 95.45;
const LAUNCH_Y: f32 = 37.0;

#[derive(Clone, Debug, Default, Component)]
pub struct Coin;

#[derive(Clone, Debug, Resource)]
pub struct Machine {
    pub phase: u32,
    pub bank: u32,
    pub tray: u32,
    pub played: u32,
    pub won: u32,
    pub best: u32,
    pub power: f32,
    pub flight_ticks: u32,
    pub tubes: Vec<u32>,
    pub banner: String,
    pub banner_ticks: u32,
    pub impact_cooldown: u32,
}

impl Default for Machine {
    fn default() -> Self {
        Self {
            phase: PHASE_IDLE,
            bank: 20,
            tray: 0,
            played: 0,
            won: 0,
            best: 0,
            power: 0.0,
            flight_ticks: 0,
            tubes: initial_tubes(),
            banner: String::new(),
            banner_ticks: 0,
            impact_cooldown: 0,
        }
    }
}

#[derive(Clone, Debug, Default, Data)]
struct Hud {
    phase: String,
    bank: u32,
    tray: u32,
    played: u32,
    won: u32,
    best: u32,
    power: u32,
    stock: u32,
    banner: String,
}

pub struct Kronespill;

impl Game for Kronespill {
    const ID: &'static str = "kronespill";
    const HZ: u32 = HZ;
    const ASSETS: &'static [&'static str] = &[
        "coin-obverse.tex",
        "coin-reverse.tex",
        "insert.sound",
        "launch.sound",
        "payout.sound",
        "thud.sound",
        "clink-a.sound",
        "clink-b.sound",
        "clink-c.sound",
    ];
    type Args = ();

    fn actions() -> Actions {
        Actions::new()
            .button("insert", &["KeyI"])
            .button("flick", &["Space", "Enter"])
            .button("collect", &["KeyC"])
            .button("refill", &["KeyR"])
    }

    fn setup(w: &mut World, _: &()) {
        w.register::<Coin>();
        physics::register(w);
        w.resource_mut::<Physics>().gravity = Vec3::new(0.0, -63.5, 0.0);
        w.insert_resource(Machine::default());
        w.insert_resource(Environment {
            background: Some([0.025, 0.032, 0.04]),
            fog: None,
            bloom: None,
            ..Environment::default()
        });
        w.sounds([
            ("insert", Sample::new("insert.sound").gain(0.7)),
            ("launch", Sample::new("launch.sound").gain(0.8)),
            ("payout", Sample::new("payout.sound").gain(0.85)),
            ("thud", Sample::new("thud.sound").gain(0.7)),
            ("clink-a", Sample::new("clink-a.sound").gain(0.32)),
            ("clink-b", Sample::new("clink-b.sound").gain(0.32)),
            ("clink-c", Sample::new("clink-c.sound").gain(0.32)),
        ]);
        build_board(w);
        publish(w);
    }

    fn tick(w: &mut World, input: &Input, _: &()) {
        handle_controls(w, input);
        if w.resource::<Machine>().phase == PHASE_FLYING {
            physics::step(w);
            update_flying_coin(w);
        }
        audio::step(w);
        age_banner(w);
        publish(w);
    }
}

pub fn initial_tubes() -> Vec<u32> {
    (0..COL_COUNT)
        .map(|i| {
            let distance = (i as f32 - (COL_COUNT as f32 - 1.0) / 2.0).abs();
            (6.0 + distance * 0.72).round().min(COL_MAX as f32) as u32
        })
        .collect()
}

fn tubes_behind(drop_tube: usize) -> [usize; 2] {
    [
        drop_tube.min(COL_COUNT - 1),
        (drop_tube + 1).min(COL_COUNT - 1),
    ]
}

pub fn take_one(tubes: &mut [u32], drop_tube: usize) {
    let [a, b] = tubes_behind(drop_tube);
    let from = if tubes[a] >= tubes[b] { a } else { b };
    tubes[from] = tubes[from].saturating_sub(1);
}

fn tube_left(i: usize) -> f32 {
    let base = RAIL_X_L + i as f32 * TUBE_PITCH;
    if i < COL_COUNT / 2 {
        base
    } else {
        base + CHUTE_W
    }
}

fn tube_x(i: usize) -> f32 {
    tube_left(i) + TUBE_PITCH / 2.0
}

fn board_x(x: f32) -> f32 {
    (x - 50.0) / BOARD_SCALE
}

fn board_y(y: f32) -> f32 {
    (GLASS_H - y) / BOARD_SCALE
}

fn source_x(x: f32) -> f32 {
    x * BOARD_SCALE + 50.0
}

fn source_y(y: f32) -> f32 {
    GLASS_H - y * BOARD_SCALE
}

fn build_board(w: &mut World) {
    w.spawn_named(
        "backplate",
        (
            Transform::at(0.0, 6.1, -0.38),
            Mesh::cuboid(Vec3::new(10.0, 12.2, 0.08)),
            Material::rgb(0.055, 0.115, 0.14).rough(0.72),
            Collider {
                shape: Shape::Box {
                    half: Vec3::new(5.0, 6.1, 0.04),
                },
                friction: 0.05,
                ..Collider::default()
            },
        ),
    );
    w.spawn((
        Transform::at(0.0, 6.1, 0.38),
        Collider {
            shape: Shape::Box {
                half: Vec3::new(5.0, 6.1, 0.04),
            },
            friction: 0.05,
            ..Collider::default()
        },
    ));
    for (x1, y1, x2, y2, kind) in board_edges() {
        edge(w, x1, y1, x2, y2, kind);
    }
    for (x, y, radius, bumper) in board_pegs() {
        peg(w, x, y, radius, bumper);
    }
    for (i, value) in SLOT_VALUES.into_iter().enumerate() {
        let x = board_x(SLOT_XS[i]);
        w.spawn_named(
            format!("pocket-{}-{value}", i + 1),
            (
                Transform::at(x, board_y(45.7), 0.06),
                Mesh::cylinder(0.24, 0.12),
                Material::rgb(0.02, 0.018, 0.016).rough(0.8),
            ),
        );
    }
    let counts = w.resource::<Machine>().tubes.clone();
    for (i, &count) in counts.iter().enumerate() {
        w.spawn_named(
            format!("tube-{i}"),
            (
                Transform::at(board_x(tube_x(i)), board_y(82.0), -0.18),
                Mesh::cuboid(Vec3::new(TUBE_PITCH / BOARD_SCALE * 0.82, 4.8, 0.08)),
                Material::rgb(0.025, 0.03, 0.03).metallic(0.65).rough(0.25),
            ),
        );
        spawn_stock(w, i, count);
    }
    w.spawn_named(
        "camera",
        (
            Transform::at(0.0, 6.1, 20.0),
            Camera::orthographic(14.5),
            AudioListener,
        ),
    );
    w.spawn_named(
        "sun",
        (
            Transform::at(-3.0, 12.0, 14.0).looking_at(Vec3::new(0.0, 6.0, 0.0), Vec3::Y),
            DirectionalLight {
                illuminance: 7500.0,
                shadows: true,
                ..DirectionalLight::default()
            },
        ),
    );
}

fn board_pegs() -> Vec<(f32, f32, f32, bool)> {
    let mut pegs = Vec::new();
    for x in [10., 20., 30., 40., 60., 70., 80.] {
        pegs.push((x, 39., 0.8, false));
    }
    pegs.extend([
        (31., 27., 2.2, true),
        (73., 27., 2.2, true),
        (17., 33., 0.8, false),
        (83., 33., 0.8, false),
        (39., 22., 0.9, false),
        (61., 22., 0.9, false),
        (50., 14., 0.9, false),
    ]);
    pegs
}

fn board_edges() -> Vec<(f32, f32, f32, f32, u32)> {
    let mut out = vec![
        (2., 4., 2., 106., 0),
        (98., 14., 98., 106., 0),
        (2., 50., tube_left(0), 57.5, 1),
        (tube_left(0), 57.5, tube_left(0), 106., 1),
        (98., 50., tube_left(17) + TUBE_PITCH, 57.5, 1),
        (
            tube_left(17) + TUBE_PITCH,
            57.5,
            tube_left(17) + TUBE_PITCH,
            106.,
            1,
        ),
        (CHUTE_X0, 62., CHUTE_X0, 106., 1),
        (CHUTE_X1, 62., CHUTE_X1, 106., 1),
        (92.5, 40., 92.5, 14., 2),
    ];
    let turn_cx = 86.0;
    let turn_cy = 17.0;
    for i in 0..9 {
        let a1 = std::f32::consts::FRAC_PI_2 * i as f32 / 9.0;
        let a2 = std::f32::consts::FRAC_PI_2 * (i + 1) as f32 / 9.0;
        for radius in [12.0, 6.5] {
            out.push((
                turn_cx + radius * exact_game::math::cos(a1),
                turn_cy - radius * exact_game::math::sin(a1),
                turn_cx + radius * exact_game::math::cos(a2),
                turn_cy - radius * exact_game::math::sin(a2),
                2,
            ));
        }
    }
    out.push((86., 5., 76., 1.6, 3));
    out.push((76., 1.6, 50., 1.6, 3));
    for i in 0..26 {
        let a1 = std::f32::consts::PI - std::f32::consts::FRAC_PI_2 * i as f32 / 26.0;
        let a2 = std::f32::consts::PI - std::f32::consts::FRAC_PI_2 * (i + 1) as f32 / 26.0;
        out.push((
            50. + 48. * exact_game::math::cos(a1),
            40. - 38.4 * exact_game::math::sin(a1),
            50. + 48. * exact_game::math::cos(a2),
            40. - 38.4 * exact_game::math::sin(a2),
            3,
        ));
    }
    for i in 0..12 {
        let x1 = RAIL_X_L + (RAIL_X_R - RAIL_X_L) * i as f32 / 12.0;
        let x2 = RAIL_X_L + (RAIL_X_R - RAIL_X_L) * (i + 1) as f32 / 12.0;
        out.push((x1, rail_y(x1), x2, rail_y(x2), 4));
    }
    out
}

fn rail_y(x: f32) -> f32 {
    44.0 + 3.0 * (x - 50.0).abs() / 45.0
}

fn edge(w: &mut World, x1: f32, y1: f32, x2: f32, y2: f32, kind: u32) {
    let a = Vec2::new(board_x(x1), board_y(y1));
    let b = Vec2::new(board_x(x2), board_y(y2));
    let delta = b - a;
    let length = delta.length();
    let angle = exact_game::math::atan2(delta.y, delta.x);
    let thickness = if kind == 4 { 0.075 } else { 0.09 };
    let material = match kind {
        2 => Material::rgb(0.11, 0.11, 0.10).metallic(0.85).rough(0.18),
        4 => Material::rgb(0.035, 0.026, 0.018).rough(0.6),
        _ => Material::rgb(0.16, 0.18, 0.18).metallic(0.72).rough(0.23),
    };
    w.spawn((
        Transform {
            position: Vec3::new((a.x + b.x) / 2.0, (a.y + b.y) / 2.0, 0.0),
            rotation: Quat::from_rotation_z(angle),
            ..Transform::default()
        },
        Mesh::cuboid(Vec3::new(length, thickness * 2.0, 0.46)),
        material,
        Collider {
            shape: Shape::Box {
                half: Vec3::new(length / 2.0, thickness, 0.23),
            },
            friction: if kind == 2 { 0.08 } else { 0.3 },
            bounce: if kind == 4 { 0.7 } else { 0.28 },
            ..Collider::default()
        },
    ));
}

fn peg(w: &mut World, x: f32, y: f32, radius: f32, bumper: bool) {
    let r = radius / BOARD_SCALE;
    w.spawn((
        Transform {
            position: Vec3::new(board_x(x), board_y(y), 0.0),
            rotation: Quat::from_rotation_x(std::f32::consts::FRAC_PI_2),
            ..Transform::default()
        },
        Mesh::cylinder(r, 0.48),
        if bumper {
            Material::rgb(0.32, 0.055, 0.025).rough(0.84)
        } else {
            Material::rgb(0.62, 0.67, 0.69).metallic(0.94).rough(0.12)
        },
        Collider {
            shape: Shape::Cylinder {
                radius: r,
                height: 0.48,
            },
            friction: 0.26,
            bounce: if bumper { 0.72 } else { 0.62 },
            ..Collider::default()
        },
    ));
}

fn spawn_stock(w: &mut World, i: usize, count: u32) {
    let height = (count.max(1) as f32 * 0.29).min(3.5);
    w.spawn_named(
        format!("stock-{i}"),
        (
            Transform::at(
                board_x(tube_x(i)),
                board_y(COL_BOTTOM) + height / 2.0,
                -0.05,
            ),
            Mesh::cuboid(Vec3::new(TUBE_PITCH / BOARD_SCALE * 0.72, height, 0.16)),
            Material::rgb(0.54, 0.39, 0.12).metallic(0.82).rough(0.25),
        ),
    );
}

fn sync_stock(w: &World, i: usize, count: u32) {
    let Some(entity) = w.named(&format!("stock-{i}")) else {
        return;
    };
    let height = (count.max(1) as f32 * 0.29).min(3.5);
    w.require_mut::<Transform>(entity).position.y = board_y(COL_BOTTOM) + height / 2.0;
    *w.require_mut::<Mesh>(entity) =
        Mesh::cuboid(Vec3::new(TUBE_PITCH / BOARD_SCALE * 0.72, height, 0.16));
}

fn handle_controls(w: &mut World, input: &Input) {
    if input.pressed("collect") {
        let mut state = w.resource_mut::<Machine>();
        state.bank += state.tray;
        state.tray = 0;
    }
    if input.pressed("refill") {
        let mut state = w.resource_mut::<Machine>();
        if state.bank == 0 && state.tray == 0 && state.phase == PHASE_IDLE {
            state.bank = 20;
            state.banner = "NY RULL · 20 KRONER".into();
            state.banner_ticks = HZ * 2;
        }
    }
    if input.pressed("insert") {
        insert_coin(w);
    }
    let phase = w.resource::<Machine>().phase;
    if phase != PHASE_LOADED {
        return;
    }
    {
        let mut state = w.resource_mut::<Machine>();
        if input.pressed("flick") {
            state.power = state.power.max(0.22);
        }
        if input.held("flick") {
            state.power = (state.power + 1.25 / HZ as f32).min(1.0);
        }
    }
    if input.released("flick") {
        launch_coin(w);
    }
}

fn insert_coin(w: &mut World) {
    {
        let mut state = w.resource_mut::<Machine>();
        if state.phase != PHASE_IDLE || state.bank == 0 {
            return;
        }
        state.phase = PHASE_LOADED;
        state.bank -= 1;
        state.power = 0.0;
        state.banner.clear();
    }
    if let Some(old) = w.named("coin") {
        w.despawn(old);
    }
    w.spawn_named(
        "coin",
        (
            Transform::at(board_x(LAUNCH_X), board_y(LAUNCH_Y), 0.0),
            Sprite {
                layer: 20,
                ..Sprite::new("coin-reverse.tex", [0.44, 0.44])
            },
            Coin,
        ),
    );
    w.play("insert").start();
}

fn launch_coin(w: &mut World) {
    let power = w.resource::<Machine>().power.clamp(0.0, 1.0);
    let spread = 1.0 + w.rand(-0.03f32..0.03f32);
    let lean = w.rand(-1.25f32..1.25f32) * std::f32::consts::PI / 180.0;
    let speed = (228.0 + (312.0 - 228.0) * power) * spread / BOARD_SCALE;
    let velocity = Vec3::new(
        -exact_game::math::sin(lean) * speed,
        exact_game::math::cos(lean) * speed,
        0.0,
    );
    let Some(coin) = w.named("coin") else { return };
    w.insert(
        coin,
        Body {
            velocity,
            spin: Vec3::new(0.0, 0.0, -8.0),
            mass: 0.007,
            damping: 0.02,
            spin_damping: 0.04,
            ..Body::default()
        },
    );
    w.insert(
        coin,
        Collider {
            shape: Shape::Sphere {
                radius: COIN_R / BOARD_SCALE,
            },
            friction: 0.32,
            bounce: 0.12,
            ..Collider::default()
        },
    );
    {
        let mut state = w.resource_mut::<Machine>();
        state.phase = PHASE_FLYING;
        state.played += 1;
        state.flight_ticks = 0;
    }
    w.play("launch").start();
}

fn update_flying_coin(w: &mut World) {
    let Some(coin) = w.named("coin") else { return };
    let position = w.require::<Transform>(coin).position;
    let velocity = w.require::<Body>(coin).velocity;
    let x = source_x(position.x);
    let y = source_y(position.y);
    let mut result = None;
    let floor = rail_y(x);
    if y > floor - COIN_R * 1.6 && y < floor + COIN_R {
        for (i, slot_x) in SLOT_XS.into_iter().enumerate() {
            let half = if i == 4 { 2.28 } else { 2.4 };
            if (x - slot_x).abs() < half {
                let rate = 0.69 * if i == 4 { 0.45 } else { 1.0 };
                if w.chance(rate / HZ as f32) {
                    result = Some(i as i32 + 1);
                    break;
                }
            }
        }
    }
    {
        let mut state = w.resource_mut::<Machine>();
        state.flight_ticks += 1;
        if state.impact_cooldown > 0 {
            state.impact_cooldown -= 1;
        }
    }
    let touched = physics::events(w)
        .iter()
        .any(|event| event.began && (event.a == coin || event.b == coin));
    let play_clink = touched && w.resource::<Machine>().impact_cooldown == 0;
    if play_clink {
        let sound = match w.tick() % 3 {
            0 => "clink-a",
            1 => "clink-b",
            _ => "clink-c",
        };
        w.play(sound).start();
        w.resource_mut::<Machine>().impact_cooldown = HZ / 20;
    }
    let flight_ticks = w.resource::<Machine>().flight_ticks;
    if result.is_none()
        && (y > COL_TOP + 3.0 || y > COL_BOTTOM || x < 0.0 || x > 100.0 || flight_ticks > HZ * 14)
    {
        result = Some(if x > CHUTE_X0 && x < CHUTE_X1 { -1 } else { -2 });
    }
    if let Some(result) = result {
        resolve_round(w, result, x);
    } else if velocity.length() < 0.08 && flight_ticks > HZ {
        let nudge = Vec3::new(w.rand(-0.14f32..0.14f32), -0.08, 0.0);
        w.require_mut::<Body>(coin).velocity += nudge;
    }
}

fn resolve_round(w: &mut World, result: i32, x: f32) {
    let mut changed = Vec::new();
    let winning = result > 0;
    {
        let mut state = w.resource_mut::<Machine>();
        if winning {
            let hole = result as usize - 1;
            let value = SLOT_VALUES[hole];
            let drop = nearest_tube(SLOT_XS[hole]);
            state.tray += value;
            state.won += value;
            state.best = state.best.max(value);
            for _ in 0..value {
                let before = state.tubes.clone();
                take_one(&mut state.tubes, drop);
                for (i, previous) in before.iter().enumerate() {
                    if *previous != state.tubes[i] && !changed.contains(&i) {
                        changed.push(i);
                    }
                }
            }
            if state.tubes[drop] < COL_MAX {
                state.tubes[drop] += 1;
                if !changed.contains(&drop) {
                    changed.push(drop);
                }
            }
            state.banner = if value == 10 {
                "JACKPOT · 10 KRONER".into()
            } else {
                format!("{value} KRONER")
            };
            state.banner_ticks = HZ * 2;
        } else if result != -1 {
            let tube = nearest_open_tube(&state.tubes, nearest_tube(x));
            if let Some(tube) = tube {
                state.tubes[tube] += 1;
                changed.push(tube);
            }
        }
        state.phase = PHASE_IDLE;
        state.power = 0.0;
        state.flight_ticks = 0;
    }
    if let Some(coin) = w.named("coin") {
        w.despawn(coin);
    }
    let counts = w.resource::<Machine>().tubes.clone();
    for i in changed {
        sync_stock(w, i, counts[i]);
    }
    if winning {
        w.play("payout").start();
    } else {
        w.play("thud").start();
    }
}

fn nearest_tube(x: f32) -> usize {
    let mut best = 0;
    let mut distance = f32::INFINITY;
    for i in 0..COL_COUNT {
        let d = (tube_x(i) - x).abs();
        if d < distance {
            best = i;
            distance = d;
        }
    }
    best
}

fn nearest_open_tube(tubes: &[u32], from: usize) -> Option<usize> {
    for distance in 0..COL_COUNT {
        for candidate in [from.checked_sub(distance), from.checked_add(distance)] {
            if let Some(i) = candidate.filter(|&i| i < COL_COUNT && tubes[i] < COL_MAX) {
                return Some(i);
            }
        }
    }
    None
}

fn age_banner(w: &World) {
    let mut state = w.resource_mut::<Machine>();
    if state.banner_ticks > 0 {
        state.banner_ticks -= 1;
        if state.banner_ticks == 0 {
            state.banner.clear();
        }
    }
}

fn publish(w: &World) {
    let state = w.resource::<Machine>();
    let hud = Hud {
        phase: match state.phase {
            PHASE_LOADED => "loaded",
            PHASE_FLYING => "flying",
            _ => "idle",
        }
        .into(),
        bank: state.bank,
        tray: state.tray,
        played: state.played,
        won: state.won,
        best: state.best,
        power: (state.power * 100.0).round() as u32,
        stock: state.tubes.iter().sum(),
        banner: state.banner.clone(),
    };
    drop(state);
    w.publish_record(&hud);
}
