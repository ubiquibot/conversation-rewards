import Decimal from "decimal.js";
import * as fs from "fs";
import { CommentAssociation, CommentKind } from "../configuration/comment-types";
import configuration from "../configuration/config-reader";
import githubCommentModuleInstance from "../helpers/github-comment-module-instance";
import logger from "../helpers/logger";
import { typeReplacer } from "../helpers/result-replacer";
import { IssueActivity } from "../issue-activity";
import { ContentEvaluatorModule } from "./content-evaluator-module";
import { DataPurgeModule } from "./data-purge-module";
import { FormattingEvaluatorModule } from "./formatting-evaluator-module";
import { PermitGenerationModule } from "./permit-generation-module";
import { UserExtractorModule } from "./user-extractor-module";

export class Processor {
  private _transformers: Module[] = [];
  private _result: Result = {};
  private readonly _configuration = configuration.incentives;

  constructor() {
    this.add(new UserExtractorModule())
      .add(new DataPurgeModule())
      .add(new FormattingEvaluatorModule())
      .add(new ContentEvaluatorModule())
      .add(new PermitGenerationModule())
      .add(githubCommentModuleInstance);
  }

  add(transformer: Module) {
    this._transformers.push(transformer);
    return this;
  }

  async run(data: Readonly<IssueActivity>) {
    for (const transformer of this._transformers) {
      if (transformer.enabled) {
        this._result = await transformer.transform(data, this._result);
      }
      // Aggregate total result
      for (const item of Object.keys(this._result)) {
        this._result[item].total = this._sumRewards(this._result[item]);
      }
    }
    return this._result;
  }

  dump() {
    const { file } = this._configuration;
    const result = JSON.stringify(this._result, typeReplacer, 2);
    if (!file) {
      logger.debug(result);
    } else {
      fs.writeFileSync(file, result);
    }
    return result;
  }

  _sumRewards(obj: Record<string, unknown>) {
    let totalReward = new Decimal(0);

    for (const [key, value] of Object.entries(obj)) {
      if (key === "reward" && typeof value === "number") {
        totalReward = totalReward.add(value);
      } else if (typeof value === "object") {
        totalReward = totalReward.add(this._sumRewards(value as Record<string, unknown>));
      }
    }

    return totalReward.toFixed(2);
  }
}

export interface Module {
  transform(data: Readonly<IssueActivity>, result: Result): Promise<Result>;
  get enabled(): boolean;
}

export interface Result {
  [k: string]: {
    comments?: GithubCommentScore[];
    total: number;
    task?: {
      reward: number;
      multiplier: number;
    };
    permitUrl?: string;
    userId: number;
    evaluationCommentHtml?: string;
  };
}

export interface GithubCommentScore {
  id: number;
  content: string;
  url: string;
  type: CommentKind | CommentAssociation;
  diffHunk?: string;
  score?: {
    formatting?: {
      content: Record<string, { symbols: { [p: string]: { count: number; multiplier: number } }; score: number }>;
      multiplier: number;
    };
    relevance?: number;
    clarity?: number;
    reward: number;
  };
}
