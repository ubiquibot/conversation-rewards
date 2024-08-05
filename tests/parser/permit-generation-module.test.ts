/* eslint @typescript-eslint/no-var-requires: 0 */
import { CommentKind } from "../../src/configuration/comment-types";
import { PermitGenerationModule } from "../../src/parser/permit-generation-module";
import { Result } from "../../src/parser/processor";

const DOLLAR_ADDRESS = "0xb6919Ef2ee4aFC163BC954C5678e2BB570c2D103";
const WXDAI_ADDRESS = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";

jest.mock("../../src/parser/command-line", () => {
  // Require is needed because mock cannot access elements out of scope
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require("../__mocks__/results/valid-configuration.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require("dotenv");
  dotenv.config();
  return {
    stateId: 1,
    eventName: "issues.closed",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
      issue: {
        html_url: "https://github.com/ubiquibot/comment-incentives/issues/22",
        number: 1,
        state_reason: "not_planned",
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquibot",
        },
      },
    },
    settings: JSON.stringify(cfg),
  };
});

jest.mock("../../src/octokit", () => ({
  getOctokitInstance: () => ({
    users: {
      getByUsername: () => ({
        data: {
          id: 3,
        },
      }),
    },
  }),
}));

jest.mock("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(),
  };
});

// original rewards object before fees are applied
const resultOriginal: Result = {
  user1: {
    total: 100,
    task: {
      reward: 90,
      multiplier: 1,
    },
    userId: 1,
    comments: [
      {
        content: "comment 3",
        url: "https://github.com/user-org/test-repo/issues/57#issuecomment-2172704421",
        type: CommentKind.ISSUE,
        score: {
          reward: 10,
        },
      },
    ],
  },
  user2: {
    total: 11.11,
    task: {
      reward: 9.99,
      multiplier: 1,
    },
    userId: 1,
    comments: [
      {
        content: "comment 3",
        url: "https://github.com/user-org/test-repo/issues/57#issuecomment-2172704421",
        type: CommentKind.ISSUE,
        score: {
          reward: 1.12,
        },
      },
    ],
  },
};

describe("permit-generation-module.ts", () => {
  describe("applyFees()", () => {
    beforeEach(() => {
      // set fee related env variables
      // treasury fee applied to the final permits, ex: 100 = 100%, 0.1 = 0.1%
      process.env.PERMIT_FEE_RATE = "10";
      // github account associated with EVM treasury address allowed to claim permit fees, ex: "ubiquibot-treasury"
      process.env.PERMIT_TREASURY_GITHUB_USERNAME = "ubiquibot-treasury";
      // comma separated list of token addresses which should not incur any fees, ex: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d, 0x4ECaBa5870353805a9F068101A40E0f32ed605C6"
      process.env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST = `${DOLLAR_ADDRESS}`;
    });

    afterEach(() => {
      // restore the spy created with spyOn
      jest.restoreAllMocks();
    });

    it("Should not apply fees if PERMIT_FEE_RATE is empty", async () => {
      process.env.PERMIT_FEE_RATE = "";
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      expect(spyConsoleLog).toHaveBeenCalledWith("PERMIT_FEE_RATE is not set, skipping permit fee generation");
    });

    it("Should not apply fees if PERMIT_FEE_RATE is 0", async () => {
      process.env.PERMIT_FEE_RATE = "0";
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      expect(spyConsoleLog).toHaveBeenCalledWith("PERMIT_FEE_RATE is not set, skipping permit fee generation");
    });

    it("Should not apply fees if PERMIT_TREASURY_GITHUB_USERNAME is empty", async () => {
      process.env.PERMIT_TREASURY_GITHUB_USERNAME = "";
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");
      await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);
      expect(spyConsoleLog).toHaveBeenCalledWith(
        "PERMIT_TREASURY_GITHUB_USERNAME is not set, skipping permit fee generation"
      );
    });

    it("Should not apply fees if ERC20 reward token is included in PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const spyConsoleLog = jest.spyOn(console, "log");
      await permitGenerationModule._applyFees(resultOriginal, DOLLAR_ADDRESS);
      expect(spyConsoleLog).toHaveBeenCalledWith(
        `Token address ${DOLLAR_ADDRESS} is whitelisted to be fee free, skipping permit fee generation`
      );
    });

    it("Should apply fees", async () => {
      const permitGenerationModule = new PermitGenerationModule();
      const resultAfterFees = await permitGenerationModule._applyFees(resultOriginal, WXDAI_ADDRESS);

      // check that 10% fee is subtracted from rewards
      expect(resultAfterFees["user1"].total).toEqual(90);
      expect(resultAfterFees["user1"].task?.reward).toEqual(81);
      expect(resultAfterFees["user1"].comments?.[0].score?.reward).toEqual(9);
      expect(resultAfterFees["user2"].total).toEqual(10);
      expect(resultAfterFees["user2"].task?.reward).toEqual(8.99);
      expect(resultAfterFees["user2"].comments?.[0].score?.reward).toEqual(1.01);

      // check that treasury item is added
      expect(resultAfterFees["ubiquibot-treasury"].total).toEqual(11.11);
    });
  });
});
