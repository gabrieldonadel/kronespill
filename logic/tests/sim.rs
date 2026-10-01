use exact_game::{InputEvent, PointerPhase, Sim};
use kronespill_logic::{
    initial_tubes, take_one, Kronespill, Machine, PHASE_FLYING, PHASE_IDLE, PHASE_LOADED,
};

fn sim() -> Sim<Kronespill> {
    Sim::with_assets((), |name| {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../assets")
            .join(name);
        std::fs::read(path).map_err(|error| error.to_string())
    })
    .unwrap()
}

#[test]
fn payout_comes_from_the_fuller_tube_behind_a_hole() {
    let mut tubes = initial_tubes();
    tubes[8] = 3;
    tubes[9] = 7;
    take_one(&mut tubes, 8);
    assert_eq!((tubes[8], tubes[9]), (3, 6));
}

#[test]
fn insert_then_release_launches_one_coin() {
    let mut game = sim();
    assert_eq!(game.world().resource::<Machine>().phase, PHASE_IDLE);
    game.tap("KeyI");
    game.run(20.0);
    let loaded = game.world().resource::<Machine>();
    assert_eq!(loaded.phase, PHASE_LOADED);
    assert_eq!(loaded.bank, 19);
    drop(loaded);

    game.input(InputEvent::Key {
        code: "Space".into(),
        down: true,
        at_ms: 20.0,
    });
    game.run(500.0);
    game.input(InputEvent::Key {
        code: "Space".into(),
        down: false,
        at_ms: 520.0,
    });
    game.run(20.0);
    let flying = game.world().resource::<Machine>();
    assert_eq!(flying.phase, PHASE_FLYING);
    assert_eq!(flying.played, 1);
    assert!(game.world().named("coin").is_some());
}

#[test]
fn the_same_inputs_produce_the_same_world() {
    let mut a = sim();
    let mut b = sim();
    for game in [&mut a, &mut b] {
        game.tap("KeyI");
        game.run(20.0);
        game.input(InputEvent::Control {
            name: "flick".into(),
            id: 7,
            phase: PointerPhase::Down,
            x: 20.0,
            y: 20.0,
            at_ms: 20.0,
        });
        game.run(420.0);
        game.input(InputEvent::Control {
            name: "flick".into(),
            id: 7,
            phase: PointerPhase::Up,
            x: 20.0,
            y: 70.0,
            at_ms: 440.0,
        });
        game.run(2500.0);
    }
    assert_eq!(a.world().hash(), b.world().hash());
}
