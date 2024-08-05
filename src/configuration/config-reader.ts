import { Value } from "@sinclair/typebox/value";
import program from "../parser/command-line";
import { IncentivesConfiguration, incentivesConfigurationSchema, validateIncentivesConfiguration } from "./incentives";

let configuration: IncentivesConfiguration | null = null;

try {
  configuration = Value.Default(incentivesConfigurationSchema, {}) as IncentivesConfiguration;
} catch (e) {
  console.error(e);
}

if (program.settings) {
  const settings = Value.Default(
    incentivesConfigurationSchema,
    JSON.parse(program.settings)
  ) as IncentivesConfiguration;
  if (validateIncentivesConfiguration.test(settings)) {
    configuration = Value.Decode(incentivesConfigurationSchema, settings);
  } else {
    console.warn("Invalid incentives configuration detected, will revert to defaults.");
    for (const error of validateIncentivesConfiguration.errors(settings)) {
      console.warn(error);
    }
  }
}
export default configuration as IncentivesConfiguration;
