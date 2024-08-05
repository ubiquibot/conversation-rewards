import { http, HttpResponse } from "msw";
import { parseGitHubUrl } from "../src/start";
import { IssueActivity } from "../src/issue-activity";
import { GithubCommentScore, Processor } from "../src/parser/processor";
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

jest.mock("../src/helpers/web3", () => ({
  getERC20TokenSymbol() {
    return "WXDAI";
  },
}));

jest.mock("@actions/github", () => ({
  context: {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquibot/conversation-rewards",
      },
    },
  },
}));

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

  beforeEach(async () => {
    jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation((specification, comments) => {
      return Promise.resolve(
        (() => {
          const relevance: { [k: string]: Decimal } = {};
          comments.forEach((comment) => {
            relevance[`${comment.id}`] = new Decimal(0.8);
          });
          return relevance;
        })()
      );
    });
  });

  it("Should extract users from comments", async () => {
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule()];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(userCommentResults);
  });

  it("Should purge data", async () => {
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule(), new DataPurgeModule()];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(dataPurgeResults);
  });

  it("Should evaluate formatting", async () => {
    const processor = new Processor();
    processor["_transformers"] = [new UserExtractorModule(), new DataPurgeModule(), new FormattingEvaluatorModule()];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(formattingEvaluatorResults);
  });

  it("Should evaluate content", async () => {
    const processor = new Processor();
    processor["_transformers"] = [
      new UserExtractorModule(),
      new DataPurgeModule(),
      new FormattingEvaluatorModule(),
      new ContentEvaluatorModule(),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(contentEvaluatorResults);
  });

  it("Should evaluate a failed openai evaluation with relevance 1", async () => {
    jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation(() => {
      return Promise.resolve({});
    });

    const processor = new Processor();
    processor["_transformers"] = [
      new UserExtractorModule(),
      new DataPurgeModule(),
      new FormattingEvaluatorModule(),
      new ContentEvaluatorModule(),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    Object.keys(result).forEach((user) => {
      expect(result[user]["comments"].length).toBeGreaterThan(0);
      result[user]["comments"].forEach((comment: GithubCommentScore) => {
        expect(comment.score?.relevance).toEqual(1);
      });
    });
  });

  it("Should generate permits", async () => {
    const processor = new Processor();
    processor["_transformers"] = [
      new UserExtractorModule(),
      new DataPurgeModule(),
      new FormattingEvaluatorModule(),
      new ContentEvaluatorModule(),
      new PermitGenerationModule(),
    ];
    // This catches calls by getFastestRpc
    server.use(
      http.post("https://*", () =>
        HttpResponse.json([
          {
            jsonrpc: "2.0",
            id: 1,
            result: "0x64",
          },
          {
            jsonrpc: "2.0",
            id: 2,
            result: "0x0000000000000000000000000000000000000000000000000000000000000012",
          },
        ])
      )
    );
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(permitGenerationResults);
  });

  it("Should generate GitHub comment", async () => {
    const processor = new Processor();
    processor["_transformers"] = [
      new UserExtractorModule(),
      new DataPurgeModule(),
      new FormattingEvaluatorModule(),
      new ContentEvaluatorModule(),
      new PermitGenerationModule(),
      new GithubCommentModule(),
    ];
    // This catches calls by getFastestRpc
    server.use(
      http.post("https://*", () =>
        HttpResponse.json([
          {
            jsonrpc: "2.0",
            id: 1,
            result: "0x64",
          },
          {
            jsonrpc: "2.0",
            id: 2,
            result: "0x0000000000000000000000000000000000000000000000000000000000000012",
          },
        ])
      )
    );
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(githubCommentResults);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output.html", "utf-8")
    );
  });

  it("Should properly generate the configuration", () => {
    const cfg = configuration;

    expect(cfg).toEqual(validConfiguration);
  });

  it("Should do a full run", async () => {
    const module = (await import("../src/index")) as unknown as { default: Promise<string> };
    const result = await module.default;
    expect(result).toBeTruthy();
  });
});
