use colored::*;

pub fn print_banner() {
    println!("{}", r#" 
    ____                                 __   
   / __ \____ _______________  ____  ____/ /_ 
  / /_/ / __ `/ ___/ ___/ __ \/ __ \/ __  / __|
 / ____/ /_/ (__  |__  ) /_/ / /_/ / /_/ / /_ 
/_/    \__,_/____/____/ .___/\____/\__,_/\__/ 
                     /_/                      
    "#.cyan().bold());
    println!("{}", "Passport Protocol zk-Verifier".bright_blue().italic());
    println!("{}", "=============================================".bright_black());
    println!();
}

pub fn print_step(msg: &str) {
    println!("{} {}", "➜".cyan().bold(), msg);
}

pub fn print_success(msg: &str) {
    println!("{} {}", "✔".green().bold(), msg);
}

pub fn print_error(msg: &str) {
    println!("{} {}", "✖".red().bold(), msg);
}

pub fn print_info(key: &str, value: &str) {
    println!("  {}: {}", key.bright_black(), value.yellow());
}

pub fn print_divider() {
    println!("{}", "---------------------------------------------".bright_black());
}
