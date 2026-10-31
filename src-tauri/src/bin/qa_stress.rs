fn main() {
    eprintln!("The legacy stress harness was retired: it used unsafe payloads and unsupported telemetry. Run the bounded remediation_tests suite instead. Execution remains disabled pending a verified containment boundary.");
    std::process::exit(2);
}
