import * as core from "@actions/core";
import { run } from "./run";

export default run()
  .then((result) => {
    core?.setOutput("result", result);
    return result;
  })
  .catch((e) => {
    console.error("Failed to run comment evaluation:", e);
    core?.setFailed(e.toString());
    return e;
  });
