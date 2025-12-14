use sp1_build::build_program_with_args;

fn main() {
    // Build all guest programs in the program directory
    // SP1 will compile all binaries in src/bin/
    build_program_with_args("../program", Default::default());
}
