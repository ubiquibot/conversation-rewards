import { parseGitHubUrl } from "../src/start";
import { IssueActivity } from "../src/issue-activity";
import { Processor } from "../src/parser/processor";
import { UserExtractorModule } from "../src/parser/user-extractor-module";
import { server } from "./__mocks__/node";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import userCommentResults from "./__mocks__/results/user-comment-results.json";
import dataPurgeResults from "./__mocks__/results/data-purge-result.json";
import formattingEvaluatorResults from "./__mocks__/results/formatting-evaluator-results.json";
import permitGenerationResults from "./__mocks__/results/permit-generation-results.json";
import contentEvaluatorResults from "./__mocks__/results/content-evaluator-results.json";
import githubCommentResults from "./__mocks__/results/github-comment-results.json";
import dbSeed from "./__mocks__/db-seed.json";
import { FormattingEvaluatorModule } from "../src/parser/formatting-evaluator-module";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import Decimal from "decimal.js";
import { PermitGenerationModule } from "../src/parser/permit-generation-module";
import { db as mockDb } from "./__mocks__/db";
import { GithubCommentModule } from "../src/parser/github-comment-module";
import fs from "fs";
import configuration from "../src/configuration/config-reader";
import validConfiguration from "./__mocks__/results/valid-configuration.json";
import "../src/parser/command-line";

const issueUrl = process.env.TEST_ISSUE_URL || "https://github.com/ubiquibot/comment-incentives/issues/22";

jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation((specification, comments) => {
  return Promise.resolve(comments.map(() => new Decimal(0.8)));
});

jest.mock("../src/parser/command-line", () => {
  // Require is needed because mock cannot access elements out of scope
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require("./__mocks__/results/valid-configuration.json");
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
        state_reason: "completed",
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

jest.mock("@ubiquibot/permit-generation/core", () => {
  const originalModule = jest.requireActual("@ubiquibot/permit-generation/core");

  return {
    __esModule: true,
    ...originalModule,
    createAdapters: jest.fn(() => {
      return {
        supabase: {
          wallet: {
            getWalletByUserId: jest.fn((userId: number) => {
              const wallet = mockDb.wallets.findFirst({
                where: {
                  userId: {
                    equals: userId,
                  },
                },
              });
              if (!wallet) {
                return Promise.resolve(null);
              }
              return Promise.resolve(wallet.address);
            }),
          },
        },
      };
    }),
  };
});

jest.mock("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        insert: jest.fn(() => ({})),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 1,
              },
            })),
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: {
                  id: 1,
                },
              })),
            })),
          })),
        })),
      })),
    })),
  };
});

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Modules tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const activity = new IssueActivity(issue);

  beforeAll(async () => {
    await activity.init();
    for (const item of dbSeed.users) {
      mockDb.users.create(item);
    }
    for (const item of dbSeed.wallets) {
      mockDb.wallets.create(item);
    }
    for (const item of dbSeed.locations) {
      mockDb.locations.create(item);
    }
  });

  it("Should extract users from comments", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule()];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(userCommentResults, undefined, 2));
    logSpy.mockReset();
  });

  it("Should purge data", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule(), new DataPurgeModule()];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(dataPurgeResults, undefined, 2));
    logSpy.mockReset();
  });

  it("Should evaluate formatting", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule(), new DataPurgeModule(), new FormattingEvaluatorModule()];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(formattingEvaluatorResults, undefined, 2));
    logSpy.mockReset();
  });

  it("Should evaluate content", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [
      new UserExtractorModule(),
      new DataPurgeModule(),
      new FormattingEvaluatorModule(),
      new ContentEvaluatorModule(),
    ];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(contentEvaluatorResults, undefined, 2));
    logSpy.mockReset();
  });

  it("Should generate permits", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [
      new UserExtractorModule(),
      new DataPurgeModule(),
      new FormattingEvaluatorModule(),
      new ContentEvaluatorModule(),
      new PermitGenerationModule(),
    ];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(permitGenerationResults, undefined, 2));
    logSpy.mockReset();
  });

  it("Should generate GitHub comment", async () => {
    const logSpy = jest.spyOn(console, "log");
    const processor = new Processor();
    processor["_transformers"] = [
      new UserExtractorModule(),
      new DataPurgeModule(),
      new FormattingEvaluatorModule(),
      new ContentEvaluatorModule(),
      new PermitGenerationModule(),
      new GithubCommentModule(),
    ];
    await processor.run(activity);
    processor.dump();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(githubCommentResults, undefined, 2));
    expect(fs.readFileSync("./output.html")).toEqual(fs.readFileSync("./tests/__mocks__/results/output.html"));
    logSpy.mockReset();
  });

  it("Should properly generate the configuration", () => {
    const cfg = configuration;

    expect(cfg).toEqual(validConfiguration);
  });

  it("Should do a full run", async () => {
    const module = (await import("../src/index.ts")) as unknown as { default: Promise<string> };
    const result = await module.default;
    expect(result).toBeTruthy();
  });
});
