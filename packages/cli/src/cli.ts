#!/usr/bin/env node
import { Command } from "commander";
import { config } from "dotenv";
import { checkCommand } from "./commands/check.js";
import { importCommand } from "./commands/import.js";

config();

const program = new Command();

program
  .name("ovenlovin")
  .description("OvenLovin CLI - Allergy-aware meal planning")
  .version("0.0.0");

program.addCommand(checkCommand());
program.addCommand(importCommand());

program.parse();
