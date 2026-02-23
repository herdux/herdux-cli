import chalk from "chalk";

export const logger = {
  info(message: string): void {
    console.log(chalk.blue("ℹ"), message);
  },

  success(message: string): void {
    console.log(chalk.green("✔"), message);
  },

  warn(message: string): void {
    console.log(chalk.yellow("⚠"), message);
  },

  error(message: string): void {
    console.log(chalk.red("✖"), message);
  },

  title(message: string): void {
    console.log(chalk.bold.cyan(`\n${message}\n`));
  },

  line(message: string): void {
    console.log(`  ${message}`);
  },

  blank(): void {
    console.log();
  },
};
